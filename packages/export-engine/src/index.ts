/**
 * XHI Export Engine
 * Contains specialized generators to convert raw PostgreSQL Arrays
 * into portable buffers or automated API pushes (CSV, PDF, Google Sheets).
 */

import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { GoogleSpreadsheet } from 'google-spreadsheet';

export interface LeadRecord {
  id: string;
  phoneNumber: string;
  confidenceScore: number;
  platform: string;
  extractedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV Generation (Synchronous Buffer)
// ═══════════════════════════════════════════════════════════════════════════
export function generateCsv(leads: LeadRecord[]): Buffer {
  if (leads.length === 0) return Buffer.from('');

  const fields = ['id', 'phoneNumber', 'confidenceScore', 'platform', 'extractedAt'];
  const json2csvParser = new Parser({ fields });
  const csvStr = json2csvParser.parse(leads);

  return Buffer.from(csvStr, 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Generation (Speckit PDFKit Layout)
// ═══════════════════════════════════════════════════════════════════════════
export function generatePdf(leads: LeadRecord[], sessionTitle: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Front Matter: Header
    doc.fontSize(24).font('Helvetica-Bold').text('XHI NETWORK', { align: 'center' });
    doc.fontSize(12).font('Helvetica').fillColor('gray')
       .text('Verified Lead Extraction Report', { align: 'center' })
       .moveDown(2);

    doc.fontSize(14).fillColor('black').text(`Live Session: ${sessionTitle}`);
    doc.fontSize(10).fillColor('gray').text(`Total Extracted Leads: ${leads.length}`);
    doc.moveDown(2);

    // PDF Table Structure
    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 200;
    const col3X = 400;

    doc.fontSize(10).font('Helvetica-Bold')
       .text('Platform', col1X, tableTop)
       .text('Phone Number', col2X, tableTop)
       .text('Confidence', col3X, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;

    leads.forEach((lead) => {
      // Pagination handling
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.font('Helvetica').fillColor('black');
      doc.text(lead.platform.toUpperCase(), col1X, y);
      doc.text(lead.phoneNumber, col2X, y);
      
      const score = (lead.confidenceScore * 100).toFixed(0) + '%';
      if (lead.confidenceScore > 0.8) {
        doc.fillColor('green').text(score, col3X, y);
      } else {
        doc.fillColor('orange').text(score, col3X, y);
      }

      y += 20;
    });

    // Close and Flush stream
    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Google Sheets Automation
// ═══════════════════════════════════════════════════════════════════════════
export async function syncGoogleSheets(leads: LeadRecord[], gsheetId: string) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Service Account credentials missing in .env');
  }

  // Formatting Key since .env keys usually have literal \\n
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  const doc = new GoogleSpreadsheet(gsheetId);
  
  // Auth using JWT config method
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: privateKey,
  });

  await doc.loadInfo();
  
  // Check if first sheet is initialized
  let sheet = doc.sheetsByIndex[0];
  if (!sheet) {
    sheet = await doc.addSheet({ headerValues: ['id', 'phoneNumber', 'confidenceScore', 'platform', 'extractedAt'] });
  } else {
    // Attempt headers if empty
    try { await sheet.setHeaderRow(['id', 'phoneNumber', 'confidenceScore', 'platform', 'extractedAt']); } catch {}
  }

  // Map to flat object
  const rows = leads.map(l => ({
    id: l.id,
    phoneNumber: l.phoneNumber,
    confidenceScore: l.confidenceScore.toFixed(2),
    platform: l.platform,
    extractedAt: l.extractedAt.toISOString()
  }));

  // Append bulk
  await sheet.addRows(rows);
  return { success: true, count: rows.length };
}
