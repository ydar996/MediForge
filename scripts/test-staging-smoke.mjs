/**
 * Staging smoke test: page assets, Race, ICD-10, manual medications.
 * Run: npm run test:staging-smoke
 */
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';

const BASE = 'https://mediforge-staging.netlify.app';

function seedAuth() {
  return () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        username: 'smoke-tester',
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

async function fetchOk(url, label) {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
}

async function main() {
  let passed = 0;
  let total = 0;
  const failures = [];

  const run = async (label, fn) => {
    total += 1;
    process.stdout.write(`  ${label} ... `);
    try {
      await fn();
      passed += 1;
      console.log('OK');
    } catch (err) {
      failures.push({ label, error: err.message });
      console.log('FAIL');
      console.error(`    ${err.message}`);
    }
  };

  console.log(`Staging smoke test: ${BASE}\n`);

  await run('icd-config.js asset', () => fetchOk(`${BASE}/js/icd-config.js`, 'icd-config'));
  await run('icd10ca.js asset', () => fetchOk(`${BASE}/js/icd10ca.js`, 'icd10ca'));
  await run('patient-reported-medication-search.js', () =>
    fetchOk(`${BASE}/js/patient-reported-medication-search.js`, 'med-search')
  );
  await run('patient-race-options.js', () =>
    fetchOk(`${BASE}/js/patient-race-options.js`, 'race-options')
  );

  await run('register.html loads (Canada + join path)', async () => {
    const res = await fetch(`${BASE}/register.html`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('step-join-org')) throw new Error('missing join-org step');
    if (!/Canada|canada/i.test(html)) throw new Error('Canada not referenced');
    if (!html.includes('postal')) throw new Error('postal code field missing');
  });

  await run('add-patient.html includes Race + ICD + meds', async () => {
    const res = await fetch(`${BASE}/add-patient.html`);
    const html = await res.text();
    if (!html.includes('icd-config.js')) throw new Error('missing icd-config.js');
    if (!html.includes('patient-race-options.js')) throw new Error('missing race options');
    if (!html.includes('patient-reported-medication-search.js')) throw new Error('missing med search');
    if (!html.includes('med-use-custom-name-btn') && !html.includes('Not in list')) {
      throw new Error('missing manual medication UX');
    }
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: 600000,
    userDataDir: path.join(os.tmpdir(), `mediforge-staging-smoke-${Date.now()}`),
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.evaluateOnNewDocument(seedAuth());

  try {
    await run('register page renders paths', async () => {
      await page.goto(`${BASE}/register.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#step-join-org', { timeout: 15000 });
      await page.waitForSelector('[onclick*="join-org"], .registration-path', { timeout: 10000 });
    });

    await run('add-patient: Race dropdown', async () => {
      await page.goto(`${BASE}/add-patient.html`, { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForSelector('#race', { timeout: 20000 });
      const options = await page.$$eval('#race option', (opts) =>
        opts.map((o) => o.textContent.trim()).filter(Boolean)
      );
      if (options.length < 2) throw new Error(`only ${options.length} race options`);
      if (!options.some((t) => /declined/i.test(t))) throw new Error('missing Declined to Disclose');
    });

    await run('add-patient: ICD-10 diabetes search', async () => {
      await page.waitForFunction(
        () => document.getElementById('history-event')?.dataset?.icdSearchBound === 'true',
        { timeout: 30000 }
      );
      const core = await page.evaluate(async () => {
        await window.loadIcdCodes();
        const count = window.ICD10CA_CODES?.length || 0;
        const version = window.MEDIFORGE_ICD_CONFIG?.version;
        const results =
          typeof window.searchLocalCodesOptimized === 'function'
            ? window.searchLocalCodesOptimized('diabetes', 15)
            : [];
        return { count, version, codes: results.map((r) => r.code) };
      });
      if (core.version !== 'icd10ca') throw new Error(`ICD version=${core.version}`);
      if (core.count < 50000) throw new Error(`ICD10CA_CODES=${core.count}`);
      if (!core.codes.some((c) => /^E(08|09|1[0-4]|14)/i.test(c))) {
        throw new Error(`no E11 diabetes codes: ${core.codes.join(', ')}`);
      }
      await page.evaluate(() => {
        const input = document.querySelector('#history-event');
        input.value = 'diabetes';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction(
        () => {
          const el = document.querySelector('#icd-results-history');
          return el && el.style.display !== 'none' && el.textContent.length > 10;
        },
        { timeout: 15000 }
      );
    });

    await run('add-patient: manual medication entry', async () => {
      await page.waitForSelector('#med-name', { timeout: 15000 });
      const customName = `SmokeTestMed-${Date.now()}`;
      await page.click('#med-name');
      await page.type('#med-name', customName, { delay: 10 });
      await page.waitForSelector('#med-use-custom-name-btn', { timeout: 10000 });
      await page.click('#med-use-custom-name-btn');
      await page.waitForFunction(
        (name) => document.querySelector('#med-name')?.value === name,
        { timeout: 10000 },
        customName
      );
      const dosageDisabled = await page.$eval('#med-dosage', (el) => el.disabled);
      if (dosageDisabled) throw new Error('dosage field still disabled after custom name');
      await page.type('#med-dosage', '10 mg daily', { delay: 10 });
    });

    await run('patient-intake.html loads Race + meds', async () => {
      await page.goto(
        `${BASE}/patient-intake.html?org=00000000-0000-0000-0000-000000000001&orgName=Test%20Clinic`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      );
      await page.waitForSelector('#race', { timeout: 20000 });
      await page.waitForSelector('#med-name', { timeout: 15000 });
      await page.waitForSelector('#med-use-custom-name-btn', { timeout: 10000 });
    });
  } finally {
    await browser.close();
  }

  console.log(`\n${passed}/${total} automated checks passed`);
  if (failures.length) {
    console.error('\nFailures:');
    failures.forEach((f) => console.error(`  - ${f.label}: ${f.error}`));
    process.exit(1);
  }

  console.log('\nManual checks still required (need real Staging login/org):');
  console.log('  - Register new clinic OR join with org code');
  console.log('  - Save add-patient to Supabase');
  console.log('  - Patient intake submit + staff approve');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
