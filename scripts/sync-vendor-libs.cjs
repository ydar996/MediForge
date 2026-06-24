/**
 * Download pinned UMD builds into js/vendor/ and apply CDN version pins across HTML/JS.
 * Run: npm run sync:vendor
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'js', 'vendor', 'vendor-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const SUPABASE_VERSION = manifest['@supabase/supabase-js'].version;
const JSPDF_VERSION = manifest.jspdf.version;
const HTML2CANVAS_VERSION = manifest.html2canvas.version;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

function walkFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'sync-upgrade-backup-20251021-202245') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
    } else if (/\.(html|js)$/i.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function applyCdnPins(content) {
  let next = content;
  next = next.replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[\d.]+/g, manifest.jspdf.cdnUrl.replace('/jspdf.umd.min.js', ''));
  next = next.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/html2canvas@[\d.]+/g, `https://cdn.jsdelivr.net/npm/html2canvas@${HTML2CANVAS_VERSION}`);
  next = next.replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2canvas\/[\d.]+/g, manifest.html2canvas.cdnUrl.replace('/html2canvas.min.js', ''));
  next = next.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[\d.]+/g, `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_VERSION}`);
  next = next.replace(/https:\/\/unpkg\.com\/@supabase\/supabase-js@[\d.]+/g, `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_VERSION}`);
  // Unpinned @2 only (not already semver)
  next = next.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2(?![0-9.])/g, `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_VERSION}`);
  next = next.replace(/https:\/\/unpkg\.com\/@supabase\/supabase-js@2(?![0-9.])/g, `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_VERSION}`);
  return next;
}

async function main() {
  const supabaseUrl = manifest['@supabase/supabase-js'].cdnUrl;
  const vendorOut = path.join(root, manifest['@supabase/supabase-js'].vendorPath);
  console.log(`Downloading @supabase/supabase-js@${SUPABASE_VERSION}...`);
  const body = await fetchUrl(supabaseUrl);
  const header = `/**\n * @supabase/supabase-js@${SUPABASE_VERSION} (UMD)\n * Sync: npm run sync:vendor: see js/vendor/vendor-manifest.json\n */\n`;
  fs.writeFileSync(vendorOut, header + body.toString('utf8'), 'utf8');
  console.log(`Wrote ${manifest['@supabase/supabase-js'].vendorPath}`);

  let changedFiles = 0;
  for (const file of walkFiles(root)) {
    const original = fs.readFileSync(file, 'utf8');
    const updated = applyCdnPins(original);
    if (updated !== original) {
      fs.writeFileSync(file, updated, 'utf8');
      changedFiles += 1;
    }
  }
  console.log(`Pinned CDN URLs in ${changedFiles} file(s).`);
  console.log(`jsPDF → ${JSPDF_VERSION}, html2canvas → ${HTML2CANVAS_VERSION}, supabase-js → ${SUPABASE_VERSION}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
