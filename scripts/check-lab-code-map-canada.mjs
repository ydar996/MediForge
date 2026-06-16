#!/usr/bin/env node
/** Fail CI if lab-code-map-canada.json is out of date vs catalog + reference. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const { buildLabCodeMapCanada } = require('../lib/billing/generate-lab-code-map.js');

const outPath = path.join(repoRoot, 'config', 'lab-code-map-canada.json');
const fresh = buildLabCodeMapCanada({ repoRoot });
const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));

function stripVolatile(obj) {
  const { generatedAt, ...rest } = obj;
  return rest;
}

const a = JSON.stringify(stripVolatile(fresh));
const b = JSON.stringify(stripVolatile(existing));

if (a !== b) {
  console.error('lab-code-map-canada.json is out of date. Run: npm run generate:lab-codes');
  process.exit(1);
}

if (fresh.unmappedCount > 0) {
  console.warn(`Warning: ${fresh.unmappedCount} catalog item(s) lack OHIP mapping in platform reference.`);
}

console.log('lab-code-map-canada.json is up to date.');
