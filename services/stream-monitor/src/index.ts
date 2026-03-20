/**
 * Stream Monitor & Launcher
 *
 * Implements an automated lifecycle for live stream processes using
 * child_process spawn wrappers for FFMPEG/OBS pre-configurations.
 * Includes Self-Recovery error handling: watches stream bitrates,
 * zeroes trigger a self-restart procedure logging as an incident.
 */

import Fastify from 'fastify';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

const PORT = parseInt(process.env.PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';

const server = Fastify({ logger: true });

// ═══════════════════════════════════════════════════════════════════════════
// Automated Lifecycle & Self Recovery
// ═══════════════════════════════════════════════════════════════════════════

class StreamMonitor extends EventEmitter {
  private activeStreams: Map<string, ChildProcess> = new Map();
  private streamBitrates: Map<string, number> = new Map();
  private recoveryLoops: Map<string, NodeJS.Timeout> = new Map();

  // "Muscle" requirement - Start stream
  public startStream(streamId: string, url: string) {
    if (this.activeStreams.has(streamId)) {
      throw new Error('Stream already running');
    }

    server.log.info(`[StreamLauncher] Starting stream ${streamId}`);
    
    // Using a mock FFMPEG ping or idle spawn as OBS/FFMPEG wrapper
    const process = spawn('sh', ['-c', `echo "Mock stream ${url}"; sleep 3600;`]);
    this.activeStreams.set(streamId, process);
    
    // Simulate bitrate 2000 initially
    this.streamBitrates.set(streamId, 2000);

    // Watcher: The Self-Recovery Logic (Runs every 10s)
    const monitorInterval = setInterval(() => {
      this.checkHealth(streamId);
    }, 10000);
    
    this.recoveryLoops.set(streamId, monitorInterval);

    process.on('close', (code) => {
      server.log.warn(`[StreamLauncher] Process ${streamId} closed with code ${code}`);
      this.cleanup(streamId);
    });
  }

  // "Muscle" Requirement - The loop that kicks in if bitrate drops to 0 at 3 AM
  private checkHealth(streamId: string) {
    const bitrate = this.streamBitrates.get(streamId) || 0;
    
    if (bitrate <= 0) {
      server.log.error(`[StreamMonitor] CRITICAL: Bitrate dropped to 0 on ${streamId}! Initiating Self-Recovery...`);
      
      // Log Incident (mock DB logic or webhook)
      console.log(`[IncidentLog] Auto-recorded Stream Crash/0kbps incident for ${streamId} at ${new Date().toISOString()}`);

      // Self-Recovery execution
      this.stopStream(streamId); // Teardown broken process
      setTimeout(() => {
        server.log.info(`[StreamMonitor] Self-Recovery: Restarting ${streamId}...`);
        this.startStream(streamId, 'rtmp://recovered-stream-url'); // Boot back up
      }, 3000);
    }
  }

  public stopStream(streamId: string) {
    const process = this.activeStreams.get(streamId);
    if (process) {
      process.kill('SIGKILL');
      this.cleanup(streamId);
      server.log.info(`[StreamLauncher] Stopped stream ${streamId}`);
    }
  }

  public simulateBitrateDrop(streamId: string) {
    // For testing the self-recovery loop
    this.streamBitrates.set(streamId, 0); 
  }

  private cleanup(streamId: string) {
    this.activeStreams.delete(streamId);
    this.streamBitrates.delete(streamId);
    const interval = this.recoveryLoops.get(streamId);
    if (interval) clearInterval(interval);
    this.recoveryLoops.delete(streamId);
  }
}

const monitor = new StreamMonitor();

// ═══════════════════════════════════════════════════════════════════════════
// Fastify Endpoints
// ═══════════════════════════════════════════════════════════════════════════

server.get('/health', async () => ({ status: 'healthy', service: 'stream-monitor' }));

// NGINX Rate limited endpoint (handled at nginx level)
server.post('/launch', async (req, reply) => {
  const { id, streamUrl } = req.body as { id: string, streamUrl: string };
  if (!id || !streamUrl) return reply.code(400).send({ error: 'Missing params' });

  try {
    monitor.startStream(id, streamUrl);
    return { status: 'launched', id };
  } catch (error) {
    const err = error as Error;
    return reply.code(500).send({ error: err.message });
  }
});

server.post('/stop', async (req) => {
  const { id } = req.body as { id: string };
  monitor.stopStream(id);
  return { status: 'stopped', id };
});

// Endpoint just to prove the recovery loop drops the bitrate manually
server.post('/simulate-crash', async (req) => {
  const { id } = req.body as { id: string };
  monitor.simulateBitrateDrop(id);
  return { status: 'bitrate_dropped_to_zero', tracking: id };
});

const start = async () => {
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`[Service] Stream Monitor running at http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
