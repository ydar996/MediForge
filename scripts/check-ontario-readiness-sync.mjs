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
  'term-sheet.html',
  'capabilities.html',
  'evidence-binder.html',
  'docs/strategic-partner/STRATEGIC-PARTNER-LETTER-2026-06.md',
  'docs/strategic-partner/VALUATION-AND-EQUITY-STRUCTURE.md',
  'docs/strategic-partner/TERM-SHEET-SEED-PREFERRED-SHARE.md',
  'docs/ONTARIO-EMR-READINESS-REPORT.md'
];

/** Diligence pages must cross-link valuation, term sheet, and certification path */
const MUST_LINK_VALUATION = [
  'ontario-readiness.html',
  'strategic-partner-letter.html',
  'evidence-binder.html',
  'capabilities.html',
  'docs/strategic-partner/STRATEGIC-PARTNER-LETTER-2026-06.md',
  'docs/ONTARIO-EMR-READINESS-REPORT.md'
];

const MUST_LINK_TERM_SHEET = MUST_LINK_VALUATION;

const MUST_LINK_PROJECT_PLAN = MUST_LINK_VALUATION;

const MUST_LINK_REVENUE = MUST_LINK_VALUATION;

const MUST_HAVE_CERT_PATH = [
  'ontario-readiness.html',
  'docs/ONTARIO-EMR-READINESS-REPORT.md',
  'evidence-binder.html'
];

/** Term sheet and valuation must agree on all shared seed financing facts */
const FINANCIAL_TERM_FILES = [
  'term-sheet.html',
  'valuation-equity-structure.html',
  'docs/strategic-partner/TERM-SHEET-SEED-PREFERRED-SHARE.md',
  'docs/strategic-partner/VALUATION-AND-EQUITY-STRUCTURE.md'
];

const FINANCIAL_CANONICAL = [
  { label: 'Pre-money $1.5M–$2.2M', pattern: /1,500,000.*2,200,000|\$1\.5M.*\$2\.2M/i },
  { label: 'Target ~$1.8M pre-money', pattern: /~\$1\.8M|~\$1\.8 million|1,800,000/i },
  { label: 'Investment $300k–$600k', pattern: /300,000.*600,000|\$300k.*\$600k/i },
  { label: 'Development fee $80k–$120k', pattern: /80,000.?[\$]?120,000/i },
  { label: 'Founder equity 65–75%', pattern: /65.75|65–75/i },
  { label: 'Founder target ~70%', pattern: /target ~70%/i },
  { label: 'Strategic Partner equity 20–30%', pattern: /20.30|20–30/i },
  { label: 'Option pool 10–15%', pattern: /10.15|10–15/i },
  { label: '4-year vesting', pattern: /4-year vesting/i },
  { label: '1-year cliff', pattern: /1-year cliff/i },
  { label: '40% at closing (dev fee)', pattern: /40%/i },
  { label: '18-month dev fee liquidation', pattern: /18 months/i },
  { label: '3-member board', pattern: /3 members/i },
  { label: 'Legal fees cap $15k–$25k', pattern: /15k.*25k|15,000.*25,000/i },
  { label: 'Fee note interest 8–12%', pattern: /8.12%/i },
  { label: 'Convertible discount 15–25%', pattern: /15.25%/i },
  { label: 'Milestone-linked tranches (not lump sum)', pattern: /milestone-linked tranche/i },
  { label: 'Capital deployment 25/25/30/20', pattern: /25%.*25%.*30%.*20%|25% \/ 25% \/ 30% \/ 20%/i }
];

const STALE_DEV_FEE = /100,000.?[\$]?120,000/i;

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

for (const rel of MUST_LINK_TERM_SHEET) {
  const text = read(rel);
  if (!text) continue;
  if (!text.includes('term-sheet')) {
    errors.push(`${rel}: missing link to /term-sheet`);
  }
}

for (const rel of MUST_LINK_PROJECT_PLAN) {
  const text = read(rel);
  if (!text) continue;
  if (!text.includes('project-plan')) {
    errors.push(`${rel}: missing link to /project-plan`);
  }
}

for (const rel of MUST_LINK_REVENUE) {
  const text = read(rel);
  if (!text) continue;
  if (!text.includes('revenue-projection')) {
    errors.push(`${rel}: missing link to /revenue-projection`);
  }
}

for (const rel of MUST_HAVE_CERT_PATH) {
  const text = read(rel);
  if (!text) continue;
  if (!text.includes('certification-path')) {
    errors.push(`${rel}: missing certification-path section or link`);
  }
}

for (const rel of FINANCIAL_TERM_FILES) {
  const text = read(rel);
  if (!text) continue;
  for (const check of FINANCIAL_CANONICAL) {
    if (!check.pattern.test(text)) {
      errors.push(`${rel}: missing ${check.label}`);
    }
  }
  if (STALE_DEV_FEE.test(text)) {
    errors.push(`${rel}: stale development fee $100,000–$120,000 — use $80,000–$120,000`);
  }
}

if (errors.length) {
  console.error('check-ontario-readiness-sync: FAILED\n');
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error('\nFix companions per Rule #3 (AGENT-HANDOVER.md) and .cursor/rules/ontario-readiness-sync.mdc');
  process.exit(1);
}

console.log(`check-ontario-readiness-sync: OK (${COMPANIONS.length} companions at ${CANONICAL.overallScore}, ${CANONICAL.phasesShort})`);
