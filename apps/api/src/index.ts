/**
 * API Gateway — WebSocket Sync Layer
 *
 * Exposes core API routes while maintaining a WebSocket connection manager.
 * Listens to Redis pub/sub ('leads:new') and pushes to Connected Web Clients.
 * Uses socket.io + @socket.io/redis-adapter for horizontal scaling.
 */

import Fastify from 'fastify';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Initialize Fastify
const app = Fastify({ logger: true });

// Basic health check route
app.get('/health', async () => ({ status: 'healthy', service: 'api-gateway' }));

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Sync Configuration
// ═══════════════════════════════════════════════════════════════════════════

export async function setupWebSockets() {
  const io = new Server(app.server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  // Redis Clients for pub/sub standard scaling and Redis adapter
  const pubClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || 'xhi_redis_2026',
  });
  
  const subClient = pubClient.duplicate();

  // 1. Adapter initialization: Sync Socket.io rooms/connections across instances
  io.adapter(createAdapter(pubClient, subClient));

  // 2. The Gateway: Listen separately for the lead-processor emit
  const leadEventListener = pubClient.duplicate();
  leadEventListener.subscribe('leads:new', (err, count) => {
    if (err) {
      console.error('[WebSockets] Failed to subscribe to leads:new', err);
    } else {
      console.log(`[WebSockets] Subscribed successfully. Active channels: ${count}`);
    }
  });

  leadEventListener.on('message', (channel, message) => {
    if (channel === 'leads:new') {
      try {
        const payload = JSON.parse(message);
        // The Gateway pushes the live leads to the correct connected Web Clients.
        io.emit('leads:live_update', payload);
        console.log(`[WebSockets] Broadcasted ${payload?.leads?.length || 0} leads to connected clients.`);
      } catch (e) {
        console.error('[WebSockets] Payload parse error', e);
      }
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WebSockets] Client connected ID: ${socket.id}`);
    
    // Auth logic could easily intercept here: `io.use(middleware)`
    
    socket.on('disconnect', () => {
      console.log(`[WebSockets] Client disconnected ID: ${socket.id}`);
    });
  });

  return io;
}

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    await setupWebSockets();
    console.log(`[Service] API Gateway & WebSocket Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
