/**
 * Build js/canadian-nhp-formulary.js from Health Canada LNHPD (ProductLicence bulk API).
 * Run: npm run build:nhp-formulary
 *
 * API: https://health-products.canada.ca/api/natural-licences/ProductLicence/?lang=en&type=json
 * Optional cache: data/nhp-cache/product-licences.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "js", "canadian-nhp-formulary.js");
const CACHE_DIR = path.join(ROOT, "data", "nhp-cache");
const CACHE_FILE = path.join(CACHE_DIR, "product-licences.json");
const API_URL = "https://health-products.canada.ca/api/natural-licences/ProductLicence/?lang=en&type=json";

function escapeJsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "")
    .replace(/\n/g, " ");
}

function padNpn(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.padStart(8, "0").slice(-8);
}

async function loadLicences() {
  if (fs.existsSync(CACHE_FILE)) {
    console.log("Using local cache:", CACHE_FILE);
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  }
  console.log("Downloading LNHPD ProductLicence bulk JSON…");
  const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`LNHPD API failed: ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.data || [];
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(rows), "utf8");
  console.log("Cached", rows.length, "licences to", CACHE_FILE);
  return rows;
}

function normalizeRow(row) {
  const npn = padNpn(row.licence_number);
  const brand = (row.product_name || "").trim();
  if (!npn || !brand) return null;
  if (row.flag_product_status !== 1) return null;
  if (row.flag_primary_name !== 1) return null;
  return {
    npn,
    lnhpd_id: row.lnhpd_id || "",
    brand,
    form: (row.dosage_form || "").trim(),
    company: (row.company_name || "").trim(),
    licence_date: row.licence_date || "",
    category: "Natural Health Product",
    sub_type: row.sub_submission_type_desc || "",
  };
}

async function build() {
  const rows = await loadLicences();
  const seen = new Set();
  const out = fs.createWriteStream(OUTPUT, { encoding: "utf8" });
  out.write("/** Auto-generated Health Canada LNHPD formulary. Run: npm run build:nhp-formulary */\n");

  let count = 0;
  out.write("const CANADIAN_NHP_FORMULARY = [\n");

  for (const row of rows) {
    const d = normalizeRow(row);
    if (!d) continue;
    const key = d.npn + "|" + d.brand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.write(
      `  { npn: "${escapeJsString(d.npn)}", brand: "${escapeJsString(d.brand)}", form: "${escapeJsString(d.form)}", company: "${escapeJsString(d.company)}", category: "${escapeJsString(d.category)}", subType: "${escapeJsString(d.sub_type)}", lnhpdId: "${escapeJsString(String(d.lnhpd_id || ""))}" },\n`
    );
    count += 1;
  }

  out.write("];\n\n");
  out.write("window.CANADIAN_NHP_FORMULARY = CANADIAN_NHP_FORMULARY;\n");
  out.write(`window.CANADIAN_NHP_FORMULARY_BUILD = '${new Date().toISOString().slice(0, 10)}';\n`);
  out.end();

  await new Promise((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });

  const sizeMb = (fs.statSync(OUTPUT).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  ${count} active primary NHP products (${sizeMb} MB)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
