#!/usr/bin/env node
/**
 * Rule #3 enforcement: Ontario readiness companion pages must stay in sync.
 * Canonical source: ontario-readiness.html (overall score + phase scope).
 *
 * Update CANONICAL below when readiness scores or phase scope change deliberately.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

/** Deliberate truth — update only when ontario-readiness.html changes */
const CANONICAL = {
  overallScore: '72–82%',
  phasesShort: 'Phases 0–8',
  phase8: 'Phase 8',
  phase7ChartFiling: /chart filing|File to chart|auto-file to patient chart/i
};

/** Each companion must include overall score and phase scope */
const COMPANIONS = [
  'ontario-readiness.html',
  'strategic-partner-letter.html',
  'capabilities.html',
  'docs/ONTARIO-EMR-READINESS-REPORT.md',
  'docs/strategic-partner/STRATEGIC-PARTNER-LETTER-2026-06.md',
  'docs/MEDIFORGE-CAPABILITIES-GUIDE.md',
  'docs/MEDIFORGE-AT-A-GLANCE.md',
  'docs/ONTARIOMD-GAP-REPORT.md',
  'docs/ONTARIOMD-READINESS-PLAN.md',
  'AGENT-HANDOVER.md'
];

/** Stale overall scores — scanned only in live companion pages/docs, not session-log history */
const STALE_SCAN_FILES = COMPANIONS.filter((f) => f !== 'AGENT-HANDOVER.md');

/** Lines containing these are historical session-log context, not live scores */
const STALE_LINE_ALLOW = [
  'Foundational',
  'foundational',
  'Historical snapshot',
  'at promotion was',
  'Session log',
  'was ~',
  'stale:',
  'Root cause',
  'flagged:',
  'not listed',
  'Fixed:',
  'June 2026:'
];

const STALE_OVERALL = ['70–80%', '70-80%', '60–70%', '50–60%', '50–55%'];

/** Accept en-dash or "to" spelling for overall score in gap report */
function hasCanonicalScore(text) {
  return text.includes(CANONICAL.overallScore) || text.includes('72 to 82%');
}

const PHASE7_CHART_FILES = [
  'strategic-partner-letter.html',
  'docs/strategic-partner/STRATEGIC-PARTNER-LETTER-2026-06.md',
  'capabilities.html',
  'docs/MEDIFORGE-CAPABILITIES-GUIDE.md',
  'evidence-binder.html'
];

/** Public Ontario pages must not use legacy "investor" wording (legacy URL redirects excepted in netlify.toml) */
const NO_INVESTOR_TERMS_FILES = [
  'ontario-readiness.html',
  'strategic-partner-letter.html',
  'valuation-equity-structure.html',
  'capabilities.html',
  'evidence-binder.html',
  'docs/strategic-partner/STRATEGIC-PARTNER-LETTER-2026-06.md',
  'docs/strategic-partner/VALUATION-AND-EQUITY-STRUCTURE.md',
  'docs/ONTARIO-EMR-READINESS-REPORT.md'
];

/** Diligence pages must cross-link valuation and certification path */
const MUST_LINK_VALUATION = [
  'ontario-readiness.html',
  'strategic-partner-letter.html',
  'evidence-binder.html',
  'capabilities.html',
  'docs/strategic-partner/STRATEGIC-PARTNER-LETTER-2026-06.md',
  'docs/ONTARIO-EMR-READINESS-REPORT.md'
];

const MUST_HAVE_CERT_PATH = [
  'ontario-readiness.html',
  'docs/ONTARIO-EMR-READINESS-REPORT.md',
  'evidence-binder.html'
];

const INVESTOR_WORD = /\binvestors?\b/i;

const errors = [];

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    errors.push(`${rel}: missing file`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

for (const rel of COMPANIONS) {
  const text = read(rel);
  if (!text) continue;
  if (!hasCanonicalScore(text)) {
    errors.push(`${rel}: missing canonical overall score "${CANONICAL.overallScore}"`);
  }
  if (!text.includes(CANONICAL.phasesShort) && !text.includes(CANONICAL.phase8)) {
    errors.push(`${rel}: missing phase scope ("${CANONICAL.phasesShort}" or "${CANONICAL.phase8}")`);
  }
}

for (const rel of STALE_SCAN_FILES) {
  const text = read(rel);
  if (!text) continue;
  for (const stale of STALE_OVERALL) {
    if (!text.includes(stale)) continue;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!line.includes(stale)) return;
      if (STALE_LINE_ALLOW.some((a) => line.includes(a))) return;
      errors.push(`${rel}:${i + 1}: stale overall score "${stale}" — use "${CANONICAL.overallScore}" or sub-pillar context only`);
    });
  }
}

for (const rel of PHASE7_CHART_FILES) {
  const text = read(rel);
  if (!text) continue;
  if (!CANONICAL.phase7ChartFiling.test(text)) {
    errors.push(`${rel}: missing Phase 7 chart filing mention (File to chart / chart filing / auto-file)`);
  }
}

for (const rel of NO_INVESTOR_TERMS_FILES) {
  const text = read(rel);
  if (!text) continue;
  if (INVESTOR_WORD.test(text)) {
    errors.push(`${rel}: contains legacy "investor" wording — use Strategic Partner`);
  }
}

for (const rel of MUST_LINK_VALUATION) {
  const text = read(rel);
  if (!text) continue;
  if (!text.includes('valuation-equity-structure')) {
    errors.push(`${rel}: missing link to /valuation-equity-structure`);
  }
}

for (const rel of MUST_HAVE_CERT_PATH) {
  const text = read(rel);
  if (!text) continue;
  if (!text.includes('certification-path')) {
    errors.push(`${rel}: missing certification-path section or link`);
  }
}

if (errors.length) {
  console.error('check-ontario-readiness-sync: FAILED\n');
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error('\nFix companions per Rule #3 (AGENT-HANDOVER.md) and .cursor/rules/ontario-readiness-sync.mdc');
  process.exit(1);
}

console.log(`check-ontario-readiness-sync: OK (${COMPANIONS.length} companions at ${CANONICAL.overallScore}, ${CANONICAL.phasesShort})`);
