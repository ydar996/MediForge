import fs from "fs";

const skip =
  /^(test-|migrate-|sync-|check-|diagnose-|restore-tool|direct-|force-|simple-|mobile-|automated-|audit-|cleanup-|delete-|find-|investigate-|populate-|hybrid-|execute-|create-auth|verify-|performance-audit|reset-refresh|allergies-diagnostic|clear-localstorage|REALLY-|ACTUALLY-|FINAL-|final-ui|final-working|platform-dashboard-backup|manage-clinics-backup|patient-encounters-broken|color-scheme|generate-icons|create-icon|e2e-test|comprehensive-|setup-test)/i;

const patterns = [
  { n: "html-double-q", re: />\?\?[^?]/ },
  { n: "heading-single-q", re: /<h[1-6][^>]*>\?(?!\?)/ },
  { n: "h4-single-q", re: /<h4[^>]*>\?(?!\?)/ },
  { n: "button-single-q", re: /<button[^>]{0,300}>\?(?!\?)/ },
  { n: "label-single-q", re: /<label[^>]*>\?(?!\?)/ },
  { n: "span-feature-icon", re: /feature-icon">\?\?/ },
  { n: "title-double-q", re: /<title>\?\?/ },
  { n: "innerHTML-visible-q", re: /innerHTML\s*[+=].*['"`][^'"`]*>\?\?/ },
  { n: "template-q-button", re: /`\?\? / },
  { n: "ngn-currency", re: /'NGN'\s*:\s*'\?'/ },
  { n: "list-item-check-q", re: /<li>\? / },
];

const files = fs.readdirSync(".").filter((f) => f.endsWith(".html") && !skip.test(f));
const hits = [];

for (const f of files.sort()) {
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  for (const { n, re } of patterns) {
    lines.forEach((line, i) => {
      if (/console\.(log|warn|error|debug)\s*\(/.test(line)) return;
      if (re.test(line)) hits.push({ f, l: i + 1, n, t: line.trim().slice(0, 120) });
    });
  }
}

for (const h of hits) console.log(`${h.f}:${h.l} [${h.n}] ${h.t}`);
console.log(`\nTotal: ${hits.length} in ${files.length} product-ish html files`);
