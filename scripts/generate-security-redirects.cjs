#!/usr/bin/env node
/**
 * Generate Netlify _redirects rules to block internal/admin paths on public deploys.
 * Run: node scripts/generate-security-redirects.cjs
 * Keeps product pages (recover-encryption, platform-login, etc.) accessible.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_redirects');
const MARKER_START = '# --- SECURITY BLOCKS (auto-generated; do not edit by hand) ---';
const MARKER_END = '# --- END SECURITY BLOCKS ---';

/** Paths that must stay reachable on Netlify (pretty URLs without .html). */
const ALLOW = new Set([
  'recover-encryption',
  'setup-encryption',
  'platform-login',
  'platform-dashboard',
  'platform-settings',
  'platform-subscriptions',
  'platform-analytics',
  'platform-audit-log',
  'manage-clinics',
  'clinic-details',
  'register-clinic',
  'user-manual',
  'how-to-use-offline-capabilities',
  'brochure',
  'key-features',
  'about-us',
]);

const PREFIX_BLOCK = [
  'sql-scripts',
  'sync-upgrade-backup-20251021-202245',
  'docs',
];

const GLOB_BLOCK = [
  'unlock-*',
  'recover-*',
  'force-*',
  'diagnose-*',
  'debug-*',
  'test-*',
  'fix-*',
  'migrate-*',
  'clear-*',
  'find-missing-*',
  'populate-*',
  'direct-*',
  'create-auth-*',
  'create-test-*',
  'automated-audit*',
  'e2e-test-*',
  'performance-audit*',
  'security-audit*',
  'restore-tool*',
  'backup-tool*',
  'hybrid-solution*',
  'ultimate-fix*',
  'final-fix*',
  'get-org-id*',
  'investigate-*',
  'cleanup-*',
  'sync-localstorage*',
  'sync-user-profiles*',
  'sync-mobile*',
  'simple-mobile*',
  'mobile-sync*',
  'mobile-data*',
  'complete-backup*',
  'migrate-backup*',
  'migrate-users*',
  'migrate-complete*',
  'migrate-data*',
  'migrate-all*',
  'restore-working*',
  'restore-subscription*',
  'restore-appointments*',
  'check-ydar*',
  'check-supabase*',
  'check-mecure*',
  'check-deployment*',
  'check-and-migrate*',
  'verify-supabase*',
  'verify-fixes*',
  'verify-migration*',
  'verify-org*',
  'verify-audit*',
  'verify-message*',
  'generate-icons*',
  'generate-all*',
  'create-icon*',
  'ACTUALLY-*',
  'FINAL-*',
  'REALLY-*',
  'corrected-migration*',
  'execute-sql*',
  'final-ui-safe*',
  'final-working*',
  'simple-dob*',
  'simple-cleanup*',
  'unaddressed-patients*',
  'allergies-diagnostic*',
  'audit-localstorage*',
  'audit-hybrid*',
  'audit-mecure*',
  'color-scheme-examples-local*',
  'condition-patients*',
  'comprehensive-sync*',
  'delete-unknown*',
  'force-cache*',
  'reset-refresh*',
  'setup-test-patient*',
  'recover-patient-data*',
  'recover-lost-patient*',
  'recover-missing*',
  'recover-orphaned*',
  'create-user-for-org*',
  'find-organization-creator*',
  'fix-data-leakage*',
  'fix-database-leakage*',
  'fix-locked-account*',
  'fix-mobile-clinic*',
  'fix-patient-dob*',
  'fix-user-org*',
  'fix-all-organizations*',
  'fix-existing-patients*',
  'fix-login-schema*',
  'fix-auth-user*',
  'platform-dashboard-backup*',
  'platform-dashboard-clean*',
  'manage-clinics-backup*',
  'clinical-note-backup*',
  'clinical-note-clean*',
  'patient-encounters-backup*',
  'login-clean*',
  'test-clinic*',
  'test-patient*',
  'test-mobile*',
  'test-registration*',
  'test-supabase*',
  'test-security*',
  'test-system*',
  'test-functionality*',
  'test-buttons*',
  'test-recovery*',
  'test-manual*',
  'test-simple*',
  'test-failed*',
  'test-auto*',
  'test-abstraction*',
  'test-audit*',
  'test-zero*',
  'test-user*',
  'test-prescription*',
  'test-data*',
  'test-encryption*',
  'test-dashboard*',
  'debug-user*',
  'debug-localstorage*',
  'debug-mobile*',
  'debug-supabase*',
  'debug-dob*',
  'debug-login*',
];

