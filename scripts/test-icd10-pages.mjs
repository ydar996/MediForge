/**
 * Verify ICD-10-CA on all clinical pages.
 * Run: npm run test:icd10
 * Dev:  npm run test:icd10:dev
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const useDev = process.argv.includes('--dev');
const BASE = useDev ? 'https://mediforge-dev.netlify.app' : null;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const filePath = path.join(rootDir, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

const HTML_PAGES = [
  'add-patient.html',
  'patient-intake.html',
  'edit-patient.html',
  'patient-details.html',
  'clinical-note.html',
  'prescription.html',
  'patient-encounters.html',
  'select-referrals.html',
  'care-plan.html',
  'dashboard.html',
];

function checkHtmlIncludes() {
  const missing = [];
  for (const file of HTML_PAGES) {
    const html = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    if (!html.includes('icd-config.js')) missing.push(`${file}: missing icd-config.js`);
    if (file !== 'dashboard.html' && !html.includes('icd-selector.js')) {
      missing.push(`${file}: missing icd-selector.js`);
    }
    if (/src="js\/icd11\.js"/.test(html) && !html.includes('icd-config.js')) {
      missing.push(`${file}: loads icd11.js without icd-config.js`);
    }
  }
  return missing;
}

function seedAuth() {
  return () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        username: 'icd-tester',
        role: 'Admin',
        org: 'Test Clinic',
        organizationId: '00000000-0000-0000-0000-000000000001',
      })
    );
    localStorage.setItem(
      'organizations',
      JSON.stringify({
        'Test Clinic': {
          id: '00000000-0000-0000-0000-000000000001',
          settings: { icd_version: 'icd10ca' },
        },
      })
    );
  };
}

function isIcd10DiabetesCode(code) {
  return /^E(08|09|1[0-4]|14)/i.test(String(code || ''));
}

function isLikelyIcd11Code(code) {
  const c = String(code || '');
  return /^5A1/i.test(c) || /^XM/i.test(c) || /^SR/i.test(c) || /^[0-9][A-Z]/i.test(c);
}

async function loadAndValidateIcd10(page) {
  return page.evaluate(async () => {
    if (typeof window.loadIcdCodes !== 'function') {
      return { ok: false, error: 'loadIcdCodes missing' };
    }
    await window.loadIcdCodes();
    const version = window.MEDIFORGE_ICD_CONFIG?.version;
    const count = window.ICD10CA_CODES?.length || 0;
    const results =
      typeof window.searchLocalCodesOptimized === 'function'
        ? window.searchLocalCodesOptimized('diabetes', 15)
        : [];
    return { ok: true, version, count, results: results.slice(0, 5) };
  });
}

function assertDiabetesResults(name, core) {
  if (!core.ok) throw new Error(`${name}: ${core.error || 'load failed'}`);
  if (core.version !== 'icd10ca') throw new Error(`${name}: version=${core.version}`);
  if (core.count < 50000) throw new Error(`${name}: ICD10CA_CODES=${core.count}`);
  const diabetes = (core.results || []).filter((r) => isIcd10DiabetesCode(r.code));
  const icd11ish = (core.results || []).filter((r) => isLikelyIcd11Code(r.code));
  if (!diabetes.length) throw new Error(`${name}: no ICD-10 diabetes hits`);
  if (icd11ish.length) throw new Error(`${name}: ICD-11 codes: ${icd11ish.map((r) => r.code).join(', ')}`);
}

async function assertScriptsInFetchedHtml(baseUrl, name, path) {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes('icd-config.js')) throw new Error(`${name}: missing icd-config.js in response`);
  if (!html.includes('icd-selector.js')) throw new Error(`${name}: missing icd-selector.js in response`);
  if (/src="js\/icd11\.js"/.test(html) && !html.includes('icd-config.js')) {
    throw new Error(`${name}: loads icd11.js without icd-config.js`);
  }
}

async function assertScriptsOnPage(page, name) {
  const info = await page.evaluate(() => ({
    hasConfig: !!document.querySelector('script[src*="icd-config.js"]'),
    hasSelector: !!document.querySelector('script[src*="icd-selector.js"]'),
    version: window.MEDIFORGE_ICD_CONFIG?.version || null,
    hasLoader: typeof window.loadIcdCodes === 'function',
  }));
  if (!info.hasConfig) throw new Error(`${name}: icd-config.js not in page`);
  if (!info.hasSelector) throw new Error(`${name}: icd-selector.js not in page`);
  if (info.version && info.version !== 'icd10ca') {
    throw new Error(`${name}: config version=${info.version}`);
  }
  if (!info.hasLoader) throw new Error(`${name}: loadIcdCodes unavailable`);
}

async function runUiSearch(page, ui) {
  await page.waitForSelector(ui.input, { timeout: 20000 });
  await page.click(ui.input);
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.value = '';
  }, ui.input);
  await page.type(ui.input, 'diabetes', { delay: 10 });
  await new Promise((r) => setTimeout(r, 1200));

  if (ui.container) {
    await page.waitForFunction(
      (sel) => {
        const root = document.querySelector(sel);
        const list = root?.querySelector('ul');
        return list && list.style.display !== 'none' && /E(08|09|1[0-4]|14)/i.test(list.textContent || '');
      },
      { timeout: 45000 },
      ui.container
    );
    const snippet = await page.$eval(ui.container, (el) => (el.querySelector('ul')?.textContent || '').slice(0, 120));
    if (/5A1/i.test(snippet)) throw new Error(`UI shows ICD-11: ${snippet}`);
    return;
  }

  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el && el.style.display !== 'none' && /E(08|09|1[0-4]|14)/i.test(el.textContent || '');
    },
    { timeout: 45000 },
    ui.results
  );
  const snippet = await page.$eval(ui.results, (el) => el.textContent.slice(0, 120));
  if (/5A1/i.test(snippet)) throw new Error(`UI shows ICD-11: ${snippet}`);
}

const FULL_LOAD_PAGES = [
  {
    name: 'add-patient.html',
    path: '/add-patient.html',
    ui: { input: '#history-event', results: '#icd-results-history' },
  },
  {
    name: 'patient-intake.html',
    path: '/patient-intake.html?org=00000000-0000-0000-0000-000000000001&orgName=Test%20Clinic',
    ui: { input: '#history-event', results: '#icd-results-history' },
  },
  {
    name: 'prescription.html',
    path: '/prescription.html',
    prep: async (page) => {
      await new Promise((r) => setTimeout(r, 1000));
    },
    ui: { input: '#prescription-diagnosis', container: '#prescription-diagnosis-container' },
  },
];

const SCRIPT_ONLY_PAGES = [
  { name: 'edit-patient.html', path: '/edit-patient.html?id=TEST001' },
];

/** Heavy pages: verify deployed HTML includes ICD scripts (no full browser load). */
const FETCH_SCRIPT_PAGES = [
  { name: 'patient-encounters.html', path: '/patient-encounters.html' },
  { name: 'patient-details.html', path: '/patient-details.html?id=TEST001' },
  { name: 'clinical-note.html', path: '/clinical-note.html?patientId=TEST001' },
  { name: 'select-referrals.html', path: '/select-referrals.html' },
  { name: 'care-plan.html', path: '/care-plan.html?patientId=TEST001' },
];

