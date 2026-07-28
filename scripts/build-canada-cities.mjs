/**
 * Build Canada cities into js/us-ca-cities-data.js from GeoNames CA dump.
 * Usage: node scripts/build-canada-cities.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const caTxt = path.join(root, 'tmp-geo', 'geonames-ca', 'CA.txt');
const outPath = path.join(root, 'js', 'us-ca-cities-data.js');

const ADMIN1_TO_PROVINCE = {
  '01': 'Alberta',
  '02': 'British Columbia',
  '03': 'Manitoba',
  '04': 'New Brunswick',
  '05': 'Newfoundland and Labrador',
  '07': 'Nova Scotia',
  '08': 'Ontario',
  '09': 'Prince Edward Island',
  '10': 'Quebec',
  '11': 'Saskatchewan',
  '12': 'Yukon',
  '13': 'Northwest Territories',
  '14': 'Nunavut'
};

const KEEP_CODES = new Set([
  'PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC', 'PPLG', 'PPLS'
]);

const MUST_INCLUDE = {
  Ontario: ['Brantford', 'Milton', 'Ajax', 'Peterborough', 'Sault Ste. Marie', 'North Bay', 'Belleville', 'Sarnia', 'Welland', 'Woodstock', 'Cornwall', 'Newmarket', 'Aurora', 'Caledon', 'Clarington', 'Chatham-Kent', 'Kawartha Lakes', 'Timmins', 'Orillia', 'Stratford', 'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor'],
  Alberta: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Fort McMurray'],
  'British Columbia': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Kelowna', 'Abbotsford', 'Kamloops', 'Nanaimo', 'Prince George'],
  Quebec: ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Saguenay', 'Trois-Rivières'],
  Manitoba: ['Winnipeg', 'Brandon', 'Steinbach'],
  Saskatchewan: ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw'],
  'Nova Scotia': ['Halifax', 'Dartmouth', 'Sydney', 'Truro'],
  'New Brunswick': ['Saint John', 'Moncton', 'Fredericton'],
  'Newfoundland and Labrador': ["St. John's", 'Corner Brook', 'Gander'],
  'Prince Edward Island': ['Charlottetown', 'Summerside'],
  Yukon: ['Whitehorse'],
  'Northwest Territories': ['Yellowknife'],
  Nunavut: ['Iqaluit']
};

if (!fs.existsSync(caTxt)) {
  console.error('Missing', caTxt);
  process.exit(1);
}

const byProvince = Object.fromEntries(
  Object.values(ADMIN1_TO_PROVINCE).map((p) => [p, new Map()])
);

for (const line of fs.readFileSync(caTxt, 'utf8').split(/\r?\n/)) {
  if (!line) continue;
  const cols = line.split('\t');
  const name = cols[1];
  const ascii = cols[2];
  const fclass = cols[6];
  const fcode = cols[7];
  const admin1 = cols[10];
  const population = Number(cols[14] || 0);
  if (fclass !== 'P' || !KEEP_CODES.has(fcode)) continue;
  const province = ADMIN1_TO_PROVINCE[admin1];
  if (!province) continue;
  const city = (ascii || name || '').trim();
  if (!city || /^\d/.test(city)) continue;
  const prev = byProvince[province].get(city);
  if (!prev || population > prev) byProvince[province].set(city, population);
}

for (const [prov, cities] of Object.entries(MUST_INCLUDE)) {
  for (const c of cities) {
    if (!byProvince[prov].has(c)) byProvince[prov].set(c, 1);
  }
}

const canada = {};
for (const prov of Object.values(ADMIN1_TO_PROVINCE).sort((a, b) => a.localeCompare(b))) {
  canada[prov] = [...byProvince[prov].keys()].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  );
}

const existing = fs.readFileSync(outPath, 'utf8');
const usStart = existing.indexOf("  'United States':");
if (usStart < 0) {
  console.error('United States block not found');
  process.exit(1);
}
const usBlock = existing.slice(usStart);

function serializeCanada(obj) {
  return Object.entries(obj)
    .map(([prov, cities]) => {
      const arr = cities.map((c) => JSON.stringify(c)).join(', ');
      return `    ${JSON.stringify(prov)}: [${arr}]`;
    })
    .join(',\n');
}

const header = `/**
 * Cities by state/province for Canada and United States (registration & address forms).
 * Canada: GeoNames CA populated places (PPL*) via scripts/build-canada-cities.mjs
 * United States: curated major cities.
 * Canadian postal codes are typed by the user (format-validated), not listed here.
 */
window.US_CA_CITIES_BY_STATE = {
  Canada: {
${serializeCanada(canada)}
  },
`;

fs.writeFileSync(outPath, header + usBlock.replace(/^\s*'United States'/, "  'United States'").replace(/^  'United States'/, "  'United States'"), 'utf8');

// Normalize: ensure file ends properly
let final = fs.readFileSync(outPath, 'utf8');
if (!final.trimEnd().endsWith('};')) {
  // usBlock should already include closing
}
fs.writeFileSync(outPath, final, 'utf8');

console.log('Ontario cities:', canada.Ontario.length, 'Brantford:', canada.Ontario.includes('Brantford'));
console.log('Total CA cities:', Object.values(canada).reduce((n, a) => n + a.length, 0));
for (const [p, c] of Object.entries(canada)) console.log(`  ${p}: ${c.length}`);
