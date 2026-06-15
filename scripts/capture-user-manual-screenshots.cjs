#!/usr/bin/env node
/**
 * Capture screenshots for docs/user-manual/images/
 * npm run manual:screenshots
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const NAV = { waitUntil: 'domcontentloaded', timeout: 90000 };

async function goto(page, url) {
  await page.goto(url, NAV);
  await delay(1500);
}
const OUT_DIR = path.join(__dirname, '..', 'docs', 'user-manual', 'images');
const BASE = (process.env.MANUAL_BASE_URL || 'https://mediforge-dev.netlify.app').replace(/\/$/, '');
const PLATFORM = process.argv.includes('--platform');
const SEED_AUTH = process.argv.includes('--seed-auth');

function seedDevSession() {
  return () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        username: 'manual-screenshots',
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

const clinicUser = process.env.MANUAL_USERNAME;
const clinicPass = process.env.MANUAL_PASSWORD;
const platformUser = process.env.MANUAL_PLATFORM_USERNAME;
const platformPass = process.env.MANUAL_PLATFORM_PASSWORD;

async function shot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('  wrote', name);
}

async function loginClinic(page) {
  if (!clinicUser || !clinicPass) {
    throw new Error('Set MANUAL_USERNAME and MANUAL_PASSWORD for clinic screenshots.');
  }
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('#username', clinicUser, { delay: 30 });
  await page.type('#password', clinicPass, { delay: 30 });
  await page.click('button.login-button, #login-form button[type="submit"]');
  try {
    await page.waitForFunction(
      () => {
        const p = window.location.pathname;
        return /\/dashboard/i.test(p) || /select-medical-specialty/i.test(p);
      },
      { timeout: 90000, polling: 500 }
    );
  } catch {
    await delay(8000);
  }
  const url = page.url();
  if (/\/login/i.test(url)) {
    const errText = await page.evaluate(() => {
      const el = document.querySelector('.error, [role="alert"], .login-error');
      return el ? el.textContent.trim() : '';
    });
    throw new Error(
      'Login failed — still on login page.' +
        (errText ? ` Message: ${errText}` : ' Check MANUAL_USERNAME / MANUAL_PASSWORD.')
    );
  }
  await delay(2000);
}

async function loginPlatform(page) {
  if (!platformUser || !platformPass) {
    throw new Error('Set MANUAL_PLATFORM_USERNAME and MANUAL_PLATFORM_PASSWORD.');
  }
  await page.goto(`${BASE}/platform-login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('#username', platformUser, { delay: 20 });
  await page.type('#password', platformPass, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
    page.click('#platform-login-form button[type="submit"]'),
  ]);
  await delay(2000);
}

async function connectToExistingChrome() {
  const url = process.env.MANUAL_CHROME_URL || 'http://127.0.0.1:9222';
  const browser = await puppeteer.connect({ browserURL: url, protocolTimeout: 120000 });
  const pages = await browser.pages();
  const match = pages.find((p) => p.url().includes('mediforge'));
  return { browser, page: match || pages[0], attached: true };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const useChrome = process.argv.includes('--connect') || process.env.MANUAL_USE_CHROME === '1';
  let browser;
  let page;
  let attached = false;

  if (useChrome) {
    console.log('Connecting to your open Chrome (remote debugging)…');
    ({ browser, page, attached } = await connectToExistingChrome());
    if (!page) throw new Error('No Chrome tab found. See docs/user-manual/README-SCREENSHOTS.md');
    console.log('Using tab:', page.url());
  } else {
    browser = await puppeteer.launch({
      headless: 'new',
      protocolTimeout: 180000,
      args: ['--no-sandbox'],
    });
    page = await browser.newPage();
    if (SEED_AUTH) {
      await page.evaluateOnNewDocument(seedDevSession());
    }
  }
  await page.setViewport({ width: 1280, height: 800 });

  if (PLATFORM) {
    console.log('Platform admin screenshots…');
    await loginPlatform(page);
    await page.goto(`${BASE}/platform-dashboard`, { waitUntil: 'networkidle2' });
    await shot(page, '13-platform-dashboard.png');
    await browser.close();
    return;
  }

  console.log('Clinic user screenshots from', BASE);

  if (attached && /mediforge/i.test(page.url()) && !/\/login/i.test(page.url())) {
    console.log('Using your existing logged-in session (no password needed).');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' }).catch(() => {});
    await shot(page, '01-login.png');
  } else {
    await goto(page, `${BASE}/login`);
    await shot(page, '01-login.png');
    if (SEED_AUTH) {
      console.log('Using dev session seed (no password). Pages may show empty data.');
      await page.evaluate(seedDevSession());
    } else if (!attached) {
      await loginClinic(page);
    } else {
      console.log('Connected Chrome is not logged in — log in on dev, then re-run with --connect');
      await browser.disconnect();
      process.exit(1);
    }
  }

  await goto(page, `${BASE}/dashboard`);
  await delay(500);
  await shot(page, '02-dashboard.png');
  try {
    await page.evaluate(() => {
      const btn = document.getElementById('icd-coding-standard-btn');
      if (btn) btn.scrollIntoView({ block: 'center' });
    });
    await delay(800);
    await shot(page, '18-icd-settings.png');
  } catch (e) {
    console.log('  (ICD settings screenshot skipped:', e.message, ')');
  }

  await goto(page, `${BASE}/register`);
  await shot(page, '13-register.png');

  await goto(page, `${BASE}/add-patient`);
  await delay(1000);
  await shot(page, '14-add-patient.png');
  try {
    await page.evaluate(() => {
      const med = document.getElementById('med-name');
      if (med) med.scrollIntoView({ block: 'center' });
    });
    await delay(500);
    await shot(page, '15-manual-medication.png');
  } catch (e) {
    console.log('  (medication screenshot skipped:', e.message, ')');
  }

  await goto(page, `${BASE}/patient-intake`);
  await shot(page, '16-patient-intake.png');

  await goto(page, `${BASE}/patients`);
  await delay(1000);
  await shot(page, '03-patients.png');

  try {
    await page.waitForSelector('button[onclick*="viewPatient"]', { timeout: 25000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}),
      page.click('button[onclick*="viewPatient"]'),
    ]);
    await delay(2500);
    await shot(page, '04-patient-details.png');

    const patientId =
      new URL(page.url()).searchParams.get('id') ||
      new URL(page.url()).searchParams.get('patientId') ||
      process.env.MANUAL_PATIENT_ID ||
      '';
    if (patientId) {
      const visitDate = new Date().toISOString().slice(0, 10);
      await goto(
        page,
        `${BASE}/clinical-note?patientId=${encodeURIComponent(patientId)}&visitDate=${visitDate}`
      );
      await delay(3000);
      await shot(page, '05-clinical-note.png');

      try {
        await page.evaluate(() => {
          if (typeof window.switchClinicalTab === 'function') {
            window.switchClinicalTab('preventive-gaps');
          }
          const toggle = document.getElementById('toggle-preventive-gaps-btn');
          const container = document.getElementById('preventive-gaps-container');
          if (toggle && container && container.style.display === 'none') toggle.click();
        });
        await delay(2500);
        await shot(page, '20-preventive-gaps.png');
      } catch (e) {
        console.log('  (preventive gaps screenshot skipped:', e.message, ')');
      }

      await goto(
        page,
        `${BASE}/prescription.html?patientId=${encodeURIComponent(patientId)}`
      );
      await delay(3500);
      await shot(page, '19-prescription.png');
    }
  } catch (e) {
    console.log('  (could not open patient chart:', e.message, ')');
    const fallbackId = process.env.MANUAL_PATIENT_ID || 'MAP0001';
    if (fallbackId && !fs.existsSync(path.join(OUT_DIR, '05-clinical-note.png'))) {
      try {
        const visitDate = new Date().toISOString().slice(0, 10);
        await goto(
          page,
          `${BASE}/clinical-note?patientId=${encodeURIComponent(fallbackId)}&visitDate=${visitDate}`
        );
        await delay(3000);
        await shot(page, '05-clinical-note.png');
        await page.evaluate(() => {
          if (typeof window.switchClinicalTab === 'function') window.switchClinicalTab('preventive-gaps');
          const toggle = document.getElementById('toggle-preventive-gaps-btn');
          const container = document.getElementById('preventive-gaps-container');
          if (toggle && container && container.style.display === 'none') toggle.click();
        });
        await delay(2500);
        await shot(page, '20-preventive-gaps.png');
        await goto(page, `${BASE}/prescription.html?patientId=${encodeURIComponent(fallbackId)}`);
        await delay(3500);
        await shot(page, '19-prescription.png');
      } catch (e2) {
        console.log('  (clinical note / Rx fallback skipped:', e2.message, ')');
      }
    }
  }

  for (const [file, route] of [
    ['06-appointments.png', '/appointments'],
    ['07-billing.png', '/billing-dashboard'],
    ['08-quick-checkout.png', '/quick-checkout'],
    ['09-messages.png', '/messages'],
    ['10-patient-portal.png', '/setup-patient-portal'],
    ['17-intake-approvals.png', '/patient-intake-approvals'],
    ['12-org-users.png', '/org-user-management'],
  ]) {
    await goto(page, `${BASE}${route}`);
    await shot(page, file);
  }

  const missing = ['04-patient-details.png', '05-clinical-note.png', '19-prescription.png', '20-preventive-gaps.png'].filter(
    (f) => !fs.existsSync(path.join(OUT_DIR, f))
  );
  if (missing.length) console.log('\nMissing:', missing.join(', '));
  else console.log('\nAll patient/clinical screenshots captured.');

  if (attached) await browser.disconnect();
  else await browser.close();
  console.log('Done. Images in docs/user-manual/images/');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