async function main() {
  const htmlErrors = checkHtmlIncludes();
  if (htmlErrors.length) {
    console.error('HTML include check failed:');
    htmlErrors.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }
  console.log(`HTML includes: ${HTML_PAGES.length}/${HTML_PAGES.length} OK`);

  let server;
  let baseUrl = BASE;
  if (!baseUrl) {
    ({ server, port: baseUrl } = await startStaticServer(REPO_ROOT));
    baseUrl = `http://127.0.0.1:${baseUrl}`;
  }

  console.log(`Browser checks on ${baseUrl}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: 600000,
    userDataDir: path.join(os.tmpdir(), `mediforge-icd-test-${Date.now()}`),
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.evaluateOnNewDocument(seedAuth());

  let passed = 0;
  let total = 0;
  const failures = [];

  const runCase = async (label, fn) => {
    total += 1;
    process.stdout.write(`  ${label} ... `);
    try {
      await fn();
      passed += 1;
      console.log('OK');
    } catch (err) {
      failures.push({ name: label, error: err.message });
      console.log('FAIL');
      console.error(`    ${err.message}`);
    }
  };

  try {
    for (const pageCase of FULL_LOAD_PAGES) {
      await runCase(`${pageCase.name} (load+search)`, async () => {
        await page.goto(baseUrl + pageCase.path, { waitUntil: 'domcontentloaded', timeout: 90000 });
        if (pageCase.prep) await pageCase.prep(page);
        const core = await loadAndValidateIcd10(page);
        assertDiabetesResults(pageCase.name, core);
        if (pageCase.ui) {
          await runUiSearch(page, pageCase.ui);
        }
      });
    }

    for (const pageCase of SCRIPT_ONLY_PAGES) {
      await runCase(`${pageCase.name} (scripts)`, async () => {
        await page.goto(baseUrl + pageCase.path, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await assertScriptsOnPage(page, pageCase.name);
      });
    }

    for (const pageCase of FETCH_SCRIPT_PAGES) {
      await runCase(`${pageCase.name} (fetch)`, async () => {
        await assertScriptsInFetchedHtml(baseUrl, pageCase.name, pageCase.path);
      });
    }

    await runCase('dashboard.html (toggle)', async () => {
      await page.goto(baseUrl + '/dashboard.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(
        () => typeof window.MEDIFORGE_ICD_CONFIG !== 'undefined',
        { timeout: 20000 }
      );
      await page.waitForFunction(
        () => {
          const text = document.getElementById('icd-coding-standard-btn')?.textContent || '';
          return /ICD-10-CA|ICD-11/.test(text) && !/Loading/i.test(text);
        },
        { timeout: 30000 }
      );
      const version = await page.evaluate(() => window.MEDIFORGE_ICD_CONFIG?.version);
      if (version !== 'icd10ca') throw new Error(`config version=${version}`);
      const btnText = await page.$eval('#icd-coding-standard-btn', (el) => el.textContent);
      if (!/ICD-10-CA/i.test(btnText)) throw new Error(`button text: ${btnText}`);
    });
  } finally {
    await browser.close();
    if (server) server.close();
  }

  console.log(`\n${passed}/${total} checks passed`);
  if (failures.length) process.exit(1);
  console.log('All ICD-10-CA page checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
