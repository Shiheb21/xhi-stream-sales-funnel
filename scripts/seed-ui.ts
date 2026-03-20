import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '../packages/database/node_modules/.prisma/client';

// Simple seeder using native node features to avoid monorepo linking issues during CLI execution
async function seed() {
  console.log('--- XHI Localhost DB Seeder (Pure Node) ---');

  const prisma = new PrismaClient();

  try {
    // Clear items
    console.log('[Seed] Wiping database...');
    await prisma.lead.deleteMany();
    await prisma.liveSession.deleteMany();
    await prisma.userSettings.deleteMany();

    // 1. Settings
    console.log('[Seed] Generating UserSettings...');
    await prisma.userSettings.create({
      data: {
        userId: 'admin_local_001',
        autoExportCsv: true,
        autoExportGsheet: false,
        notificationEmail: 'manager@xhi.tn',
        gsheetId: '1qP3...'
      }
    });

    // 2. Active Session
    console.log('[Seed] Generating LiveSession...');
    const sessionId = `live_${crypto.randomUUID().substring(0, 8)}`;
    const session = await prisma.liveSession.create({
      data: {
        id: sessionId,
        platform: 'tiktok',
        streamUrl: 'rtmp://seed-fake-stream',
        streamerName: 'Autumn Collection Launch',
        status: 'ACTIVE',
        totalComments: 1145,
        totalLeads: 50
      }
    });

    // 3. 50 leads
    console.log(`[Seed] Generating 50 Leads for Session: ${session.id}...`);
    const leadsData = [];
    for (let i = 0; i < 50; i++) {
        const score = Math.random() > 0.2 ? 0.85 + Math.random() * 0.14 : 0.4 + Math.random() * 0.3;
        leadsData.push({
            phoneNumber: `+21655${Math.floor(100000 + Math.random() * 900000)}`,
            rawComment: `Interested! My number is ${Math.random()}`,
            platform: 'tiktok',
            commentId: crypto.randomUUID(),
            uniqueHash: crypto.randomUUID(),
            confidenceScore: score,
            sessionId: session.id,
            extractedAt: new Date(Date.now() - Math.floor(Math.random() * 600000))
        });
    }

    const result = await prisma.lead.createMany({ data: leadsData });
    console.log(`[Seed] ✅ Success! Integrated ${result.count} visual leads.`);
    console.log('--- DB Seeding Complete ---');
  } catch (error) {
    console.error('Seed Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
