/**
 * Verify Health Canada LNHPD NHP bundle exists and meets minimum size.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORMULARY = path.join(ROOT, "js", "canadian-nhp-formulary.js");
const MIN_PRODUCTS = 50000;
const MIN_BYTES = 5_000_000;

function fail(msg) {
  console.error("check:nhp-formulary FAIL:", msg);
  process.exit(1);
}

if (!fs.existsSync(FORMULARY)) {
  fail("missing js/canadian-nhp-formulary.js — run: npm run build:nhp-formulary");
}

const stat = fs.statSync(FORMULARY);
if (stat.size < MIN_BYTES) {
  fail(`js/canadian-nhp-formulary.js too small (${stat.size} bytes) — rebuild`);
}

const text = fs.readFileSync(FORMULARY, "utf8");
const count = (text.match(/\{\s*npn:/g) || []).length;
if (count < MIN_PRODUCTS) {
  fail(`only ${count} NHP products (expected >= ${MIN_PRODUCTS})`);
}

const buildMatch = text.match(/CANADIAN_NHP_FORMULARY_BUILD\s*=\s*'([^']+)'/);
const build = buildMatch ? buildMatch[1] : "unknown";
const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
console.log(`check:nhp-formulary OK — ${count} products, ${sizeMb} MB, build ${build}`);
