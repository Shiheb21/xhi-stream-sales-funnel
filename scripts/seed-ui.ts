/**
 * Localhost UI Verification & Seeding
 * Seeds the PostgreSQL database to verify Dashboard Ticker, History logic, and Settings persistence.
 */
import { prisma } from '@xhi/database';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('--- XHI Localhost DB Seeder ---');

  // Clear existing items recursively
  await prisma.lead.deleteMany();
  await prisma.liveSession.deleteMany();
  await prisma.userSettings.deleteMany();

  // 1. Create User Settings
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

  // 2. Create Active Live Session
  console.log('[Seed] Generating LiveSession...');
  const session = await prisma.liveSession.create({
    data: {
      id: `live_${uuidv4().substring(0, 8)}`,
      platform: 'tiktok',
      streamUrl: 'rtmp://seed-fake-stream',
      streamerName: 'Autumn Collection Launch',
      status: 'ACTIVE',
      totalComments: 1540,
      totalLeads: 50
    }
  });

  // 3. Create 50 Leads (Mixed Confidence for Demo Ticker)
  console.log(`[Seed] Generating 50 Leads for Session: ${session.id}...`);
  const leadsData = [];
  for (let i = 0; i < 50; i++) {
    // 80% High Confidence, 20% Low Confidence logic
    const score = Math.random() > 0.2 ? 0.85 + Math.random() * 0.14 : 0.4 + Math.random() * 0.3;
    
    leadsData.push({
      phoneNumber: `+21655${Math.floor(Math.random() * 900000 + 100000)}`,
      rawComment: `My number is ${Math.random()}`,
      platform: 'tiktok',
      commentId: uuidv4(),
      uniqueHash: uuidv4(),
      confidenceScore: score,
      sessionId: session.id,
      extractedAt: new Date(Date.now() - Math.floor(Math.random() * 600000))
    });
  }

  const result = await prisma.lead.createMany({ data: leadsData });
  console.log(`[Seed] ✅ Success! Integrated ${result.count} visual leads.`);
  console.log('--- DB Seeding Complete ---');
}

seed()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
