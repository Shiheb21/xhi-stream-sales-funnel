/**
 * Lead Processor — Batch Processing Engine
 *
 * Consumes comments from Redis Stream (comment_stream) via XREADGROUP,
 * extracts phone numbers using LeadExtractor, buffers results, and
 * flushes to PostgreSQL via Prisma.createMany().
 *
 * Buffer flush triggers:
 *   - Buffer reaches BATCH_SIZE (default: 200 leads)
 *   - FLUSH_INTERVAL_MS elapsed (default: 5000ms)
 *
 * DLQ: Failed batches are moved to "leads_dlq" Redis set for retry.
 *
 * @module processor
 */

import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { LeadExtractor, type ValidatedLead } from '@xhi/lead-extraction';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcessorConfig {
  redis: {
    host: string;
    port: number;
    password: string;
  };
  batchSize: number;
  flushIntervalMs: number;
  streamKey: string;
  consumerGroup: string;
  consumerName: string;
  dlqKey: string;
}

interface StreamComment {
  id: string;
  platform: string;
  commentId: string;
  content: string;
  source?: string;
  sessionId?: string;
}

interface BufferedLead {
  phoneNumber: string;
  rawComment: string;
  platform: string;
  commentId: string;
  uniqueHash: string;
  confidenceScore: number;
  countryCode: string | null;
  source: string | null;
  sessionId: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LeadProcessor Class
// ═══════════════════════════════════════════════════════════════════════════

export class LeadProcessor {
  private redis: Redis;
  private prisma: PrismaClient;
  private extractor: LeadExtractor;
  private config: ProcessorConfig;
  private buffer: BufferedLead[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private processedCount = 0;
  private errorCount = 0;

  constructor(prisma: PrismaClient, config: ProcessorConfig) {
    this.prisma = prisma;
    this.config = config;
    this.extractor = new LeadExtractor();

    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start the processor — begin consuming from Redis Stream.
   */
  async start(): Promise<void> {
    this.isRunning = true;

    // Ensure consumer group exists
    try {
      await this.redis.xgroup(
        'CREATE',
        this.config.streamKey,
        this.config.consumerGroup,
        '$',
        'MKSTREAM',
      );
      console.log(`[Processor] Created consumer group "${this.config.consumerGroup}"`);
    } catch (err: unknown) {
      const error = err as Error;
      // Group already exists — that's fine
      if (!error.message?.includes('BUSYGROUP')) {
        throw error;
      }
      console.log(`[Processor] Consumer group "${this.config.consumerGroup}" already exists`);
    }

    // Start the flush timer
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        console.log(`[Processor] Timer flush: ${this.buffer.length} leads in buffer`);
        this.flush().catch((err) => console.error('[Processor] Timer flush error:', err));
      }
    }, this.config.flushIntervalMs);

    console.log('[Processor] Started. Listening for comments...');

    // Main consume loop
    while (this.isRunning) {
      try {
        await this.consume();
      } catch (err) {
        this.errorCount++;
        console.error('[Processor] Consume error:', err);
        // Backoff on error
        await this.sleep(2000);
      }
    }
  }

