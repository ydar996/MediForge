/**
 * Final pass: strip remaining ?? / ??? icon placeholders in logs, comments, and HTML strings.
 * Skips JavaScript nullish coalescing (foo ?? bar).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const I = {
  info: '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>',
  check: '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
  sync: '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>',
  search: '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>',
  warn: '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>',
  eye: '<i class="fa-solid fa-eye" aria-hidden="true"></i>',
  print: '<i class="fa-solid fa-print" aria-hidden="true"></i>',
  trash: '<i class="fa-solid fa-trash" aria-hidden="true"></i>',
  save: '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>',
  download: '<i class="fa-solid fa-download" aria-hidden="true"></i>',
  key: '<i class="fa-solid fa-key" aria-hidden="true"></i>',
};

function isNullishLine(line) {
  return /[\w?\)\]"']\s*\?\?\s*[\['"`\d\w.(]/.test(line) && !/(log|console|showResult|innerHTML|textContent|updateStatus|alert)\s*\(/.test(line);
}

function cleanQuestionRuns(text) {
  return text
    .replace(/\?{3,}\s*View/gi, `${I.eye} View`)
    .replace(/\?{3,}\s*Print/gi, `${I.print} Print`)
    .replace(/\?{3,}\s*Delete/gi, `${I.trash} Delete`)
    .replace(/\?{3,}\s*Preview/gi, `${I.eye} Preview`)
    .replace(/\?{3,}\s*Save/gi, `${I.save} Save`)
    .replace(/\?{3,}\s*Download/gi, `${I.download} Download`)
    .replace(/\?{3,}\s*Clear/gi, `${I.trash} Clear`)
    .replace(/\?{3,}\s*Refresh/gi, `${I.sync} Refresh`)
    .replace(/\?{3,}\s*Retry/gi, `${I.sync} Retry`)
    .replace(/\?{2,}\s*Refresh Page/gi, `${I.sync} Refresh Page`)
    .replace(/\?{2,}\s*Retry Connection/gi, `${I.sync} Retry Connection`)
    .replace(/\?{2,}\s*RESTORE ALL DATA/gi, `${I.sync} RESTORE ALL DATA`)
    .replace(/\?{2,}\s*Add New Prescription/gi, `${I.save} Add New Prescription`)
    .replace(/\?{2,}\s*Print\/Send Discharge Summary/gi, `${I.print} Print/Send Discharge Summary`)
    .replace(/\?{2,}\s*Create Prescription/gi, `${I.save} Create Prescription`)
    .replace(/\?{2,}\s*Schedule Follow-up Appointment/gi, `${I.sync} Schedule Follow-up Appointment`)
    .replace(/\?{2,}\s*Save Prescription/gi, `${I.save} Save Prescription`)
    .replace(/\?{2,}\s*Download As Image/gi, `${I.download} Download As Image`)
    .replace(/\?{2,}\s*Email/gi, `${I.info} Email`)
    .replace(/\?{2,}\s*Clear Form/gi, `${I.trash} Clear Form`)
    .replace(/\?{2,}\s*Auto-Detect/gi, `${I.search} Auto-Detect`)
    .replace(/\?{2,}\s*Fix Orphaned/gi, `${I.sync} Fix Orphaned`)
    .replace(/\?{2,}\s*Refresh Data/gi, `${I.sync} Refresh Data`)
    .replace(/\?{2,}\s*The organization/gi, `${I.check} The organization`)
    .replace(/\?{2,}\s*Querying/gi, "Querying")
    .replace(/\?{2,}\s*Count query/gi, "Count query")
    .replace(/\?{2,}\s*Data query/gi, "Data query")
    .replace(/\?{2,}\s*DUPLICATES FOUND/gi, "DUPLICATES FOUND")
    .replace(/\?{2,}\s*Creating user/gi, "Creating user")
    .replace(/\?{2,}\s*User creation/gi, "User creation")
    .replace(/\?{2,}\s*LOGIN CREDENTIALS/gi, "LOGIN CREDENTIALS")
    .replace(/\?{2,}\s*Checking if/gi, "Checking if")
    .replace(/\?{2,}\s*You can login/gi, "You can login")
    .replace(/\?{2,}\s*Email:/gi, "Email:")
    .replace(/\?{2,}\s*Password:/gi, "Password:")
    .replace(/\?{2,}\s*Error /gi, "Error ")
    .replace(/\?{2,}\s*Processing patient/gi, "Processing patient")
    .replace(/\?{2,}\s*COMPLETE MIGRATION/gi, "COMPLETE MIGRATION")
    .replace(/\?{2,}\s*Migrating /gi, "Migrating ")
    .replace(/\?{2,}\s*Error migrating/gi, "Error migrating")
    .replace(/\?{2,}\s*Patient /gi, "Patient ")
    .replace(/\?{2,}\s*Appointment /gi, "Appointment ")
    .replace(/\?{2,}\s*MIGRATION COMPLETE/gi, "MIGRATION COMPLETE")
    .replace(/\?{2,}\s*NO ORGANIZATIONS/gi, "NO ORGANIZATIONS")
    .replace(/\?{2,}\s*IMPORTANT NOTES/gi, "IMPORTANT NOTES")
    .replace(/\?{2,}\s*All data has been/gi, "All data has been")
    .replace(/\?{2,}\s*Supabase /gi, "Supabase ")
    .replace(/\?{3,}\s*Clearing/gi, "Clearing")
    .replace(/\?{3,}\s*Deleted cache/gi, "Deleted cache")
    .replace(/\?{3,}\s*Unregistered/gi, "Unregistered")
    .replace(/\?{3,}\s*Found \$\{/gi, "Found ${")
    .replace(/\?{3,}\s*Supabase:/gi, "Supabase:")
    .replace(/\?{3,}\s*Delet/gi, "Delet")
    .replace(/\?{3,}\s*Old security/gi, "Old security")
    .replace(/\/\/ \?\?\s*TRACE:/g, "// TRACE:")
    .replace(/\/\/ \?\?\s*/g, "// ")
    .replace(/console\.log\('\?\?\?\s*/g, "console.log('")
    .replace(/console\.log\(`\?\?\?\s*/g, "console.log(`")
    .replace(/log\('\?\?\?\s*/g, "log('")
    .replace(/log\(`\?\?\?\s*/g, "log(`")
    .replace(/log\('\?\?\s*/g, "log('")
    .replace(/log\(`\?\?\s*/g, "log(`")
    .replace(/log\('\\n\?\?\s*/g, "log('\\n")
    .replace(/log\(`\\n\?\?\s*/g, "log(`\\n")
    .replace(/log\(`   \?\?\s*/g, "log(`   ")
    .replace(/log\(`  \?\?\s*/g, "log(`  ")
    .replace(/log\(`    \?\?\s*/g, "log(`    ")
    .replace(/updateStatus\('\?\?\?\s*/g, "updateStatus('")
    .replace(/showResult\(`[^`]*\?\?\s*Supabase/g, (m) => m.replace(/\?\?\s*Supabase/, "Note: Supabase"));
}

function cleanLine(line) {
  if (isNullishLine(line)) return line;
  let s = cleanQuestionRuns(line);
  // Remaining ?? at string starts in UI helpers
  if (/(log|console|showResult|updateStatus|alert)\s*\(/.test(s)) {
    s = s.replace(/(['"`])\?\?\s+/g, "$1").replace(/(['"`])\?\s+/g, "$1");
  }
  // HTML/ template leftover ?? word
  s = s.replace(/(\s)\?\?\s+(?=[A-Za-z<])/g, `$1${I.info} `);
  s = s.replace(/'\?\?\?\s*View'/g, `'${I.eye} View'`);
  s = s.replace(/'\?\?\?\s*Print'/g, `'${I.print} Print'`);
  s = s.replace(/'\?\?\?\s*Delete'/g, `'${I.trash} Delete'`);
  return s;
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
let n = 0;
for (const file of files) {
  const fp = path.join(ROOT, file);
  const original = fs.readFileSync(fp, "utf8");
  if (!/\?\?/.test(original)) continue;
  const updated = original.split(/\r?\n/).map(cleanLine).join("\n");
  if (updated !== original) {
    fs.writeFileSync(fp, updated, "utf8");
    n++;
  }
}
console.log(`pass3: ${n} file(s) cleaned.`);