const SECRET_FILES = [
  'supabase-credentials.txt',
  'supabase-credentials.local.txt',
  'Correct deployment pipeline.txt',
  'AGENT-HANDOVER.md',
  'DEPLOYMENT-HANDOVER.md',
  'HANDOVER-INSTRUCTIONS.md',
  'HANDOVER_INSTRUCTIONS.md',
];

function slugFromFile(file) {
  return file.replace(/\.html$/i, '');
}

function collectHtmlSlugs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (fs.statSync(full).isDirectory()) {
      if (rel.startsWith('node_modules') || rel.startsWith('.git')) continue;
      collectHtmlSlugs(full, acc);
    } else if (/\.html$/i.test(name)) {
      acc.push(rel);
    }
  }
  return acc;
}

function matchesGlob(slug, pattern) {
  const re = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    'i'
  );
  return re.test(slug);
}

function shouldBlock(slug) {
  if (ALLOW.has(slug)) return false;
  for (const p of PREFIX_BLOCK) {
    if (slug === p || slug.startsWith(p + '/')) return true;
  }
  const base = slug.split('/').pop();
  for (const g of GLOB_BLOCK) {
    if (matchesGlob(base, g) || matchesGlob(slug, g)) return true;
  }
  return false;
}

function linesForSlug(slug) {
  const rules = [];
  rules.push(`/${slug} /404.html 404!`);
  if (!slug.endsWith('.html')) {
    rules.push(`/${slug}.html /404.html 404!`);
  }
  return rules;
}

function main() {
  const htmlFiles = collectHtmlSlugs(ROOT);
  const blocked = new Set();

  for (const f of SECRET_FILES) {
    blocked.add(f);
  }

  for (const p of PREFIX_BLOCK) {
    blocked.add(`${p}/*`);
  }

  for (const rel of htmlFiles) {
    const slug = rel.replace(/\.html$/i, '');
    if (shouldBlock(slug)) blocked.add(slug);
  }

  const rules = [];
  rules.push(MARKER_START);
  rules.push('# Block leaked secrets and internal tools on public Netlify deploys.');
  rules.push('# Regenerate: node scripts/generate-security-redirects.cjs');
  rules.push('');

  for (const item of [...blocked].sort()) {
    if (item.endsWith('/*')) {
      rules.push(`/${item} /404.html 404!`);
    } else {
      rules.push(...linesForSlug(item));
    }
  }

  rules.push(MARKER_END);
  rules.push('');

  let existing = '';
  if (fs.existsSync(OUT)) {
    existing = fs.readFileSync(OUT, 'utf8');
    const start = existing.indexOf(MARKER_START);
    const end = existing.indexOf(MARKER_END);
    if (start !== -1 && end !== -1) {
      existing =
        existing.slice(0, start).trimEnd() +
        '\n\n' +
        rules.join('\n') +
        '\n' +
        existing.slice(end + MARKER_END.length).trimStart();
    } else {
      existing = existing.trimEnd() + '\n\n' + rules.join('\n') + '\n';
    }
  } else {
    existing = rules.join('\n') + '\n';
  }

  fs.writeFileSync(OUT, existing, 'utf8');
  const count = blocked.size;
  console.log(`Wrote ${OUT} (${count} blocked paths/patterns)`);
  console.log('Allowed exceptions:', [...ALLOW].join(', '));
}

main();
