import assert from 'assert';
import http from 'http';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { app } from '../server/app.js';
import { initDb } from '../server/db.js';
import { verifyMagicBytes } from '../server/services/fileSecurity.js';

async function runPhase4Tests() {
  console.log('=== STARTING PHASE 4 UTILITIES & REAL FILE SMOKE TESTS ===');

  await initDb(':memory:');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3006, resolve));
  const base = 'http://localhost:3006';

  try {
    // 1. QR Code Studio Payload Validation Tests (all 7 types)
    const qrCases = [
      {
        type: 'url',
        data: { url: 'example.com/creator' },
        expected: 'https://example.com/creator',
      },
      {
        type: 'linktwin',
        data: { url: 'https://lt.example/abc123' },
        expected: 'https://lt.example/abc123',
      },
      {
        type: 'text',
        data: { text: 'VIP Backstage Pass' },
        expected: 'VIP Backstage Pass',
      },
      {
        type: 'email',
        data: { email: 'studio@linktwin.app', subject: 'Hello', body: 'World' },
        expected: 'mailto:studio@linktwin.app?subject=Hello&body=World',
      },
      {
        type: 'phone',
        data: { phone: '+1 (415) 555-0199' },
        expected: 'tel:+14155550199',
      },
      {
        type: 'wifi',
        data: { ssid: 'Studio;Net', encryption: 'WPA', password: 'secret\\pass', hidden: true },
        expected: 'WIFI:T:WPA;S:Studio\\;Net;P:secret\\\\pass;H:true;;',
      },
      {
        type: 'whatsapp',
        data: { phone: '+14155550199', message: 'Hi LinkTwin' },
        expected: 'https://wa.me/14155550199?text=Hi%20LinkTwin',
      },
    ];

    for (const tc of qrCases) {
      const res = await fetch(`${base}/api/utilities/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tc.type, data: tc.data }),
      });
      const json: any = await res.json();
      assert.strictEqual(res.status, 200, `QR type ${tc.type} failed: ${JSON.stringify(json)}`);
      assert.strictEqual(json.payload, tc.expected, `Unexpected QR payload for ${tc.type}`);
    }

    // Invalid QR inputs return clean 400 errors
    const invalidQrCases = [
      { type: 'url', data: { url: 'ftp://files.example.com' } },
      { type: 'email', data: { email: 'not-an-email' } },
      { type: 'phone', data: { phone: '12' } },
      { type: 'wifi', data: { ssid: '', encryption: 'WPA' } },
      { type: 'whatsapp', data: { phone: '123' } },
      { type: 'text', data: { text: '   ' } },
    ];
    for (const tc of invalidQrCases) {
      const res = await fetch(`${base}/api/utilities/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tc),
      });
      assert.strictEqual(res.status, 400, `Expected 400 for invalid QR ${tc.type}`);
    }
    console.log('[Pass 1] QR Code Studio API validated all 7 QR types & rejected malformed inputs');

    // 2. Social Preview Tester SSRF Hardening Tests
    const ssrfTargets = [
      'http://127.0.0.1:3006/health',
      'http://localhost:3006/api/links',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/admin',
      'http://[::1]:3006/',
      'http://[::ffff:7f00:1]/',
      'file:///etc/passwd',
    ];
    for (const target of ssrfTargets) {
      const res = await fetch(`${base}/api/utilities/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const text = await res.text();
      assert.strictEqual(res.status, 400, `Expected 400 SSRF block for ${target}, got ${res.status}: ${text}`);
      assert.ok(!text.includes('ECONNREFUSED'), 'Internal connection error leaked');
      assert.ok(!text.includes('stack'), 'Stack trace leaked');
    }
    console.log('[Pass 2] Social Preview Tester blocked loopback, metadata, IPv6 & file SSRF targets');

    // 3. Real File-Based Smoke Tests (JPG, PNG, PDF, MP4, MP3 + Spoof Rejection)
    // 3a. Real multi-page PDF built via pdf-lib -> re-saved with objectStreams -> verify page preservation
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 3; i++) {
      const page = pdfDoc.addPage([600, 400]);
      page.drawText(`LinkTwin Phase 4 Real PDF Smoke Test - Page ${i}`.repeat(6), {
        x: 30,
        y: 350,
        size: 12,
        font,
        color: rgb(0.1, 0.2, 0.3),
      });
    }
    const rawPdfBytes = await pdfDoc.save({ useObjectStreams: false });
    const loadedPdf = await PDFDocument.load(rawPdfBytes);
    assert.strictEqual(loadedPdf.getPageCount(), 3);
    const compressedPdfBytes = await loadedPdf.save({ useObjectStreams: true, objectsPerTick: 50 });
    const reloadedCompressed = await PDFDocument.load(compressedPdfBytes);
    assert.strictEqual(reloadedCompressed.getPageCount(), 3, 'Compressed PDF must preserve all pages');

    const pdfHex = Buffer.from(rawPdfBytes.slice(0, 16)).toString('hex');
    assert.strictEqual(verifyMagicBytes(pdfHex, 'pdf').valid, true, 'Real PDF magic bytes should pass');

    // Verify validate-signature endpoint for real headers of JPG, PNG, PDF, MP4, MP3
    const realFileSamples = [
      {
        filename: 'photo.jpg',
        mime: 'image/jpeg',
        category: 'image',
        headerHex: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString('hex'),
      },
      {
        filename: 'transparent-logo.png',
        mime: 'image/png',
        category: 'image',
        headerHex: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('hex'),
      },
      {
        filename: 'deck.pdf',
        mime: 'application/pdf',
        category: 'pdf',
        headerHex: pdfHex,
      },
      {
        filename: 'clip.mp4',
        mime: 'video/mp4',
        category: 'video',
        headerHex: Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]).toString('hex'),
      },
      {
        filename: 'voiceover.mp3',
        mime: 'audio/mpeg',
        category: 'audio',
        headerHex: Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]).toString('hex'),
      },
    ];

    for (const sample of realFileSamples) {
      const valRes = await fetch(`${base}/api/jobs/validate-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sample),
      });
      const valJson: any = await valRes.json();
      assert.strictEqual(valRes.status, 200, `Signature check failed for ${sample.filename}`);
      assert.strictEqual(valJson.valid, true);
    }

    // Spoofed Windows PE/MZ binary disguised as PDF rejected
    const spoofPdfRes = await fetch(`${base}/api/jobs/validate-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'invoice.pdf',
        mime: 'application/pdf',
        category: 'pdf',
        headerHex: '4d5a900003000000',
      }),
    });
    assert.strictEqual(spoofPdfRes.status, 400);
    console.log(
      `[Pass 3] Real file signatures (JPG/PNG/PDF/MP4/MP3) + pdf-lib compression (${rawPdfBytes.length}B -> ${compressedPdfBytes.length}B, pages=${reloadedCompressed.getPageCount()}) & spoof rejection passed`
    );

    // 4. File Compressor Job Telemetry & Ownership Cookie Check
    const jobRes = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'file-compressor',
        processingMode: 'browser-canvas',
        inputFilename: 'deck.pdf',
        inputMime: 'application/pdf',
        inputSize: rawPdfBytes.length,
        outputFormat: 'pdf',
        outputSize: compressedPdfBytes.length,
        headerHex: pdfHex,
        category: 'pdf',
      }),
    });
    assert.strictEqual(jobRes.status, 201);
    const jobJson: any = await jobRes.json();
    assert.strictEqual(jobJson.job.module, 'file-compressor');
    assert.strictEqual(jobJson.job.status, 'completed');
    const cookie = jobRes.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes(`lt_job_${jobJson.job.job_id}=`));

    // Cross-user access without cookie must return 403
    const unauthRes = await fetch(`${base}/api/jobs/${jobJson.job.job_id}`);
    assert.strictEqual(unauthRes.status, 403);
    console.log('[Pass 4] File Compressor job logging & ownership cookie isolation verified');

    console.log('\n🎉 ALL PHASE 4 UTILITIES TESTS PASSED!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runPhase4Tests().catch((err) => {
  console.error('❌ PHASE 4 TEST FAILED:', err);
  process.exit(1);
});