  /**
   * Gracefully stop the processor — flush remaining buffer and disconnect.
   */
  async stop(): Promise<void> {
    console.log('[Processor] Stopping...');
    this.isRunning = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining leads
    if (this.buffer.length > 0) {
      console.log(`[Processor] Final flush: ${this.buffer.length} leads`);
      await this.flush();
    }

    await this.redis.quit();
    console.log('[Processor] Stopped.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core: Consume → Extract → Buffer → Flush
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read a batch of messages from Redis Stream using XREADGROUP.
   */
  private async consume(): Promise<void> {
    const results = await this.redis.xreadgroup(
      'GROUP',
      this.config.consumerGroup,
      this.config.consumerName,
      'COUNT',
      '50',
      'BLOCK',
      '2000',
      'STREAMS',
      this.config.streamKey,
      '>',
    );

    if (!results || results.length === 0) return;

    for (const [, messages] of results) {
      for (const [messageId, fields] of messages) {
        try {
          const comment = this.parseStreamMessage(messageId, fields);
          if (comment) {
            this.processComment(comment);
          }

          // ACK the message
          await this.redis.xack(
            this.config.streamKey,
            this.config.consumerGroup,
            messageId,
          );
        } catch (err) {
          console.error(`[Processor] Error processing message ${messageId}:`, err);
        }
      }
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  /**
   * Parse a Redis Stream message into a StreamComment.
   */
  private parseStreamMessage(id: string, fields: string[]): StreamComment | null {
    const data: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }

    if (!data.content || !data.platform || !data.comment_id) {
      console.warn(`[Processor] Skipping invalid message ${id}: missing required fields`);
      return null;
    }

    return {
      id,
      platform: data.platform,
      commentId: data.comment_id,
      content: data.content,
      source: data.source || undefined,
      sessionId: data.session_id || undefined,
    };
  }

  /**
   * Extract phone numbers from a comment and add valid leads to the buffer.
   */
  private processComment(comment: StreamComment): void {
    const result = this.extractor.process(comment.content);

    for (const validated of result.validated) {
      // Only buffer leads with reasonable confidence
      if (validated.confidenceScore < 0.4) continue;

      const uniqueHash = this.generateHash(comment.platform, comment.commentId);

      this.buffer.push({
        phoneNumber: validated.phoneNumber,
        rawComment: comment.content,
        platform: comment.platform,
        commentId: comment.commentId,
        uniqueHash,
        confidenceScore: validated.confidenceScore,
        countryCode: validated.countryCode,
        source: comment.source || null,
        sessionId: comment.sessionId || null,
      });
    }
  }

  /**
   * Flush the buffer to PostgreSQL via Prisma.createMany().
   * On failure, move the batch to the DLQ for retry.
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.config.batchSize);
    const batchId = `batch_${Date.now()}_${batch.length}`;

    try {
      const result = await this.prisma.lead.createMany({
        data: batch.map((lead) => ({
          phoneNumber: lead.phoneNumber,
          rawComment: lead.rawComment,
          platform: lead.platform,
          commentId: lead.commentId,
          uniqueHash: lead.uniqueHash,
          confidenceScore: lead.confidenceScore,
          countryCode: lead.countryCode,
          source: lead.source,
          sessionId: lead.sessionId,
        })),
        skipDuplicates: true,
      });

      this.processedCount += result.count;
      console.log(
        `[Processor] Flushed batch ${batchId}: ${result.count} inserted, ` +
        `${batch.length - result.count} duplicates skipped. ` +
        `Total processed: ${this.processedCount}`,
      );
      
      // Phase 2: Emit leads:new to Redis Pub/Sub for WebSockets
      if (result.count > 0) {
        try {
          await this.redis.publish('leads:new', JSON.stringify({
            batchId,
            timestamp: new Date().toISOString(),
            // Ensure we don't broadcast sensitive data directly if not needed, 
            // but we broadcast the leads count and basic info for the ticker
            leads: batch.map(l => ({
              id: l.uniqueHash, // temp distinct ID 
              phoneNumber: l.phoneNumber, // In prod, mask this (e.g. +216 ** *** 984)
              platform: l.platform,
              confidenceScore: l.confidenceScore,
              sessionId: l.sessionId
            }))
          }));
        } catch (pubErr) {
          console.error(`[Processor] Failed to publish leads:new event:`, pubErr);
        }
      }
    } catch (err) {
      this.errorCount++;
      console.error(`[Processor] Flush failed for batch ${batchId}:`, err);

      // Move to DLQ
      try {
        await this.redis.sadd(
          this.config.dlqKey,
          JSON.stringify({
            batchId,
            leads: batch,
            error: (err as Error).message,
            timestamp: new Date().toISOString(),
          }),
        );
        console.log(`[Processor] Batch ${batchId} moved to DLQ (${this.config.dlqKey})`);
      } catch (dlqErr) {
        console.error(`[Processor] CRITICAL: Failed to write to DLQ:`, dlqErr);
        // Last resort: put them back in the buffer
        this.buffer.unshift(...batch);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate MD5 hash from platform + comment_id for deduplication.
   */
  private generateHash(platform: string, commentId: string): string {
    return createHash('md5')
      .update(`${platform}:${commentId}`)
      .digest('hex');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stats (for healthcheck)
  // ─────────────────────────────────────────────────────────────────────────

  getStats() {
    return {
      isRunning: this.isRunning,
      bufferSize: this.buffer.length,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
    };
  }
}

export default LeadProcessor;
