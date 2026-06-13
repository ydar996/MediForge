/**
 * Full-repo scan for corrupted icons and mojibake (all HTML/JS/CSS).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "js/vendor"]);

const PATTERNS = [
  { n: "html-double-q", re: />\?\?[^?]/ },
  { n: "heading-single-q", re: /<h[1-6][^>]*>\?(?!\?|<\/|\s*\?)/ },
  { n: "button-single-q", re: /<button[^>]{0,400}>\?(?!\?|<\/)/ },
  { n: "feature-icon", re: /feature-icon">\?\?/ },
  { n: "empty-state-icon", re: /empty-state-icon">\?/ },
  { n: "ngn-currency", re: /'NGN': '\?'/ },
  { n: "currency-q-prefix", re: /\?\$\{/ },
  { n: "template-li-q", re: /`<li>\?\s/ },
  { n: "innerHTML-single-q", re: /innerHTML\s*=\s*['"`]\?['"`]/ },
  { n: "mojibake", re: /Ã©|Ã­|Ã³|Ã |â€"|â€“|Â®|Â²|ðŸ|ï¿½/ },
  { n: "replacement-char", re: /\uFFFD/ },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|js|css)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const { n, re } of PATTERNS) {
    lines.forEach((line, i) => {
      if (/console\.(log|warn|error|debug)\s*\(/.test(line)) return;
      if (/\?\$\{/.test(line) && n === "currency-q-prefix") return;
      if (/\?\$\{/.test(line) && /pathname|params|url|href|rest\/v1|studies\?/i.test(line)) return;
      if (/\?\? null|\?\? undefined|\?\? ''|\?\? ""|\?\? 0|\?\? false|\?\? true/.test(line)) return;
      if (/\?\s*['"`]:/.test(line) && !/>\?/.test(line) && !/`\?/.test(line)) return;
      if (re.test(line)) hits.push({ rel, l: i + 1, n, t: line.trim().slice(0, 120) });
    });
  }
}

for (const h of hits) console.log(`${h.rel}:${h.l} [${h.n}] ${h.t}`);
console.log(`\nTotal: ${hits.length} hit(s) in ${walk(ROOT).length} files`);
process.exit(hits.length ? 1 : 0);
