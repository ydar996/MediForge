/**
 * Browser test: address dropdown chains on user-facing pages.
 * Run: node scripts/test-address-dropdowns.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
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
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function countFilledOptions(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false, count: 0, disabled: null };
    const options = Array.from(el.options || []).filter((o) => o.value);
    return { found: true, count: options.length, disabled: el.disabled };
  }, selector);
}

async function waitForMinOptions(page, selector, min, label, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await countFilledOptions(page, selector);
    if (info.found && info.count >= min) return info;
    await new Promise((r) => setTimeout(r, 200));
  }
  const info = await countFilledOptions(page, selector);
  throw new Error(`${label}: expected >= ${min} options, got ${info.found ? info.count : 'missing selector'}`);
}

async function testChain(page, chain) {
  const { country, state, city, postal, label = 'address' } = chain;

  await page.waitForSelector(country, { timeout: 15000 });
  await waitForMinOptions(page, country, 5, `${label} country`);

  const currentCountry = await page.$eval(country, (el) => el.value);
  if (currentCountry !== 'Canada') {
    await page.select(country, 'Canada');
  }

  // Trigger change handlers when value was already Canada on init
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el?.dispatchEvent(new Event('change', { bubbles: true }));
  }, country);

  await new Promise((r) => setTimeout(r, 600));
  await waitForMinOptions(page, state, 5, `${label} state/province`);

  await page.select(state, 'Ontario');
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el?.dispatchEvent(new Event('change', { bubbles: true }));
  }, state);
  await new Promise((r) => setTimeout(r, 600));

  if (city) {
    const cityInfo = await countFilledOptions(page, city);
    if (cityInfo.disabled) {
      throw new Error(`${label} city: still disabled after selecting Ontario`);
    }
    await waitForMinOptions(page, city, 1, `${label} city`);
    const firstCity = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      for (const opt of el.options) {
        if (opt.value) return opt.value;
      }
      return null;
    }, city);
    if (!firstCity) throw new Error(`${label} city: no selectable value`);
    await page.select(city, firstCity);
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      el?.dispatchEvent(new Event('change', { bubbles: true }));
    }, city);
    await new Promise((r) => setTimeout(r, 400));
  }

  if (postal) {
    const postalInfo = await countFilledOptions(page, postal);
    if (postalInfo.disabled) {
      throw new Error(`${label} postal: still disabled after city selection`);
    }
    await waitForMinOptions(page, postal, 1, `${label} postal`);
  }
}

async function testPaymentSourceToggle(page) {
  const select = await page.$('#paymentSource');
  if (!select) return { skipped: true };

  const before = await page.evaluate(() => ({
    provincial: document.getElementById('provincial-health-panel')?.style.display,
    private: document.getElementById('private-insurance-panel')?.style.display,
  }));

  await page.select('#paymentSource', 'private');
  await new Promise((r) => setTimeout(r, 300));

  const afterPrivate = await page.evaluate(() =>
    document.getElementById('private-insurance-panel')?.style.display
  );
  if (afterPrivate === 'none') {
    throw new Error('paymentSource: private panel not visible after selecting private insurance');
  }

  await page.select('#paymentSource', 'provincial');
  await new Promise((r) => setTimeout(r, 300));

  const afterProvincial = await page.evaluate(() =>
    document.getElementById('provincial-health-panel')?.style.display
  );
  if (afterProvincial === 'none') {
    throw new Error('paymentSource: provincial panel not visible after selecting provincial');
  }

  return { skipped: false, before, afterPrivate, afterProvincial };
}

const PAGE_CASES = [
  {
    name: 'register.html (new org)',
    path: '/register.html',
    setup: async (page) => {
      await page.evaluate(() => {
        if (typeof window.selectPath === 'function') window.selectPath('new-org');
      });
    },
    chains: [{ label: 'org', country: '#country', state: '#state', city: '#org-city', postal: '#org-postal-code' }],
  },
  {
    name: 'add-patient.html',
    path: '/add-patient.html',
    setup: async (page) => {
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('user', JSON.stringify({ username: 'tester', role: 'Admin', org: 'Test Clinic' }));
      });
    },
    chains: [
      { label: 'patient', country: '#country', state: '#state', city: '#city', postal: '#postalCode' },
      { label: 'emergency', country: '#emergencyCountry', state: '#emergencyState' },
    ],
    paymentSource: true,
  },
  {
    name: 'patient-intake.html',
    path: '/patient-intake.html?org=00000000-0000-0000-0000-000000000001&orgName=Test%20Clinic',
    setup: async () => {},
    chains: [
      { label: 'patient', country: '#country', state: '#state', city: '#city', postal: '#postalCode' },
      { label: 'emergency', country: '#emergencyCountry', state: '#emergencyState', city: '#emergencyCity' },
    ],
    paymentSource: true,
  },
  {
    name: 'edit-patient.html',
    path: '/edit-patient.html?id=TEST001',
    setup: async (page) => {
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('user', JSON.stringify({ username: 'tester', role: 'Admin', org: 'Test Clinic' }));
      });
    },
    chains: [
      { label: 'patient', country: '#country', state: '#state', city: '#city', postal: '#postalCode' },
      { label: 'emergency', country: '#emergencyCountry', state: '#emergencyState' },
    ],
  },
  {
    name: 'specialist-register.html',
    path: '/specialist-register.html',
    setup: async (page) => {
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('user', JSON.stringify({ username: 'tester', role: 'Admin', org: 'Test Clinic' }));
      });
    },
    chains: [{ label: 'specialist', country: '#country', state: '#state' }],
  },
  {
    name: 'register-clinic.html',
    path: '/register-clinic.html',
    setup: async (page) => {
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('platformAdmin', JSON.stringify({ username: 'admin', role: 'platform_admin' }));
      });
    },
    chains: [{ label: 'clinic', country: '#country', state: '#state' }],
  },
  {
    name: 'edit-profile.html',
    path: '/edit-profile.html',
    setup: async (page) => {
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('user', JSON.stringify({
          username: 'tester',
          role: 'Admin',
          org: 'Test Clinic',
          email: 'test@example.com',
        }));
      });
    },
    chains: [{ label: 'org profile', country: '#country', state: '#state' }],
  },
];

async function runPageCase(browser, baseUrl, testCase) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('dialog', async (dialog) => dialog.dismiss());

  try {
    if (testCase.setup) {
      await testCase.setup(page);
    }

    const response = await page.goto(`${baseUrl}${testCase.path}`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    if (!response || response.status() >= 400) {
      throw new Error(`HTTP ${response?.status() ?? 'no response'} for ${testCase.path}`);
    }

    await new Promise((r) => setTimeout(r, 2500));

    for (const chain of testCase.chains) {
      await testChain(page, chain);
    }

    if (testCase.paymentSource) {
      await testPaymentSourceToggle(page);
    }

    const blockingErrors = errors.filter((e) =>
      !/supabase|Failed to fetch|organization|patient not found|loadUserProfile|loadEditForm/i.test(e)
    );
    if (blockingErrors.length) {
      throw new Error(`JS errors: ${blockingErrors.join(' | ')}`);
    }

    return { name: testCase.name, ok: true };
  } catch (error) {
    return { name: testCase.name, ok: false, error: error.message, jsErrors: errors };
  } finally {
    await page.close();
  }
}

async function main() {
  const { server, port } = await startStaticServer(REPO_ROOT);
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Serving ${REPO_ROOT} at ${baseUrl}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  try {
    for (const testCase of PAGE_CASES) {
      process.stdout.write(`Testing ${testCase.name}... `);
      const result = await runPageCase(browser, baseUrl, testCase);
      results.push(result);
      console.log(result.ok ? 'PASS' : `FAIL\n  ${result.error}`);
      if (!result.ok && result.jsErrors?.length) {
        result.jsErrors.slice(0, 5).forEach((e) => console.log(`  ${e}`));
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Summary ---');
  results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));

  if (failed.length) {
    process.exitCode = 1;
    console.error(`\n${failed.length} page(s) failed dropdown tests.`);
  } else {
    console.log(`\nAll ${results.length} pages passed dropdown tests.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
