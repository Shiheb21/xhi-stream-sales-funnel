import Fastify from 'fastify';
import { prisma } from '@xhi/database';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import dotenv from 'dotenv';
dotenv.config();

const app = Fastify({ logger: true });

// Export Controller Handling the 3 Formats
app.get('/api/export', async (request, reply) => {
  const { id, format } = request.query as { id: string, format: string };

  if (!id || !format) {
    return reply.status(400).send({ error: 'Missing id or format (?id=XXX&format=csv)' });
  }

  // Fetch session & leads
  const session = await prisma.liveSession.findUnique({ where: { id } });
  const leads = await prisma.lead.findMany({ where: { sessionId: id } });

  if (leads.length === 0) {
    return reply.status(404).send({ error: 'No structured leads found for this session.' });
  }

  // 1. CSV Logic
  if (format === 'csv') {
    const fields = ['id', 'phoneNumber', 'confidenceScore', 'platform', 'extractedAt'];
    const parser = new Parser({ fields });
    const csvBuffer = Buffer.from(parser.parse(leads), 'utf-8');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${id}_Leads.csv"`);
    return reply.send(csvBuffer);
  }

  // 2. PDF Logic
  if (format === 'pdf') {
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${id}_Report.pdf"`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      let chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        resolve(reply.send(Buffer.concat(chunks)));
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('XHI Live Lead Extraction Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Live Name: ${session?.streamerName || 'Unknown Session'}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.text(`Total Leads: ${leads.length}`);
      doc.moveDown(2);

      // Table Headers
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Platform', 50, doc.y);
      doc.text('Phone Number', 150, doc.y);
      doc.text('Confidence Score', 350, doc.y);
      doc.moveDown();
      doc.font('Helvetica');

      // Table Rows
      let rowY = doc.y;
      leads.forEach((l) => {
        if (rowY > 700) { doc.addPage(); rowY = 50; }
        doc.text(l.platform.toUpperCase(), 50, rowY);
        doc.text(l.phoneNumber, 150, rowY);
        doc.text((l.confidenceScore * 100).toFixed(0) + '%', 350, rowY);
        rowY += 20;
      });

      doc.end();
    });
  }

  // 3. Google Sheets Logic
  if (format === 'gsheet') {
    const userSettings = await prisma.userSettings.findFirst();
    if (!userSettings?.gsheetId) {
      return reply.status(400).send({ error: 'No Google Sheet ID attached to User Config.' });
    }

    const doc = new GoogleSpreadsheet(userSettings.gsheetId);
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    });

    await doc.loadInfo();
    let sheet = doc.sheetsByIndex[0];
    if (!sheet) sheet = await doc.addSheet({ headerValues: ['id', 'phoneNumber', 'confidenceScore', 'platform'] });

    const rows = leads.map(l => ({
      id: l.id,
      phoneNumber: l.phoneNumber,
      confidenceScore: l.confidenceScore,
      platform: l.platform
    }));

    await sheet.addRows(rows);
    return reply.send({ success: true, message: `Synced ${rows.length} leads to Google Sheets!` });
  }

  return reply.status(400).send({ error: 'Unsupported format' });
});

app.listen({ port: 3004, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`[Export Service] ExportManager listening at ${address}`);
});
