/**
 * Second pass: clean ? / ?? inside JS HTML string fragments and multi-? placeholders.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const I = {
  info: '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>',
  check: '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
  xmark: '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>',
  warn: '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>',
  sync: '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>',
  users: '<i class="fa-solid fa-users" aria-hidden="true"></i>',
  doctor: '<i class="fa-solid fa-user-doctor" aria-hidden="true"></i>',
  nurse: '<i class="fa-solid fa-user-nurse" aria-hidden="true"></i>',
  trash: '<i class="fa-solid fa-trash" aria-hidden="true"></i>',
  close: '<i class="fa-solid fa-xmark" aria-hidden="true"></i>',
};

function cleanLine(line) {
  if (/[\w)\]"']\s*\?\?\s*[\['"`\d]/.test(line) && !/>[\?]/.test(line) && !/['"`][\?]{1,2}\s/.test(line)) {
    return line;
  }

  let s = line;

  // Multi-? placeholders (corrupted emoji runs)
  s = s.replace(/>\?{3,}\s*Doctors/gi, `>${I.doctor} Doctors`);
  s = s.replace(/>\?{3,}\s*Nurses/gi, `>${I.nurse} Nurses`);
  s = s.replace(/>\?{3,}\s*Patient/gi, `>${I.users} Patient`);
  s = s.replace(/>\?{3,}\s*Staff/gi, `>${I.users} Staff`);
  s = s.replace(/>\?{3,}\s*All Users/gi, `>${I.users} All Users`);
  s = s.replace(/>\?{3,}\s*Clear localStorage/gi, `>${I.trash} Clear localStorage`);
  s = s.replace(/>\?{3,}\s*Clear Browser Cache/gi, `>${I.trash} Clear Browser Cache`);
  s = s.replace(/>\?{3,}\s*Clear/gi, `>${I.trash} Clear`);
  s = s.replace(/>\?{3,}<\/button>/g, `>${I.info}</button>`);
  s = s.replace(/>\?{3,}\s+/g, `>${I.info} `);
  s = s.replace(/\?{4,}/g, "");

  // HTML fragments inside quoted strings
  s = s.replace(/>\?\?\s+/g, `>${I.info} `);
  s = s.replace(/>\?\s+/g, `>${I.check} `);

  // String starts (html += '?? ...)
  s = s.replace(/(['"`])\?\?\s+/g, `$1${I.info} `);
  s = s.replace(/(['"`])\?\s+(?!['"`])/g, `$1${I.check} `);

  // Table cell / inline status ? OK
  s = s.replace(/>\?\s*OK</g, `>${I.check} OK<`);

  // Template ${} areas with ? prefix in HTML output - already handled by >? 

  if (/console\.(log|warn|error)/.test(s)) {
    s = s.replace(/(['"`])\?\?\s+/g, "$1").replace(/(['"`])\?\s+/g, "$1");
  }

  return s;
}

function patchSecurityAudit(file) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) return;
  let c = fs.readFileSync(fp, "utf8");
  if (c.includes("formatSecurityAuditMessage")) return;
  const FA =
    '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">\n';
  if (!c.includes("font-awesome")) c = c.replace(/<title>/, FA + "  <title>");
  c = c.replace(
    `      element.innerHTML += \`<div class="security-item \${status}">\${message}</div>\`;`,
    `      element.innerHTML += \`<div class="security-item \${status}">\${formatSecurityAuditMessage(message, status)}</div>\`;`
  );
  c = c.replace(
    `    function addSecurityItem(elementId, message, status = 'info') {`,
    `    function formatSecurityAuditMessage(message, status) {
      const icons = { success: '${I.check}', critical: '${I.xmark}', warning: '${I.warn}', info: '${I.info}' };
      let text = String(message).replace(/^\\\\?\\\\s+/, '').replace(/^&#9888;\\\\s+WARNING:\\\\s+/, 'WARNING: ').replace(/^&#8505;\\\\s+/, '');
      return \`\${icons[status] || icons.info} \${text}\`;
    }

    function addSecurityItem(elementId, message, status = 'info') {`
  );
  fs.writeFileSync(fp, c, "utf8");
  console.log("security:", file);
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
let n = 0;
for (const file of files) {
  const fp = path.join(ROOT, file);
  const lines = fs.readFileSync(fp, "utf8").split(/\r?\n/);
  const out = lines.map((line) => {
    if (/[\?]{2,}|>\?[\s<]|['"`]\?\s|'>\?\?|'>\?/.test(line)) {
      const cleaned = cleanLine(line);
      return cleaned !== line ? cleaned : line;
    }
    return line;
  });
  const joined = out.join("\n");
  const prev = fs.readFileSync(fp, "utf8");
  if (joined !== prev) {
    fs.writeFileSync(fp, joined, "utf8");
    n++;
  }
}

patchSecurityAudit("security-audit.html");
patchSecurityAudit("security-audit-simple.html");

console.log(`pass2: ${n} file(s) updated.`);
