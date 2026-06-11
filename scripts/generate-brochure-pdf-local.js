#!/usr/bin/env node
/**
 * Generate MediForge Brochure PDF from LOCAL file (no server needed)
 * Run: npx puppeteer node scripts/generate-brochure-pdf-local.js
 *
 * Uses file:// protocol to load brochure.html directly.
 * Output: MediForge-Brochure-Puppeteer-Local.pdf in project root
 */

const puppeteer = require('puppeteer');
const path = require('path');

const BROCHURE_FILE = path.join(__dirname, '..', 'brochure.html');
const BROCHURE_URL = 'file://' + BROCHURE_FILE.replace(/\\/g, '/');
const OUTPUT_PATH = path.join(__dirname, '..', 'MediForge-Brochure-Puppeteer-Local.pdf');

async function generatePDF() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 1600 });

    console.log('Loading brochure from:', BROCHURE_FILE);
    await page.goto(BROCHURE_URL, {
      waitUntil: 'networkidle0',
      timeout: 15000
    });

    await page.waitForSelector('main.container', { timeout: 5000 });

    console.log('Generating PDF...');
    await page.pdf({
      path: OUTPUT_PATH,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size:9px; color:#666; width:100%; text-align:center; padding-top:5px;">MediForge Brochure | February 2026</div>',
      footerTemplate: '<div style="font-size:9px; color:#666; width:100%; text-align:center; padding-bottom:5px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span> | Work Chop Inc.</div>'
    });

    console.log('PDF saved to:', OUTPUT_PATH);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generatePDF();
