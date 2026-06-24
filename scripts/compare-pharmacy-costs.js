#!/usr/bin/env node
/**
 * Compare pharmacy-cost-example.csv with pharmacy-opening-stock-ehr-format.csv
 * Output: items from cost-example with cost prices that are NOT in opening-stock
 */

const fs = require('fs');
const path = require('path');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || (c === '\n' && !inQuotes)) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
      if (c === '\n') break;
    } else {
      current += c;
    }
  }
  if (current) result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseCostPrice(val) {
  if (!val || val.trim() === '') return null;
  const cleaned = String(val).replace(/[₦,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeMedName(desc) {
  if (!desc) return { name: '', strength: '', form: 'Tablet' };
  let s = String(desc)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*pk of \d+\s*/gi, ' ')
    .replace(/\s*pk of \d+vials?\s*/gi, ' ')
    .replace(/\s*x \d+\s*/gi, ' ')
    .replace(/\s*\d+\s*(btls?|pcks?|pks?|tubes?|vials?|ampoules?)\s*\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const formMatch = s.match(/\b(Tab\.?|Tabs?|Cap\.?|Caps?|Syr\.?|Inj\.?|IVF?|Susp\.?|Cream|Ointment|Gel|Lotion|Gutt\.?|Suppositories?|Inhaler|Nebules?)\b/i);
  let form = 'Tablet';
  if (formMatch) {
    const f = formMatch[1].toLowerCase();
    if (f.startsWith('tab')) form = 'Tablet';
    else if (f.startsWith('cap')) form = 'Capsule';
    else if (f.startsWith('syr')) form = 'Syrup';
    else if (f.startsWith('inj') || f.startsWith('iv')) form = 'Injection';
    else if (f.startsWith('susp')) form = 'Suspension';
    else if (f.startsWith('cream')) form = 'Cream';
    else if (f.startsWith('ointment')) form = 'Ointment';
    else if (f.startsWith('gel')) form = 'Gel';
    else if (f.startsWith('lotion')) form = 'Lotion';
    else if (f.startsWith('gutt')) form = 'Eye drops';
    else if (f.startsWith('supp')) form = 'Suppository';
    else if (f.startsWith('inhaler')) form = 'Inhaler';
    else if (f.startsWith('nebul')) form = 'Nebule';
    s = s.replace(formMatch[0], '').trim();
  }
  const strengthMatch = s.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%|iu)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%))?)/i);
  let strength = strengthMatch ? strengthMatch[1].replace(/\s+/g, '') : ':';
  let name = s.replace(strengthMatch ? strengthMatch[0] : '', '').replace(/[,.]/g, '').trim();
  name = name.replace(/^\s*(tab|cap|syr|inj|iv|gutt)\.?\s*/i, '').trim() || name;
  return { name: name || ':', strength, form };
}

function toKey(item) {
  const n = (item.medication_name || item.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const s = (item.strength || '').toLowerCase().replace(/\s+/g, '').trim();
  const f = (item.form || 'Tablet').toLowerCase();
  return `${n}|${s}|${f}`;
}

function fuzzyKey(name, strength, form) {
  const n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const s = String(strength || '').toLowerCase().replace(/\s+/g, '').trim();
  const f = String(form || 'Tablet').toLowerCase();
  return `${n}|${s}|${f}`;
}

const dataDir = path.join(__dirname, '..', 'data');
const costPath = path.join(dataDir, 'pharmacy-cost-example.csv');
const stockPath = path.join(dataDir, 'pharmacy-opening-stock-ehr-format.csv');

const costLines = fs.readFileSync(costPath, 'utf8').split(/\r?\n/).filter(l => l.trim());
const stockLines = fs.readFileSync(stockPath, 'utf8').split(/\r?\n/).filter(l => l.trim());

const stockKeys = new Set();
const stockHeader = stockLines[0].split(',').map(h => h.trim().toLowerCase());
const nameIdx = stockHeader.findIndex(h => h.includes('medication') || h === 'medication_name');
const strIdx = stockHeader.findIndex(h => h.includes('strength') || h === 'strength');
const formIdx = stockHeader.findIndex(h => h.includes('form') || h === 'form');

for (let i = 1; i < stockLines.length; i++) {
  const parts = stockLines[i].split(',').map(p => p.replace(/^"|"$/g, '').trim());
  const name = (parts[nameIdx] || '').trim();
  const strength = (parts[strIdx] || ':').trim();
  const form = (parts[formIdx] || 'Tablet').trim();
  if (name) stockKeys.add(fuzzyKey(name, strength, form));
}

const costHeader = costLines[0];
const costCols = parseCSVLine(costHeader);
const itemIdx = costCols.findIndex(c => /item|description|activities/i.test(c));
const priceIdx = costCols.findIndex(c => /amt|unit|price|naira/i.test(c));
const qtyIdx = costCols.findIndex(c => /^qty/i.test(c));

const notInStock = [];
for (let i = 1; i < costLines.length; i++) {
  const parts = parseCSVLine(costLines[i]);
  const itemDesc = (parts[itemIdx] || parts[1] || '').trim();
  const priceVal = parts[priceIdx] !== undefined ? parts[priceIdx] : parts[3];
  const cost = parseCostPrice(priceVal);
  if (!itemDesc || itemDesc.startsWith('(') || /^[A-Z]\)\.?\s*$/.test(itemDesc) || /^EMERGENCY|^$/.test(itemDesc)) continue;
  if (cost == null || cost <= 0) continue;
  const { name, strength, form } = normalizeMedName(itemDesc);
  if (!name || name === ':') continue;
  const key = fuzzyKey(name, strength, form);
  if (stockKeys.has(key)) continue;
  let found = false;
  for (const sk of stockKeys) {
    const [sn, ss, sf] = sk.split('|');
    if (name.toLowerCase().includes(sn) || sn.includes(name.toLowerCase())) {
      if ((!strength || !ss || strength === ss) && (form === sf || !sf)) {
        found = true;
        break;
      }
    }
  }
  if (!found) {
    notInStock.push({
      original_description: itemDesc,
      medication_name: name,
      strength: strength === ':' ? '' : strength,
      form,
      cost_per_unit: cost,
      quantity: parseInt(parts[qtyIdx] || parts[4] || '0', 10) || ''
    });
  }
}

const outPath = path.join(dataDir, 'pharmacy-cost-items-not-in-inventory.csv');
const header = 'Original Description,Medication Name,Strength,Form,Cost per Unit,Quantity';
const rows = notInStock.map(r =>
  `"${(r.original_description || '').replace(/"/g, '""')}","${(r.medication_name || '').replace(/"/g, '""')}","${(r.strength || '').replace(/"/g, '""')}","${(r.form || '').replace(/"/g, '""')}",${r.cost_per_unit},${r.quantity}`
);
fs.writeFileSync(outPath, header + '\n' + rows.join('\n'), 'utf8');
console.log(`Wrote ${notInStock.length} items to ${outPath}`);
console.log('Sample:', notInStock.slice(0, 5).map(r => r.original_description));
