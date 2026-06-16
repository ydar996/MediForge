#!/usr/bin/env node
/**
 * Generate BC (MSP), AB (AHCIP), QC (RAMQ) lab crosswalk references from
 * Ontario OHIP reference + provincial-lab-fee-overrides.json + diagnostic catalog.
 *
 * Run: npm run build:provincial-lab-crosswalks
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const configDir = path.join(repoRoot, 'config');

const PROVINCE_FILES = {
  ON: 'ohip-cpt-crosswalk-reference.json',
  BC: 'msp-cpt-crosswalk-reference.json',
  AB: 'ahcip-cpt-crosswalk-reference.json',
  QC: 'ramq-cpt-crosswalk-reference.json'
};

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(configDir, file), 'utf8'));
}

function cptCategoryMap() {
  const catalog = loadJson('diagnostic-lab-catalog.json');
  const map = new Map();
  for (const t of catalog.tests || []) {
    const cpt = String(t.cpt || '').split('/')[0];
    if (cpt) map.set(cpt, t.category);
    if (String(t.cpt || '').includes('/')) {
      map.set(String(t.cpt).replace(/\s+/g, ''), t.category);
    }
  }
  return map;
}

function buildProvincialRef(province, ohipRef, overrides, cptCategories) {
  const cfg = overrides.provinces[province];
  if (!cfg) throw new Error(`No overrides for ${province}`);

  const byCpt = {};
  for (const [cpt, ohipCode] of Object.entries(ohipRef.byCpt || {})) {
    byCpt[cpt] = cfg.byCpt?.[cpt] || cfg.categoryDefaults?.[cptCategories.get(cpt)] || ohipCode;
  }
  for (const [cpt, code] of Object.entries(cfg.byCpt || {})) {
    byCpt[cpt] = code;
  }

  const panels = (ohipRef.panels || []).map((p) => {
    const key = p.cpt.replace(/\s+/g, '');
    const fee = cfg.panelOverrides?.[key] || cfg.panelOverrides?.[p.cpt] || byCpt[key.split('/')[0]] || p.ohip;
    return { ...p, feeCode: fee, [province === 'ON' ? 'ohip' : 'feeCode']: fee };
  });

  const imagingByCpt = { ...(ohipRef.imagingByCpt || {}) };
  for (const [cpt, code] of Object.entries(cfg.imagingByCpt || {})) {
    imagingByCpt[cpt] = code;
  }
  for (const [cpt, ohipCode] of Object.entries(ohipRef.imagingByCpt || {})) {
    if (!imagingByCpt[cpt]) {
      imagingByCpt[cpt] = cfg.imagingByCpt?.[cpt] || cfg.categoryDefaults?.Imaging || ohipCode;
    }
  }

  return {
    version: overrides.version || ohipRef.version,
    province,
    codeSystem: cfg.codeSystem,
    payer: cfg.payer,
    maintainer: 'MediForge',
    description: `Platform CPT → ${cfg.codeSystem} crosswalk (${province}). Auto-generated from provincial-lab-fee-overrides.json`,
    byCpt,
    panels: panels.map((p) => ({
      cpt: p.cpt,
      feeCode: p.feeCode || p.ohip,
      name: p.name
    })),
    byTestName: { ...(ohipRef.byTestName || {}) },
    imagingByCpt
  };
}

const ohipRef = loadJson(PROVINCE_FILES.ON);
const overrides = loadJson('provincial-lab-fee-overrides.json');
const cptCategories = cptCategoryMap();

for (const province of ['BC', 'AB', 'QC']) {
  const ref = buildProvincialRef(province, ohipRef, overrides, cptCategories);
  const outFile = PROVINCE_FILES[province];
  fs.writeFileSync(path.join(configDir, outFile), JSON.stringify(ref, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outFile} (${Object.keys(ref.byCpt).length} CPT mappings)`);
}

console.log('Provincial lab crosswalk references updated.');
