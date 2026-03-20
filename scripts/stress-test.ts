/**
 * Stress Test Script
 * Loads 15,000 mock comments directly into Redis Stream (comment_stream).
 * Validates Lead Extractor performance, DB inserts, and DLQ handling.
 * Run via: npx tsx scripts/stress-test.ts
 */

import { Redis } from 'ioredis';
import { prisma } from '@xhi/database';
import { v4 as uuidv4 } from 'uuid';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || 'xhi_redis_2026',
});

const STREAM_KEY = 'comment_stream';
const TOTAL_COMMENTS = 15000;
const BATCH_SIZE = 500;

// Ratios defined
const cleanCount = Math.floor(TOTAL_COMMENTS * 0.5); // 7500
const messyCount = Math.floor(TOTAL_COMMENTS * 0.4); // 6000
const invalidCount = TOTAL_COMMENTS - cleanCount - messyCount; // 1500

async function generateMockComments() {
  const comments = [];

  for (let i = 0; i < cleanCount; i++) {
    comments.push(`My number is 21654332123`);
  }
  for (let i = 0; i < messyCount; i++) {
    comments.push(`t4255678984/55678984t42 price??`);
  }
  for (let i = 0; i < invalidCount; i++) {
    comments.push(`Hello how much?`);
  }

  // Shuffle for realistic flow
  for (let i = comments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [comments[i], comments[j]] = [comments[j], comments[i]];
  }

  return comments;
}

async function run() {
  console.log('--- XHI Stress Test Simulation ---');
  console.log(`Target: ${TOTAL_COMMENTS} comments injected into Redis Stream in 60 seconds.`);

  // 1. Flush existing buffer
  await prisma.lead.deleteMany();
  await redis.del('leads_dlq'); 

  // Create a mock live session for attribution matching during stress test
  const session = await prisma.liveSession.create({
    data: {
      platform: 'tiktok',
      streamUrl: 'rtmp://test-stream',
      status: 'ACTIVE',
    }
  });

  const commentsList = await generateMockComments();
  let injected = 0;
  const startTime = Date.now();

  const pipeline = redis.pipeline();
  
  // Inject in intervals mapping over ~60s
  const intervalMs = 60000 / (TOTAL_COMMENTS / BATCH_SIZE);

  for (let b = 0; b < commentsList.length; b += BATCH_SIZE) {
    const batch = commentsList.slice(b, b + BATCH_SIZE);
    
    for (const text of batch) {
      pipeline.xadd(
        STREAM_KEY,
        'MAXLEN', '~', 100000,
        '*',
        'content', text,
        'platform', 'tiktok',
        'comment_id', uuidv4(),
        'session_id', session.id
      );
    }
    
    await pipeline.exec();
    injected += batch.length;
    console.log(`[StressTest] Injected ${injected}/${TOTAL_COMMENTS} comments...`);
    
    // Slight delay to mimic 60 second drip rather than instant bomb
    await new Promise(r => setTimeout(r, intervalMs));
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\nInjection complete in ${duration.toFixed(2)}s.`);

  // Wait 10 seconds for lead-processor to drain batches
  console.log('Waiting 15 seconds for Lead Processor to flush batches to PostgreSQL...');
  await new Promise(r => setTimeout(r, 15000));

  // Validation
  const totalLeads = await prisma.lead.count();
  const dlqLength = await redis.scard('leads_dlq');
  
  console.log('\n--- RESULTS ---');
  console.log(`Total Leads in DB: ${totalLeads} / 13500 Expected`);
  console.log(`Total Batches in DLQ: ${dlqLength}`);
  
  if (totalLeads === 13500) {
    console.log('✅ PASS: Stress test successful. Zero valid lead loss.');
  } else {
    console.log(`❌ FAIL: Expected 13500 leads, got ${totalLeads}`);
  }

  await redis.quit();
  await prisma.$disconnect();
}

run().catch(console.error);
