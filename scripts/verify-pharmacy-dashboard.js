#!/usr/bin/env node
/**
 * Verifies pharmacy-dashboard loads without JS errors (especially DRUG_DATABASE duplicate).
 * Run: node scripts/verify-pharmacy-dashboard.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3847;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let p = req.url === '/' ? '/pharmacy-dashboard.html' : req.url;
  p = path.join(ROOT, p.split('?')[0]);
  if (!p.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(p, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(p);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(PORT, async () => {
  console.log(`Server: http://localhost:${PORT}/pharmacy-dashboard.html`);
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && (text.includes('DRUG_DATABASE') || text.includes('SyntaxError') || text.includes('already been declared'))) {
        errors.push(text);
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });
    await page.goto(`http://localhost:${PORT}/pharmacy-dashboard.html`, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });
    await new Promise((r) => setTimeout(r, 2000));
    await browser.close();
    server.close();

    if (errors.length) {
      console.error('\n❌ ERRORS FOUND:');
      errors.forEach((e) => console.error(' ', e));
      process.exit(1);
    }
    console.log('\n✅ No DRUG_DATABASE or SyntaxError in console.');
    console.log('✅ Page loaded. Pharmacy dashboard should render.');
    process.exit(0);
  } catch (e) {
    server.close();
    console.error('Verification failed:', e.message);
    process.exit(1);
  }
});
