/**
 * Verify Health Canada DPD formulary bundle exists and meets minimum size.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORMULARY = path.join(ROOT, "js", "canadian-formulary.js");
const SEARCH = path.join(ROOT, "js", "canadian-formulary-search.js");
const MIN_PRODUCTS = 10000;
const MIN_BYTES = 1_500_000;

function fail(msg) {
  console.error("check:formulary FAIL:", msg);
  process.exit(1);
}

if (!fs.existsSync(SEARCH)) {
  fail("missing js/canadian-formulary-search.js");
}

if (!fs.existsSync(FORMULARY)) {
  fail("missing js/canadian-formulary.js: run: npm run build:formulary");
}

const stat = fs.statSync(FORMULARY);
if (stat.size < MIN_BYTES) {
  fail(`js/canadian-formulary.js too small (${stat.size} bytes): rebuild with npm run build:formulary`);
}

const text = fs.readFileSync(FORMULARY, "utf8");
const productMatches = text.match(/\{\s*din:/g);
const count = productMatches ? productMatches.length : 0;
if (count < MIN_PRODUCTS) {
  fail(`only ${count} products (expected >= ${MIN_PRODUCTS}): run: npm run build:formulary`);
}

const buildMatch = text.match(/CANADIAN_FORMULARY_BUILD\s*=\s*'([^']+)'/);
const build = buildMatch ? buildMatch[1] : "unknown";
const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);

console.log(`check:formulary OK: ${count} products, ${sizeMb} MB, build ${build}`);
