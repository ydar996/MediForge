/**
 * Fix ALL corrupted icons, emoji mojibake, and text encoding across the repo.
 * Run: node scripts/fix-all-corruption.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "js/vendor"]);

const FA =
  '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">\n';

const I = {
  info: '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>',
  check: '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
  xmark: '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>',
  warn: '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>',
  lock: '<i class="fa-solid fa-lock" aria-hidden="true"></i>',
  users: '<i class="fa-solid fa-users" aria-hidden="true"></i>',
  user: '<i class="fa-solid fa-user" aria-hidden="true"></i>',
  hospital: '<i class="fa-solid fa-hospital" aria-hidden="true"></i>',
  calendar: '<i class="fa-solid fa-calendar" aria-hidden="true"></i>',
  pills: '<i class="fa-solid fa-pills" aria-hidden="true"></i>',
  rocket: '<i class="fa-solid fa-rocket" aria-hidden="true"></i>',
  search: '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>',
  chart: '<i class="fa-solid fa-chart-bar" aria-hidden="true"></i>',
  link: '<i class="fa-solid fa-link" aria-hidden="true"></i>',
  mobile: '<i class="fa-solid fa-mobile-screen" aria-hidden="true"></i>',
  flask: '<i class="fa-solid fa-flask" aria-hidden="true"></i>',
  print: '<i class="fa-solid fa-print" aria-hidden="true"></i>',
  eye: '<i class="fa-solid fa-eye" aria-hidden="true"></i>',
  file: '<i class="fa-solid fa-file-lines" aria-hidden="true"></i>',
  trash: '<i class="fa-solid fa-trash" aria-hidden="true"></i>',
  sync: '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>',
  building: '<i class="fa-solid fa-building" aria-hidden="true"></i>',
  box: '<i class="fa-solid fa-box" aria-hidden="true"></i>',
  key: '<i class="fa-solid fa-key" aria-hidden="true"></i>',
  pen: '<i class="fa-solid fa-pen" aria-hidden="true"></i>',
};

const MOJIBAKE_REPLACEMENTS = [
  ["Haemoglobin H disease ( â€“ ?/â€“  â€“ included)", "Haemoglobin H disease (α–/?/α– α– included)"],
  ["Â®", "®"],
  ["Â²", "²"],
  ["â€\"", "–"],
  ["â€“", "–"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ã ", "à"],
  ["Ã©", "é"],
  ["Ã¢", "â"],
  ["Ã¨", "è"],
  ["Ã¼", "ü"],
  ["Ã¶", "ö"],
  ["Ã¤", "ä"],
  ["Ã±", "ñ"],
  ["Ã‡", "Ç"],
  ["Ã§", "ç"],
  ["Ã¢â‚¬â€œ", "–"],
  ["Ã¢â‚¬â€", ":"],
  ["âœ\"", "✓"],
  ["âœ…", "✓"],
  ["âš ", "⚠ "],
  ["âš¡", ""],
  ["ï¸", ""],
];

/** Corrupted UTF-8 emoji blobs (start with ðŸ). */
const EMOJI_BLOB = /ðŸ[^\s<>'"`;,.)]+/g;

function iconForContext(text) {
  const t = String(text).toLowerCase();
  if (/\b(lock|backup|secure|encrypt|rls)\b/.test(t)) return I.lock;
  if (/\b(print|summary)\b/.test(t)) return I.print;
  if (/\b(view|eye)\b/.test(t)) return I.eye;
  if (/\b(draft|pen|edit)\b/.test(t)) return I.pen;
  if (/\b(signed|success|complete|passed|approved|working)\b/.test(t)) return I.check;
  if (/\b(delete|clear|remove|reset|trash)\b/.test(t)) return I.trash;
  if (/\b(migrate|sync|restore|refresh|update)\b/.test(t)) return I.sync;
  if (/\b(search|analyze|find|verify|test|audit|debug)\b/.test(t)) return I.search;
  if (/\b(patient|user|doctor|nurse|staff)\b/.test(t)) return I.users;
  if (/\b(organization|clinic|hospital|building)\b/.test(t)) return I.building;
  if (/\b(appointment|calendar|schedule)\b/.test(t)) return I.calendar;
  if (/\b(prescription|pill|drug|medication)\b/.test(t)) return I.pills;
  if (/\b(migration|migrate|rocket|start|launch)\b/.test(t)) return I.rocket;
  if (/\b(chart|summary|stats|platform dashboard)\b/.test(t)) return I.chart;
  if (/\b(link|registration)\b/.test(t)) return I.link;
  if (/\b(mobile|phone)\b/.test(t)) return I.mobile;
  if (/\b(test|flask|minimal)\b/.test(t)) return I.flask;
  if (/\b(log|file|step|read|load|backup file|package|box)\b/.test(t)) return I.file;
  if (/\b(warning|caution)\b/.test(t)) return I.warn;
  if (/\b(error|fail|critical)\b/.test(t)) return I.xmark;
  if (/\b(open|key|auth)\b/.test(t)) return I.key;
  return I.info;
}

function applyMojibake(text) {
  let s = text;
  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    if (s.includes(from)) s = s.split(from).join(to);
  }
  return s;
}

