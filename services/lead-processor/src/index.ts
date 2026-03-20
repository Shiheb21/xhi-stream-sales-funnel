/**
 * Lead Processor — Service Entrypoint
 *
 * Fastify service that exposes a healthcheck endpoint for Docker/K8s
 * and starts the LeadProcessor background batch worker.
 */

import Fastify from 'fastify';
import { prisma } from '@xhi/database';
import { LeadProcessor } from './processor';

// ═══════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

const processorConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || 'xhi_redis_2026',
  },
  batchSize: parseInt(process.env.BATCH_SIZE || '200', 10),
  flushIntervalMs: parseInt(process.env.FLUSH_INTERVAL_MS || '5000', 10),
  streamKey: 'comment_stream',
  consumerGroup: 'lead_processor_group',
  consumerName: `processor_${process.pid}`,
  dlqKey: 'leads_dlq',
};

// ═══════════════════════════════════════════════════════════════════════════
// Fastify Setup
// ═══════════════════════════════════════════════════════════════════════════

const server = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

// Initialize processor
const processor = new LeadProcessor(prisma, processorConfig);

// Healthcheck endpoint (required for Speckit/Docker/K8s)
server.get('/health', async () => {
  const stats = processor.getStats();
  const isHealthy = stats.isRunning;
  
  if (!isHealthy) {
    return server.code(503).send({ status: 'unhealthy', stats });
  }
  
  return { status: 'healthy', stats };
});

// ═══════════════════════════════════════════════════════════════════════════
// Lifecycle Hooks
// ═══════════════════════════════════════════════════════════════════════════

const start = async () => {
  try {
    // Start Fastify server
    await server.listen({ port: PORT, host: HOST });
    console.log(`[Service] Lead Processor running at http://${HOST}:${PORT}`);
    
    // Start background processor
    processor.start().catch((err) => {
      console.error('[Service] Processor crashed:', err);
      process.exit(1);
    });
    
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[Service] Received ${signal}. Shutting down gracefully...`);
  await processor.stop();
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
