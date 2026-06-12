/**
 * Fails CI/local check if user-facing HTML still contains obvious "?? / ?" icon placeholders.
 * Run: node scripts/check-user-facing-html-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Root-level HTML we treat as product UI (extend as needed). */
const USER_FACING_FILES = [
  "lab-order.html",
  "imaging-order.html",
  "patient-appointments.html",
  "patient-medications.html",
  "patient-results.html",
  "patient-change-password.html",
  "change-password.html",
  "clinical-note-clean.html",
  "legal-agreement-view.html",
  "legal-agreements-summary.html",
  "legal-agreements-org.html",
  "legal-agreements-admin.html",
  "data-download-approvals.html",
  "my-download-requests.html",
  "security-dashboard.html",
  "security-audit.html",
  "security-audit-simple.html",
  "audit-log.html",
  "conditions-breakdown.html",
  "condition-stats.html",
  "reports.html",
  "set-clinic-schedule.html",
  "pricing-catalog.html",
  "platform-dashboard-clean.html",
  "setup-encryption.html",
  "recover-encryption.html",
  "data-import-export.html",
  "deleted-patients.html",
  "dashboard.html",
  "messages.html",
  "index.html",
  "clinical-note.html",
  "patient-encounters.html",
  "disease-analytics.html",
  "platform-dashboard.html",
  "patient-dashboard.html",
  "patient-profile.html",
  "patient-summary.html",
  "register-clinic.html",
  "platform-settings.html",
  "healthcare-staff.html",
  "upcoming-appointments.html",
  "add-patient.html",
  "edit-patient.html",
  "prescription.html",
  "billing-dashboard.html",
  "discharge-summary.html",
  "physician-verification.html",
  "platform-physician-verification.html",
  "login.html",
  "register.html",
  "patient-intake.html",
  "legal-agreement-sign.html",
  "legal-agreement.html",
  "manage-clinics.html",
  "clinic-details.html",
  "all-payments.html",
  "payment-receipts.html",
  "subscription-invoice.html",
  "platform-analytics.html",
  "key-features-local.html",
  "about-us-local.html",
];

/** High-confidence UI corruption (not JS ?? nullish coalescing). */
const PATTERNS = [
  { name: "question-back", re: />\?\s+Back\b/ },
  { name: "h-tag-double-question", re: /<h[1-6][^>]*>\?\?/ },
  { name: "h-tag-single-question", re: /<h[1-6][^>]*>\?(?!\?|<\/)/ },
  { name: "button-double-question", re: /<button[^>]{0,800}>\?\?/ },
  { name: "button-single-question", re: /<button[^>]{0,800}>\?(?!\?|<\/)/ },
  { name: "anchor-double-question", re: /<a[^>]{0,400}>\?\?/ },
  { name: "anchor-single-question", re: /<a[^>]{0,400}>\?(?!\?|<\/)/ },
  { name: "label-single-question", re: /<label[^>]*>\?(?!\?)/ },
  { name: "option-double-question", re: /<option[^>]*>\?\?/ },
  { name: "empty-state-single-q", re: /empty-state-icon">\?</ },
  { name: "div-double-q-close", re: />\?\?\s*<\/div>/ },
  { name: "innerHTML-single-q", re: /innerHTML\s*=\s*['"`]\?['"`]/ },
  { name: "textContent-leading-q", re: /textContent\s*=\s*['"`]\?\s/ },
  { name: "alert-leading-q", re: /alert\s*\(\s*['"`]\?\s/ },
  { name: "template-li-leading-q", re: /`<li>\?\s/ },
];

let errors = 0;
for (const name of USER_FACING_FILES) {
  const fp = path.join(ROOT, name);
  if (!fs.existsSync(fp)) continue;
  const text = fs.readFileSync(fp, "utf8");
  const lines = text.split(/\r?\n/);
  for (const { name: pname, re } of PATTERNS) {
    lines.forEach((line, i) => {
      if (re.test(line)) {
        if (/console\.(log|warn|error|debug)\s*\(/.test(line)) return;
        if (/addSecurityItem\s*\([^)]*'\?/.test(line)) return;
        console.error(`${name}:${i + 1} [${pname}] ${line.trim().slice(0, 120)}`);
        errors++;
      }
    });
  }
}

if (errors) {
  console.error(`\ncheck-user-facing-html-icons: ${errors} issue(s). Fix placeholders or adjust allowlist.`);
  process.exit(1);
}
console.log(`check-user-facing-html-icons: OK (${USER_FACING_FILES.length} files).`);
