#!/usr/bin/env node
/**
 * Regenerate config/lab-code-map-canada.json from:
 *  - config/ohip-cpt-crosswalk-reference.json (platform OHIP crosswalk)
 *  - js/pricing.js lab catalog
 *  - js/patients.js imaging catalog
 *
 * Clinics never run or edit this — MediForge ships the generated file.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const { writeLabCodeMapCanada } = require('../lib/billing/generate-lab-code-map.js');

const { outPath, map } = writeLabCodeMapCanada({ repoRoot });

console.log('Generated:', outPath);
console.log('  Lab tests:', map.catalogLabCount);
console.log('  Imaging:', map.catalogImagingCount);
console.log('  Unmapped:', map.unmappedCount);
if (map.unmappedCount > 0) {
  console.warn('  Unmapped items (add to ohip-cpt-crosswalk-reference.json):');
  map.unmapped.forEach((u) => console.warn('   -', u.code, u.name, u.cpt || ''));
  process.exitCode = map.unmappedCount > 0 ? 0 : 0;
}
