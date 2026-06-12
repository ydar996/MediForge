/**
 * Clean ALL corrupted ? / ?? icon placeholders across every root HTML file.
 * Run: node scripts/fix-all-corrupted-icons.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const FA_LINK =
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
  save: '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>',
  download: '<i class="fa-solid fa-download" aria-hidden="true"></i>',
  trash: '<i class="fa-solid fa-trash" aria-hidden="true"></i>',
  play: '<i class="fa-solid fa-play" aria-hidden="true"></i>',
  key: '<i class="fa-solid fa-key" aria-hidden="true"></i>',
  shield: '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>',
  users: '<i class="fa-solid fa-users" aria-hidden="true"></i>',
  lock: '<i class="fa-solid fa-lock" aria-hidden="true"></i>',
  unlock: '<i class="fa-solid fa-unlock" aria-hidden="true"></i>',
  spinner: '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>',
};

function pickIcon(text, isDouble) {
  const t = text.toLowerCase();
  if (/\bback\b/.test(t)) return I.back;
  if (/\bclose\b/.test(t)) return I.close;
  if (/\b(print|summary)\b/.test(t)) return I.print;
  if (/\b(copy|clipboard)\b/.test(t)) return I.copy;
  if (/\b(sync|restore|refresh|rotate|reload|populate|migrate|override|reset|clear|clean|fix|execute|run)\b/.test(t)) return I.sync;
  if (/\b(check|test|verify|diagnos|investigate|find|search|audit|show|debug|deployment)\b/.test(t)) return I.search;
  if (/\b(warning|caution|weak)\b/.test(t)) return I.warn;
  if (/\b(error|fail|missing|critical|not found|unable|cannot|rejected)\b/.test(t)) return I.xmark;
  if (/\b(success|complete|found|good|approved|unlocked|copied|saved|enabled|working|passed|ok)\b/.test(t)) return I.check;
  if (/\b(encryption|key|password|auth|login)\b/.test(t)) return I.key;
  if (/\b(security|shield)\b/.test(t)) return I.shield;
  if (/\b(user|staff|patient|organization|clinic)\b/.test(t)) return I.users;
  if (/\b(delete|remove|archive)\b/.test(t)) return I.trash;
  if (/\b(download|export)\b/.test(t)) return I.download;
  if (/\b(save|store)\b/.test(t)) return I.save;
  if (/\b(loading|initializing|wait)\b/.test(t)) return I.spinner;
  if (/\block\b/.test(t)) return I.lock;
  if (/\bunlock\b/.test(t)) return I.unlock;
  return isDouble ? I.info : I.check;
}

function isNullishCoalescing(line, index) {
  const before = line.slice(Math.max(0, index - 30), index);
  return /[\w)\]"']\s*$/.test(before);
}

function cleanLine(line) {
  if (/^\s*\/\//.test(line)) return line;

  let out = line;

  // HTML tag content: >?? Text or >? Text
  out = out.replace(/(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li|option)[^>]*>)??\s+([^<\n]+)/gi, (_, tag, text) => {
    return `${tag}${pickIcon(text, true)} ${text.trimStart()}`;
  });
  out = out.replace(/(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li)[^>]*>)\?\s+([^<\n]+)/gi, (_, tag, text) => {
    return `${tag}${pickIcon(text, false)} ${text.trimStart()}`;
  });

  // Standalone ?? in div (empty-state style)
  out = out.replace(/(<div[^>]*style="[^"]*font-size:\s*48px[^"]*"[^>]*>)??(\s*<\/div>)/gi, `$1${I.info}$2`);

  // innerHTML / textContent / alert string prefixes
  out = out.replace(/(innerHTML\s*[+=]=?\s*(?:`|'|"))\?\?\s+/g, `$1${I.info} `);
  out = out.replace(/(innerHTML\s*[+=]=?\s*(?:`|'|"))\?\s+/g, (_, q) => `${q}${I.check} `);
  out = out.replace(/(textContent\s*=\s*(?:`|'|"))\?\?\s+/g, `$1${I.info} `);
  out = out.replace(/(textContent\s*=\s*(?:`|'|"))\?\s+/g, (_, q) => `${q}${I.check} `);
  out = out.replace(/(alert\s*\(\s*(?:`|'|"))\?\?\s+/g, `$1`);
  out = out.replace(/(alert\s*\(\s*(?:`|'|"))\?\s+/g, `$1`);

  // Template fragments: `?? text`, `<li>? name`, `<h3>? title`
  out = out.replace(/`\?\?\s+/g, `\`${I.info} `);
  out = out.replace(/`<li>\?\s+/g, `\`<li>${I.check} `);
  out = out.replace(/'<li>\?\s+/g, `'<li>${I.check} `);
  out = out.replace(/`<h([1-6])>\?\s+/gi, `\`<h$1>${I.check} `);
  out = out.replace(/'<h([1-6])>\?\s+/gi, `'<h$1>${I.check} `);
  out = out.replace(/`\?\s+/g, `\`${I.check} `);

  // console messages: ?? -> [INFO], ? -> remove (dev readability)
  if (/console\.(log|warn|error|debug)\s*\(/.test(out)) {
    out = out.replace(/console\.(log|warn|error|debug)\s*\(\s*'??\s+/g, "console.$1('[INFO] ");
    out = out.replace(/console\.(log|warn|error|debug)\s*\(\s*`??\s+/g, "console.$1(`[INFO] ");
    out = out.replace(/console\.(log|warn|error|debug)\s*\(\s*'\?\s+/g, "console.$1('");
    out = out.replace(/console\.(log|warn|error|debug)\s*\(\s*`\?\s+/g, "console.$1(`");
  }

  // innerHTML = '?'; close buttons
  out = out.replace(/innerHTML\s*=\s*'\?'/g, `innerHTML = '${I.close}'`);
  out = out.replace(/innerHTML\s*=\s*"\?"/g, `innerHTML = "${I.close}"`);

  // title tag
  out = out.replace(/<title>\?\?\s+/g, `<title>${I.info} `);

  // textContent single char
  out = out.replace(/\.textContent\s*=\s*'\?\?'/g, `.innerHTML = '${I.info}'`);

  // Avoid breaking nullish coalescing: revert accidental ?? operator breaks
  out = out.replace(/(\w[\w.[\]"']*)\s+\?\?\s+/g, (match, ident, offset) => {
    if (isNullishCoalescing(out, offset)) return match;
    return match;
  });

  return out;
}

function ensureFA(content) {
  if (!content.includes("fa-solid") && !content.includes("fa-solid")) return content;
  if (content.includes("font-awesome") || content.includes("all.min.css")) return content;
  if (!content.includes("fa-solid")) return content;
  return content.replace(/<title>/, FA_LINK + "  <title>");
}

function needsFA(content) {
  return content.includes("fa-solid") && !content.includes("font-awesome") && !content.includes("all.min.css");
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
let changed = 0;

for (const file of files) {
  const fp = path.join(ROOT, file);
  const original = fs.readFileSync(fp, "utf8");
  const lines = original.split(/\r?\n/);
  const cleaned = lines.map((line) => {
    if (/\?\?|\? ['"`]|\?>|<\/[^>]+>\?|>\?\?|>\?\s|<title>\?\?|innerHTML\s*=\s*['\`]?\?|textContent\s*=\s*['\`]?\?\s|alert\s*\(\s*['\`]?\?/.test(line)) {
      if (/^\s*[^<]*\?\?\s*[^?]/.test(line) && !/[>'"`]/.test(line.split("??")[0].slice(-5))) {
        // possible JS ?? operator on its own - skip if looks like `foo ?? bar`
        if (/\?\?\s*['"`\d\w([]/.test(line) && /[\w)\]"']\s*\?\?/.test(line)) return line;
      }
      return cleanLine(line);
    }
    return line;
  });
  let content = cleaned.join("\n");
  if (needsFA(content)) content = ensureFA(content);
  if (content !== original) {
    fs.writeFileSync(fp, content.endsWith("\n") ? content : content + "\n", "utf8");
    changed++;
    console.log("cleaned:", file);
  }
}

console.log(`\nfix-all-corrupted-icons: ${changed} file(s) updated.`);
