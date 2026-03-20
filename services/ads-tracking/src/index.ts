/**
 * Ads Tracking Service
 *
 * Connects to Meta Graph API and TikTok Marketing API to sync spend automatically.
 * Links LiveSession dates and individual Leads to active AdSets to derive granular CPL.
 */

import Fastify from 'fastify';
import axios from 'axios';
import { prisma, LiveSession } from '@xhi/database';

const PORT = parseInt(process.env.PORT || '3002', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Environment variables configured (no hardcoding of tokens per Speckit Hardening)
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

const server = Fastify({ logger: true });

// ═══════════════════════════════════════════════════════════════════════════
// External Connectors
// ═══════════════════════════════════════════════════════════════════════════

async function fetchMetaSpend(campaignId: string): Promise<number> {
  if (!META_ACCESS_TOKEN) return 0; // Skip if no token configured
  try {
    // Webhook/Polling Meta Graph API Insights
    const res = await axios.get(`https://graph.facebook.com/v19.0/${campaignId}/insights`, {
      params: { access_token: META_ACCESS_TOKEN, fields: 'spend,impressions,clicks', date_preset: 'today' },
    });
    return parseFloat(res.data.data?.[0]?.spend || '0');
  } catch (error) {
    server.log.error(`[AdsTracking] Meta API Error: ${error}`);
    return 0; // Fail gracefully
  }
}

async function fetchTikTokSpend(campaignId: string): Promise<number> {
  if (!TIKTOK_ACCESS_TOKEN) return 0;
  try {
    const res = await axios.get('https://business-api.tiktok.com/open_api/v1.3/report/campaign/get/', {
      headers: { 'Access-Token': TIKTOK_ACCESS_TOKEN },
      params: { advertiser_id: process.env.TIKTOK_ADVERTISER_ID, campaign_ids: [campaignId] }
    });
    return parseFloat(res.data.data?.list?.[0]?.spend || '0');
  } catch (error) {
     server.log.error(`[AdsTracking] TikTok API Error: ${error}`);
     return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Attribution Logic (Core Requirement)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recalculates Ad Spend and Real-Time CPL matching the DB Lead count 
 * strictly during the Live Session interval duration.
 */
async function syncSessionAttribution(sessionId: string) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: { attribution: true }
  });

  if (!session || !session.attribution) return;

  // 1. Fetch live spend dynamically
  let currentSpend = session.attribution.spend;
  if (session.attribution.platform === 'meta') {
    currentSpend = await fetchMetaSpend(session.attribution.campaignId);
  } else if (session.attribution.platform === 'tiktok_ads') {
    currentSpend = await fetchTikTokSpend(session.attribution.campaignId);
  }

  // 2. Count ONLY leads that arrived strictly AT OR AFTER stream `startedAt`
  // and BEFORE stream `endedAt` (if stream ended)
  const leadCount = await prisma.lead.count({
    where: {
      sessionId: session.id,
      extractedAt: {
        gte: session.startedAt,
        ...(session.endedAt && { lte: session.endedAt })
      }
    }
  });

  // 3. Compute Real-time CPL
  const cpl = leadCount > 0 ? (currentSpend / leadCount) : 0;

  // 4. Update Attribution State
  await prisma.adAttribution.update({
    where: { id: session.attribution.id },
    data: { spend: currentSpend }
  });

  // 5. Update parent LiveSession metrics
  await prisma.liveSession.update({
    where: { id: session.id },
    data: { totalLeads: leadCount }
  });

  server.log.info(
    `[AdsTracking] Synced Session ${sessionId} | Leads: ${leadCount} | Spend: $${currentSpend} | CPL: $${cpl.toFixed(2)}`
  );

  return { currentSpend, leadCount, cpl };
}

// ═══════════════════════════════════════════════════════════════════════════
// Endpoints 
// ═══════════════════════════════════════════════════════════════════════════

server.get('/health', async () => ({ status: 'healthy', service: 'ads-tracking' }));

server.post('/sync/:sessionId', async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const result = await syncSessionAttribution(sessionId);
  if (!result) return reply.code(404).send({ error: 'Session or attribution not found' });
  
  return result;
});

const start = async () => {
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`[Service] Ads Tracking running at http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
