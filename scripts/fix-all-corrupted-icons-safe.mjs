/**
 * Safely clean ? / ?? icon placeholders in ALL root HTML files.
 * Does NOT touch JS nullish coalescing (foo ?? bar) or ternary (a ? b : c).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FA =
  '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">\n';

const I = {
  info: '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>',
  check: '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
  xmark: '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>',
  warn: '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>',
  back: '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>',
  close: '<i class="fa-solid fa-xmark" aria-hidden="true"></i>',
  sync: '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>',
  search: '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>',
  copy: '<i class="fa-solid fa-copy" aria-hidden="true"></i>',
  print: '<i class="fa-solid fa-print" aria-hidden="true"></i>',
  key: '<i class="fa-solid fa-key" aria-hidden="true"></i>',
  users: '<i class="fa-solid fa-users" aria-hidden="true"></i>',
  trash: '<i class="fa-solid fa-trash" aria-hidden="true"></i>',
};

function iconFor(text, isDouble) {
  const t = String(text || "").toLowerCase();
  if (/\bback\b/.test(t)) return I.back;
  if (/\bclose\b/.test(t)) return I.close;
  if (/\b(print|summary)\b/.test(t)) return I.print;
  if (/\b(copy|clipboard)\b/.test(t)) return I.copy;
  if (/\b(sync|restore|refresh|migrate|clear|clean|fix|reset|override|populate|execute|run|reload)\b/.test(t)) return I.sync;
  if (/\b(check|test|verify|find|search|audit|debug|diagnos|investigate|show|deployment)\b/.test(t)) return I.search;
  if (/\b(warning|caution|weak)\b/.test(t)) return I.warn;
  if (/\b(error|fail|missing|critical|unable|cannot|rejected)\b/.test(t)) return I.xmark;
  if (/\b(success|complete|found|good|approved|working|passed|enabled|copied|saved)\b/.test(t)) return I.check;
  if (/\b(user|patient|organization|clinic|staff|auth|login|password|encryption)\b/.test(t)) return I.key;
  if (/\b(delete|remove)\b/.test(t)) return I.trash;
  return isDouble ? I.info : I.check;
}

function cleanHtml(html) {
  let s = html;
  s = s.replace(
    /(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li|title|option)[^>]*>)\?\?\s+/gi,
    (_, tag) => `${tag}${I.info} `
  );
  s = s.replace(
    /(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li|title|option)[^>]*>)\?\s+/gi,
    (_, tag) => `${tag}${I.check} `
  );
  s = s.replace(
    /(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li|title|option)[^>]*>)<i class="fa-solid fa-circle-check" aria-hidden="true"><\/i>\s+([^<\n]+)/gi,
    (_, tag, text) => `${tag}${iconFor(text, false)} ${text.trimStart()}`
  );
  s = s.replace(/>\?\?\s*<\/div>/gi, `>${I.info}</div>`);
  s = s.replace(/>\?\?\s*<\/button>/gi, `>${I.info}</button>`);
  s = s.replace(/(<div[^>]*style="[^"]*font-size:\s*48px[^"]*"[^>]*>)\?\?(\s*<\/div>)/gi, `$1${I.info}$2`);
  return s;
}

function cleanScriptLine(line) {
  if (/console\.(log|warn|error|debug)\s*\(/.test(line)) {
    return line.replace(/(['"`])\?\?\s+/g, "$1").replace(/(['"`])\?\s+/g, "$1");
  }

  let s = line;

  // String literals that START with ?? or ? (safe — not ternary)
  s = s.replace(/(^|[^\\(?:=\[+,\s])(['"`])\?\?\s+/g, (_, pre, q) => `${pre}${q}${I.info} `);
  s = s.replace(/(^|[^\\(?:=\[+,\s])(['"`])\?\s+/g, (_, pre, q) => `${pre}${q}${I.check} `);

  // innerHTML / textContent / alert at string start
  s = s.replace(/(innerHTML\s*[+]?=\s*(['"`]))\?\?\s+/g, `$1${I.info} `);
  s = s.replace(/(innerHTML\s*[+]?=\s*(['"`]))\?\s+/g, `$1${I.check} `);
  s = s.replace(/(textContent\s*=\s*(['"`]))\?\?\s+/g, `$1${I.info} `);
  s = s.replace(/(textContent\s*=\s*(['"`]))\?\s+/g, `$1${I.check} `);
  s = s.replace(/(alert\s*\(\s*(['"`]))\?\?\s+/g, "$1");
  s = s.replace(/(alert\s*\(\s*(['"`]))\?\s+/g, "$1");

  // Embedded HTML fragments in template strings
  s = s.replace(/`<h([1-6])>\?\?\s+/gi, "`<h$1>${I.info} ");
  s = s.replace(/`<h([1-6])>\?\s+/gi, "`<h$1>${I.check} ");
  s = s.replace(/'<h([1-6])>\?\?\s+/gi, "'<h$1>${I.info} ");
  s = s.replace(/'<h([1-6])>\?\s+/gi, "'<h$1>${I.check} ");
  s = s.replace(/`<li>\?\s+/g, "`<li>${I.check} ");
  s = s.replace(/'<li>\?\s+/g, "'<li>${I.check} ");
  s = s.replace(/`<p>\?\s+/g, "`<p>${I.check} ");
  s = s.replace(/`<strong>\?\?\s+/g, "`<strong>${I.info} ");

  s = s.replace(/innerHTML\s*=\s*'\?'/g, `innerHTML = '${I.close}'`);
  s = s.replace(/innerHTML\s*=\s*"\?"/g, `innerHTML = "${I.close}"`);

  // addSecurityItem messages — leave text; formatSecurityAuditMessage handles display
  return s;
}

function process(content) {
  const parts = content.split(/(<script\b[\s\S]*?<\/script>)/gi);
  let out = parts
    .map((part) => {
      if (/^<script\b/i.test(part)) {
        return part
          .split("\n")
          .map((line) => {
            if (/>\?\?|>\?\s|'?\?\s|`?\?\s|innerHTML.*['"`]\?\?|textContent.*['"`]\?\?|alert\s*\(\s*['"`]\?/.test(line)) {
              if (/[\w)\]"']\s*\?\?\s/.test(line) && !/['"`]\?\?/.test(line)) return line;
              return cleanScriptLine(line);
            }
            return line;
          })
          .join("\n");
      }
      return cleanHtml(part);
    })
    .join("");

  if (out.includes("fa-solid") && !out.includes("font-awesome") && !out.includes("all.min.css")) {
    out = out.replace(/<title>/, FA + "  <title>");
  }
  return out;
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
let changed = 0;
for (const file of files) {
  const fp = path.join(ROOT, file);
  const original = fs.readFileSync(fp, "utf8");
  const updated = process(original);
  if (updated !== original) {
    fs.writeFileSync(fp, updated, "utf8");
    changed++;
  }
}

// Security audit: central formatter
for (const file of ["security-audit.html", "security-audit-simple.html"]) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) continue;
  let c = fs.readFileSync(fp, "utf8");
  if (c.includes("formatSecurityAuditMessage")) continue;
  if (!c.includes("font-awesome")) c = c.replace(/<title>/, FA + "  <title>");
  const oldFn = `    function addSecurityItem(elementId, message, status = 'info') {
      const element = document.getElementById(elementId);
      if (element.textContent.trim() === '') {
        element.style.display = 'block';
      }
      element.innerHTML += \`<div class="security-item \${status}">\${message}</div>\`;`;
  const newFn = `    function formatSecurityAuditMessage(message, status) {
      const icons = { success: '${I.check}', critical: '${I.xmark}', warning: '${I.warn}', info: '${I.info}' };
      let text = String(message).replace(/^\\?\\s+/, '').replace(/^&#9888;\\s+WARNING:\\s+/, 'WARNING: ');
      return \`\${icons[status] || icons.info} \${text}\`;
    }

    function addSecurityItem(elementId, message, status = 'info') {
      const element = document.getElementById(elementId);
      if (element.textContent.trim() === '') {
        element.style.display = 'block';
      }
      element.innerHTML += \`<div class="security-item \${status}">\${formatSecurityAuditMessage(message, status)}</div>\`;`;
  if (c.includes(oldFn)) {
    c = c.replace(oldFn, newFn);
    fs.writeFileSync(fp, c, "utf8");
    console.log("security audit:", file);
  }
}

console.log(`fix-all-corrupted-icons-safe: ${changed} html file(s) cleaned.`);
