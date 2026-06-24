/**
 * Build js/canadian-formulary.js from Health Canada DPD (Drug Product Database).
 * Optional CCDD DIN overlay: data/ccdd/din-ccdd.json
 *
 * Sources (open API):
 *   https://health-products.canada.ca/api/drug/drugproduct/
 *   https://health-products.canada.ca/api/drug/status/
 *   https://health-products.canada.ca/api/drug/route/
 *   https://health-products.canada.ca/api/drug/form/
 *   https://health-products.canada.ca/api/drug/activeingredient/
 *
 * Run: npm run build:formulary
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "js", "canadian-formulary.js");
const CCDD_OVERLAY = path.join(ROOT, "data", "ccdd", "din-ccdd.json");
const DPD_CACHE = path.join(ROOT, "data", "dpd-cache");

const API_BASE = "https://health-products.canada.ca/api/drug";
const ALLOWED_STATUS = new Set(["Approved", "Marketed"]);

function escapeJsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "")
    .replace(/\n/g, " ");
}

function padDin(din) {
  const digits = String(din || "").replace(/\D/g, "");
  return digits.padStart(8, "0").slice(-8);
}

function formatStrength(ing) {
  if (!ing) return "";
  const parts = [];
  if (ing.strength && String(ing.strength).trim()) {
    parts.push(String(ing.strength).trim());
  }
  if (ing.strength_unit && String(ing.strength_unit).trim()) {
    parts.push(String(ing.strength_unit).trim());
  }
  if (!parts.length && ing.dosage_value) {
    parts.push(String(ing.dosage_value).trim());
  }
  if (!parts.length && ing.dosage_unit) {
    parts.push(String(ing.dosage_unit).trim());
  }
  return parts.join(" ").trim();
}

async function fetchJson(endpoint) {
  const url = `${API_BASE}/${endpoint}/?lang=en&type=json`;
  console.log("Fetching", url);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`DPD API ${endpoint} failed: ${res.status}`);
  return res.json();
}

function loadCcddOverlay() {
  if (!fs.existsSync(CCDD_OVERLAY)) return {};
  try {
    return JSON.parse(fs.readFileSync(CCDD_OVERLAY, "utf8"));
  } catch (err) {
    console.warn("Could not read CCDD overlay:", err.message);
    return {};
  }
}

function parseDrugTxtLine(line) {
  const parts = line.split("~");
  if (parts.length < 6) return null;
  const drugCode = parseInt(parts[0], 10);
  const din = padDin(parts[3] || parts[1]);
  const brand = (parts[4] || parts[2] || "").trim();
  const descriptor = (parts[5] || "").trim();
  const category = (parts[2] || "Human").trim();
  if (!din || !brand) return null;
  return { drug_code: drugCode, din, brand, descriptor, category };
}

function loadFromExtractFiles() {
  const drugPath = path.join(DPD_CACHE, "drug.txt");
  if (!fs.existsSync(drugPath)) return null;

  console.log("Using local DPD extract:", drugPath);
  const lines = fs.readFileSync(drugPath, "utf8").split(/\r?\n/);
  const products = [];
  for (const line of lines) {
    const row = parseDrugTxtLine(line.trim());
    if (row) products.push(row);
  }
  return products.length ? products : null;
}

async function loadFromApi() {
  const [products, statuses, routes, forms, ingredients] = await Promise.all([
    fetchJson("drugproduct"),
    fetchJson("status"),
    fetchJson("route"),
    fetchJson("form"),
    fetchJson("activeingredient"),
  ]);

  const statusByDrug = new Map();
  for (const s of statuses) {
    if (!s?.drug_code) continue;
    statusByDrug.set(s.drug_code, s.status);
  }

  const routeByDrug = new Map();
  for (const r of routes) {
    if (!r?.drug_code) continue;
    if (!routeByDrug.has(r.drug_code)) {
      routeByDrug.set(r.drug_code, r.route_of_administration_name || "");
    }
  }

  const formByDrug = new Map();
  for (const f of forms) {
    if (!f?.drug_code) continue;
    if (!formByDrug.has(f.drug_code)) {
      formByDrug.set(f.drug_code, f.pharmaceutical_form_name || "");
    }
  }

  const ingredientByDrug = new Map();
  for (const ing of ingredients) {
    if (!ing?.drug_code) continue;
    if (!ingredientByDrug.has(ing.drug_code)) {
      ingredientByDrug.set(ing.drug_code, ing);
    }
  }

  const rows = [];
  for (const p of products) {
    if (p.class_name && p.class_name !== "Human") continue;
    const status = statusByDrug.get(p.drug_code);
    if (status && !ALLOWED_STATUS.has(status)) continue;

    const ing = ingredientByDrug.get(p.drug_code);
    const generic = (ing?.ingredient_name || "").trim();
    const strength = formatStrength(ing) || (p.descriptor || "").trim();
    const route = routeByDrug.get(p.drug_code) || "";
    const form = formByDrug.get(p.drug_code) || "";

    rows.push({
      drug_code: p.drug_code,
      din: padDin(p.drug_identification_number),
      brand: (p.brand_name || "").trim(),
      generic,
      strength,
      form,
      route,
      category: p.class_name || "Human",
    });
  }
  return rows;
}

async function build() {
  const ccddOverlay = loadCcddOverlay();
  let rows = loadFromExtractFiles();
  if (!rows) {
    console.log("No local drug.txt: downloading from Health Canada DPD API…");
    rows = await loadFromApi();
  }

  const seen = new Set();
  const out = fs.createWriteStream(OUTPUT, { encoding: "utf8" });
  out.write("/** Auto-generated Health Canada DPD formulary. Run: npm run build:formulary */\n");
  out.write(`/** Records: ${rows.length} (Human, Approved/Marketed). Updated: ${new Date().toISOString().slice(0, 10)} */\n`);
  out.write("const CANADIAN_FORMULARY = [\n");

  let count = 0;
  for (const row of rows) {
    const din = padDin(row.din);
    if (!din || !row.brand) continue;
    const key = din + "|" + row.brand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const ccdd = ccddOverlay[din]?.ccdd || ccddOverlay[din]?.CCDD || "";
    const ccddDisplay = ccddOverlay[din]?.display || "";

    out.write(
      `  { din: "${escapeJsString(din)}", brand: "${escapeJsString(row.brand)}", generic: "${escapeJsString(row.generic || "")}", strength: "${escapeJsString(row.strength || "")}", form: "${escapeJsString(row.form || "")}", route: "${escapeJsString(row.route || "")}", category: "${escapeJsString(row.category || "Human")}", ccdd: "${escapeJsString(ccdd)}", ccddDisplay: "${escapeJsString(ccddDisplay)}" },\n`
    );
    count += 1;
  }

  out.write("];\n\n");
  out.write("window.CANADIAN_FORMULARY = CANADIAN_FORMULARY;\n");
  out.write("window.CANADIAN_FORMULARY_BUILD = '" + new Date().toISOString().slice(0, 10) + "';\n");
  out.end();

  await new Promise((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });

  const sizeMb = (fs.statSync(OUTPUT).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  ${count} products (${sizeMb} MB)`);
  if (!Object.keys(ccddOverlay).length) {
    console.log("  Tip: add data/ccdd/din-ccdd.json for CCDD codes, then rebuild.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
