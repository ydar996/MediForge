/**
 * Repair damage from fix-all-corrupted-icons.mjs (undefined insertions, broken tags).
 * Then clean remaining ?? / ? placeholders safely (HTML body only, not <script>).
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const FA_LINK =
  '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">\n';

const INFO = '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>';

function pickIcon(text) {
  const t = String(text).toLowerCase();
  if (/\bback\b/.test(t)) return '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>';
  if (/\bclose\b/.test(t)) return '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  if (/\b(sync|restore|refresh|migrate|clear|clean|fix|reset|override|populate|execute|run)\b/.test(t))
    return '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>';
  if (/\b(check|test|verify|find|search|audit|debug|diagnos|investigate|show)\b/.test(t))
    return '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>';
  if (/\b(warning|caution)\b/.test(t)) return '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>';
  if (/\b(error|fail|missing|critical|unable|cannot)\b/.test(t))
    return '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>';
  if (/\b(success|complete|found|good|approved|working|passed|ok|no orphaned)\b/.test(t))
    return '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>';
  if (/\b(user|patient|organization|clinic|staff)\b/.test(t))
    return '<i class="fa-solid fa-users" aria-hidden="true"></i>';
  if (/\b(key|password|auth|login|encryption)\b/.test(t))
    return '<i class="fa-solid fa-key" aria-hidden="true"></i>';
  if (/\b(copy|clipboard)\b/.test(t)) return '<i class="fa-solid fa-copy" aria-hidden="true"></i>';
  if (/\b(print|summary)\b/.test(t)) return '<i class="fa-solid fa-print" aria-hidden="true"></i>';
  if (/\b(delete|remove)\b/.test(t)) return '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
  return INFO;
}

function repairBroken(content) {
  let s = content;
  // Remove erroneous undefined prefix artifacts
  s = s.replace(/undefined<i class="fa-solid fa-circle-info" aria-hidden="true"><\/i>\s*/g, "");
  s = s.replace(/\?\?undefined<i class="fa-solid/g, '<i class="fa-solid');
  s = s.replace(/\?\?<i class="fa-solid/g, '<i class="fa-solid');
  s = s.replace(/(<(?:button|div|p|span|h[1-6]|strong|a|td|th|li))undefined<i class="/gi, "$1><i class=\"");
  s = s.replace(/(\?)undefined<i class="/g, '<i class="');
  s = s.replace(/>\?\?<\/button>/g, `>${INFO}</button>`);
  s = s.replace(/>\?\?\s*<\/div>/g, `>${INFO}</div>`);
  s = s.replace(/>\?\?\?\s+/g, "> ");
  return s;
}

function cleanHtmlSegment(html) {
  let s = html;
  s = s.replace(/(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li|title)[^>]*>)\?\?\s+/gi, (_, tag) => `${tag}${INFO} `);
  s = s.replace(/(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li)[^>]*>)\?\s+/gi, (_, tag) => {
    return `${tag}${pickIcon("")} `;
  });
  // Re-fix headings/buttons with better icon from following text
  s = s.replace(
    /(<(?:h[1-6]|button|a|label|strong|p|div|span|td|th|li)[^>]*>)<i class="fa-solid fa-circle-info" aria-hidden="true"><\/i>\s+([^<\n]+)/gi,
    (_, tag, text) => `${tag}${pickIcon(text)} ${text.trimStart()}`
  );
  s = s.replace(/<title>\?\?\s+/gi, `<title>${INFO} `);
  s = s.replace(/<title>\?\s+/gi, `<title>${INFO} `);
  return s;
}

function cleanJsStringLine(line) {
  if (/console\.(log|warn|error|debug)\s*\(/.test(line)) {
    return line
      .replace(/(['"`])\?\?\s+/g, "$1")
      .replace(/(['"`])\?\s+/g, "$1");
  }
  return line
    .replace(/(innerHTML\s*[+=]=?\s*(?:`|'|"))\?\?\s+/g, `$1${INFO} `)
    .replace(/(innerHTML\s*[+=]=?\s*(?:`|'|"))\?\s+/g, `$1${pickIcon("")} `)
    .replace(/(textContent\s*=\s*(?:`|'|"))\?\?\s+/g, `$1${INFO} `)
    .replace(/(textContent\s*=\s*(?:`|'|"))\?\s+/g, `$1${pickIcon("")} `)
    .replace(/(alert\s*\(\s*(?:`|'|"))\?\?\s+/g, "$1")
    .replace(/(alert\s*\(\s*(?:`|'|"))\?\s+/g, "$1")
    .replace(/innerHTML\s*=\s*'\?'/g, `innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>'`)
    .replace(/`<li>\?\s+/g, "`<li>${pickIcon('')} `")
    .replace(/'<li>\?\s+/g, "'<li>${pickIcon('')} ");
}

function processFile(file) {
  const fp = path.join(ROOT, file);
  let content = fs.readFileSync(fp, "utf8");
  const original = content;
  content = repairBroken(content);

  const parts = content.split(/(<script[\s\S]*?<\/script>)/gi);
  content = parts
    .map((part, i) => {
      if (/^<script/i.test(part)) {
        return part
          .split("\n")
          .map((line) => {
            if (/\?\?|\?\s/.test(line) && !/\?\?\s*[\['"`\d]/.test(line.replace(/console\.[^)]+\)/, ""))) {
              if (/[\w)\]"']\s*\?\?/.test(line)) return line;
            }
            if (/>\?\?|>\?\s|'?\?\s|`?\?\s|innerHTML.*\?|textContent.*\?|alert\s*\(\s*['"]\?/.test(line)) {
              return cleanJsStringLine(line);
            }
            return line;
          })
          .join("\n");
      }
      return cleanHtmlSegment(part);
    })
    .join("");

  if (content.includes("fa-solid") && !content.includes("font-awesome") && !content.includes("all.min.css")) {
    content = content.replace(/<title>/, FA_LINK + "  <title>");
  }

  if (content !== original) {
    fs.writeFileSync(fp, content, "utf8");
    return true;
  }
  return false;
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
let n = 0;
for (const f of files) {
  if (processFile(f)) {
    n++;
    console.log("repaired:", f);
  }
}
console.log(`\nrepair-corrupted-icons: ${n} file(s).`);
