/**
 * Build js/icd10ca.js from CMS ICD-10-CM order file (used as ICD-10-CA code set).
 * Source: js/icd10cm_order_2026.txt
 * Run: npm run build:icd10ca
 */
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(ROOT, "js", "icd10cm_order_2026.txt");
const OUTPUT = path.join(ROOT, "js", "icd10ca.js");

function formatIcd10Code(raw) {
  const code = String(raw || "").trim();
  if (!code) return "";
  if (code.length <= 3) return code;
  return `${code.slice(0, 3)}.${code.slice(3)}`;
}

function escapeJsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "")
    .replace(/\n/g, " ");
}

async function build() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing source file: ${INPUT}`);
    process.exit(1);
  }

  const out = fs.createWriteStream(OUTPUT, { encoding: "utf8" });
  out.write("/** Auto-generated from icd10cm_order_2026.txt. Run: npm run build:icd10ca */\n");
  out.write("const ICD10CA_CODES = [\n");

  let count = 0;
  let skipped = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d{5})\s+(\S+)\s+(\d)\s+(.+)$/);
    if (!match) {
      skipped += 1;
      continue;
    }

    const rawCode = match[2].trim();
    const rest = match[4];
    const shortDesc = rest.slice(0, 60).trim();
    const longDesc = rest.slice(60).trim();
    const title = longDesc || shortDesc;
    const code = formatIcd10Code(rawCode);

    if (!code || !title) {
      skipped += 1;
      continue;
    }

    out.write(`  { code: "${escapeJsString(code)}", title: "${escapeJsString(title)}" },\n`);
    count += 1;
  }

  out.write("];\n\n");
  out.write("window.ICD10CA_CODES = ICD10CA_CODES;\n");
  out.write("if (typeof window.syncIcdCodeAliases === 'function') {\n");
  out.write("  window.syncIcdCodeAliases(ICD10CA_CODES, 'icd10ca');\n");
  out.write("} else {\n");
  out.write("  window.ICD_CODES = ICD10CA_CODES;\n");
  out.write("  window.ICD11_CODES = ICD10CA_CODES;\n");
  out.write("}\n");
  out.write("console.log('ICD-10-CA codes loaded:', ICD10CA_CODES.length);\n");
  out.end();

  await new Promise((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });

  const { size } = fs.statSync(OUTPUT);
  console.log(`Wrote ${count} codes to ${path.relative(ROOT, OUTPUT)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  if (skipped) console.log(`Skipped ${skipped} unparsed lines`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
