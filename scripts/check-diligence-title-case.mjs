#!/usr/bin/env node
/**
 * Diligence and shareable pages must load js/ui-title-case.js (owner requirement).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const DILIGENCE_PAGES = [
  'ontario-readiness.html',
  'strategic-partner-letter.html',
  'term-sheet.html',
  'valuation-equity-structure.html',
  'project-plan.html',
  'revenue-projection.html',
  'financial-model.html',
  'capital-deployment-detail.html',
  'capabilities.html',
  'evidence-binder.html',
  'ontario-self-assessment.html'
];

const errors = [];

for (const rel of DILIGENCE_PAGES) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    errors.push(`${rel}: missing file`);
    continue;
  }
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.includes('ui-title-case.js')) {
    errors.push(`${rel}: missing ui-title-case.js script (Title Case enforcement)`);
  }
}

if (errors.length) {
  console.error('check:diligence-title-case: FAILED\n');
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error('\nAdd: <script src="/js/ui-title-case.js" defer></script> per AGENT-HANDOVER.md Rule #2b');
  process.exit(1);
}

console.log(`check:diligence-title-case: OK (${DILIGENCE_PAGES.length} diligence pages)`);
