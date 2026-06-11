#!/usr/bin/env node
/**
 * Generate MediForge Brochure PDF using Puppeteer
 * Run: npx puppeteer node scripts/generate-brochure-pdf.js
 * Or:  node scripts/generate-brochure-pdf.js  (if puppeteer is installed)
 *
 * Output: MediForge-Brochure-Puppeteer.pdf in project root
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BROCHURE_URL = process.env.BROCHURE_URL || 'https://mediforge-dev.netlify.app/brochure';
const OUTPUT_PATH = path.join(__dirname, '..', 'MediForge-Brochure-Puppeteer.pdf');

async function generatePDF() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });

  try {
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600 });

    console.log('Loading brochure:', BROCHURE_URL);
    await page.goto(BROCHURE_URL, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for content to render
    await page.waitForSelector('main.container', { timeout: 10000 });

    // Generate PDF
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
    console.error('Error generating PDF:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generatePDF();
