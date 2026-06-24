#!/usr/bin/env node
/** Capture 05-clinical-note.png only (heavy page: JPEG, subjective tab). */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.MANUAL_BASE_URL || 'https://mediforge-dev.netlify.app').replace(/\/$/, '');
const OUT = path.join(__dirname, '..', 'docs', 'user-manual', 'images');
const patientId = process.env.MANUAL_PATIENT_ID || 'MAP0001';
const visitDate = process.env.MANUAL_VISIT_DATE || new Date().toISOString().slice(0, 10);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 300000,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(
    `${BASE}/clinical-note?patientId=${encodeURIComponent(patientId)}&visitDate=${visitDate}`,
    { waitUntil: 'domcontentloaded', timeout: 120000 }
  );
  await delay(6000);
  await page.evaluate(() => {
    if (typeof window.switchClinicalTab === 'function') {
      window.switchClinicalTab('subjective');
    }
  });
  await delay(1500);
  const pngPath = path.join(OUT, '05-clinical-note.png');
  const buf = await page.screenshot({
    type: 'jpeg',
    quality: 85,
    fullPage: false,
    clip: { x: 0, y: 0, width: 1280, height: 720 },
    timeout: 120000,
  });
  fs.writeFileSync(pngPath, buf);
  console.log('wrote 05-clinical-note.png', fs.statSync(pngPath).size, 'bytes');
  await browser.close();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