function fixCorruptedEmojiInLine(line) {
  if (!/ðŸ|âœ|âš/.test(line)) return line;
  return line.replace(EMOJI_BLOB, () => iconForContext(line));
}

function fixQuestionIconsInHtml(html) {
  let s = html;
  s = s.replace(/(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li|title|option)[^>]*>)\?\?\s+/gi, (_, tag) => `${tag}${I.info} `);
  s = s.replace(/(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li|title|option)[^>]*>)\?\s+/gi, (_, tag) => `${tag}${I.check} `);
  s = s.replace(/>\?\?\s*<\/div>/gi, `>${I.info}</div>`);
  s = s.replace(/>\?\?\s*<\/button>/gi, `>${I.info}</button>`);
  s = s.replace(/(<span class="feature-icon">)\?\?(<\/span>)/gi, `$1${I.info}$2`);
  s = s.replace(/(<div[^>]*class="[^"]*empty-state-icon[^"]*"[^>]*>)\?(<\/div>)/gi, `$1${I.info}$2`);
  return s;
}

function fixCurrencyMaps(content) {
  return content
    .replace(/'NGN': '\?'/g, "'NGN': '₦'")
    .replace(/"NGN": "\?"/g, '"NGN": "₦"')
    .replace(/currency === 'NGN' \? '\?'/g, "currency === 'NGN' ? '₦'")
    .replace(/\?\$\{plan\.prices\?\.NGN\}/g, "₦${plan.prices?.NGN}")
    .replace(/'\?\?\?\? NGN'/g, "'₦ NGN'")
    .replace(/'\?\?\?\? KES'/g, "'KSh KES'")
    .replace(/'\?\?\?\? USD'/g, "'$ USD'")
    .replace(/'\?\?\?\? CAD'/g, "'CA$ CAD'");
}

function ensureFaLink(html) {
  if (html.includes("fa-solid") && !html.includes("font-awesome") && !html.includes("all.min.css")) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${FA}`);
  }
  return html;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|js|css)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

let changed = 0;
const changedFiles = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  let content = fs.readFileSync(file, "utf8");
  const original = content;

  content = applyMojibake(content);
  content = fixCurrencyMaps(content);

  if (file.endsWith(".html")) {
    content = fixQuestionIconsInHtml(content);
    content = content
      .split("\n")
      .map((line) => fixCorruptedEmojiInLine(line))
      .join("\n");
    content = ensureFaLink(content);
  } else if (file.endsWith(".js")) {
    content = content
      .split("\n")
      .map((line) => {
        if (/console\.(log|warn|error|debug)\s*\(/.test(line)) {
          return fixCorruptedEmojiInLine(line);
        }
        if (/[\w)\]"']\s*\?\?\s/.test(line) && !/['"`]\?\?/.test(line)) return line;
        let line2 = fixCorruptedEmojiInLine(line);
        line2 = line2.replace(/(['"`])\?\?\s+/g, (_, q) => `${q}${I.info} `);
        line2 = line2.replace(/(['"`])\?\s+(?=[A-Za-z])/g, (_, q) => `${q}${I.check} `);
        return line2;
      })
      .join("\n");
  }

  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    changed++;
    changedFiles.push(rel);
  }
}

console.log(`fix-all-corruption: ${changed} file(s) updated.`);
changedFiles.forEach((f) => console.log(`  - ${f}`));
