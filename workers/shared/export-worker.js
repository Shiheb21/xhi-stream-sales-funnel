const { parentPort, workerData } = require('worker_threads');
const { generatePdf } = require('@xhi/export-engine');

/**
 * Node.js Worker Thread
 * Offloads CPU-intensive PDFKit rendering for streams > 5,000 leads.
 */

async function run() {
  try {
    const { leads, sessionTitle } = workerData;
    const pdfBuffer = await generatePdf(leads, sessionTitle);
    
    // Pass buffer back to main thread
    parentPort.postMessage({ success: true, buffer: pdfBuffer });
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
}

run();
