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

import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/var/log/xhi-funnel.log' })
  ]
});

// ═══════════════════════════════════════════════════════════════════════════
// Health Check & Export API
// ═══════════════════════════════════════════════════════════════════════════

const { Worker } = require('worker_threads');
const path = require('path');
import { prisma } from '@xhi/database';
import { generateCsv, generatePdf, syncGoogleSheets } from '@xhi/export-engine';

app.get('/api/v1/status', async (req, reply) => {
  logger.info('Health map requested');
  let pgStatus = 'offline';
  let redisStatus = 'offline';

  try {
    await prisma.$queryRaw`SELECT 1`;
    pgStatus = 'online';
  } catch (e) {
    logger.error(`Postgres Ping Failed: ${e}`);
  }

  try {
    const pubClient = new Redis({ host: process.env.REDIS_HOST, port: 6379 });
    const ping = await pubClient.ping();
    if (ping === 'PONG') redisStatus = 'online';
    pubClient.disconnect();
  } catch (e) {
    logger.error(`Redis Ping Failed: ${e}`);
  }

  return reply.send({
    postgres: pgStatus,
    redis: redisStatus,
    streamMonitor: 'managed_by_pm2' 
  });
});

app.get('/export/:sessionId', async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const { format } = req.query as { format?: 'csv' | 'pdf' | 'gsheet' };

  if (!format) return reply.code(400).send({ error: 'Format param (csv|pdf|gsheet) required' });

  // 1. Fetch source Lead data from isolated DB transaction
  const leads = await prisma.lead.findMany({ where: { sessionId } });
  
  if (leads.length === 0) return reply.code(404).send({ error: 'No structured leads exist for this session/stream.' });
  
  // Basic mock name for the Session Title context in PDF
  const sessionTitle = `Stream_Session_${sessionId.substring(0, 8)}`; 

  // 2. CSV Streaming logic
  if (format === 'csv') {
    const csvBuffer = generateCsv(leads);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="leads_${sessionId}.csv"`);
    return reply.send(csvBuffer);
  }

  // 3. Google Sheet Realtime Auth Push Logic
  if (format === 'gsheet') {
    // Requires User Configuration
    const userConfig = await prisma.userConfig.findFirst();
    if (!userConfig || !userConfig.gsheetId) {
      return reply.code(400).send({ error: 'No linked Google Spreadsheet ID on User Settings' });
    }
    
    await syncGoogleSheets(leads, userConfig.gsheetId);
    return { status: 'Synced success to Google Sheets', leadCount: leads.length };
  }

  // 4. PDF Generation (Heavy Lifting Array)
  if (format === 'pdf') {
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="report_${sessionId}.pdf"`);

    // Speckit Rule: Worker Thread limit for array sizes
    if (leads.length > 5000) {
      try {
        const fileBuffer = await new Promise((resolve, reject) => {
          const workerPath = path.resolve(__dirname, '../../../workers/shared/export-worker.js');
          const worker = new Worker(workerPath, {
            workerData: { leads, sessionTitle }
          });
          
          worker.on('message', (msg) => {
            if (msg.success) resolve(msg.buffer);
            else reject(new Error(msg.error));
          });
          worker.on('error', reject);
          worker.on('exit', (code) => {
             if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
          });
        });
        return reply.send(fileBuffer);
      } catch (e: any) {
        return reply.code(500).send({ error: `Heavy PDF Render failed: ${e.message}` });
      }
    }

    // Normal Array processing Main Loop Buffer
    const pdfBuffer = await generatePdf(leads, sessionTitle);
    return reply.send(pdfBuffer);
  }

  return reply.code(400).send({ error: 'Invalid format requested' });
});

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
