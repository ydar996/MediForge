/**
 * Pharmacy Inventory Bulk Import
 * Parses CSV or Excel (.xlsx) opening stock and imports into medication_inventory.
 * NORMALIZES medication names to MediForge format (DRUG_DATABASE) for legacy single-column format.
 * Preferred columns: generic in Medication Name; Brand Name → brand_name; Manufacturer → manufacturer;
 * Count per Card → pack_size; M/D/YYYY and ISO expiry supported.
 */
(function() {
  'use strict';

  const MONTH_MAP = { 'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12 };

  const FORM_PREFIX_MAP = {
    'TABS': 'Tablet', 'TAB': 'Tablet', 'TABSTRIPS': 'Tablet',
    'CAPS': 'Capsule', 'CAP': 'Capsule',
    'IV': 'Injection', 'IVF': 'Injection', 'INJ': 'Injection',
    'SYRUP': 'Syrup', 'SUSP': 'Suspension',
    'CREAM': 'Cream', 'OINTMENT': 'Ointment', 'GEL': 'Gel', 'LOTION': 'Lotion',
    'GUTT': 'Eye drops',
    'NEBULES': 'Nebule', 'NEBULE': 'Nebule'
  };

  const FORM_LABEL_MAP = {
    tablet: 'Tablet', tablets: 'Tablet', tab: 'Tablet', tabs: 'Tablet',
    capsule: 'Capsule', capsules: 'Capsule', cap: 'Capsule', caps: 'Capsule',
    injection: 'Injection', syrup: 'Syrup', suspension: 'Suspension',
    cream: 'Cream', ointment: 'Ointment', gel: 'Gel', lotion: 'Lotion',
    nebule: 'Nebule', nebules: 'Nebule'
  };

  const NAME_ALIAS_MAP = {
    'ATENALOL': 'Atenolol', 'PROPRANANOL': 'Propranolol', 'PROPRANOLOL': 'Propranolol',
    'PHENORBARBITONE': 'Phenobarbital', 'PHENOBARBITONE': 'Phenobarbital',
    'VARSARTAN': 'Valsartan', 'INDAPAMINE': 'Indapamide',
    'HCTZ': 'Hydrochlorothiazide', 'CHLORPHENERAMINE': 'Chlorphenamine', 'CHLOPHENERAMINE': 'Chlorphenamine',
    'ODIZAT': 'Olmesartan/Amlodipine', 'VASOPRIN': 'Aspirin', 'ACYLOR': 'Acyclovir',
    'ACECLOFENANC': 'Aceclofenac', 'CUREFANANC': 'Diclofenac', 'DICLOFENANC': 'Diclofenac',
    'PARAACETAMOL': 'Paracetamol', 'PARA': 'Paracetamol',
    'ONDANSTERON': 'Ondansetron', 'METCLOPRAMIDE': 'Metoclopramide',
    'AZITHROMYCN': 'Azithromycin', 'CEFIZONE': 'Cefixime',
    'EBECEF': 'Ceftriaxone', 'EXACEF': 'Ceftriaxone',
    'ADRENALIN': 'Epinephrine (Adrenaline)', 'ADRENALINE': 'Epinephrine (Adrenaline)',
    'HYOSCINE': 'Hyoscine', 'JURECTIC': 'Spironolactone/HCTZ',
    'MODURECTICS': 'Amiloride/HCTZ', 'TRYPSIN': 'Trypsin-Chymotrypsin',
    'B- COMPLEX': 'B Complex', 'B-COMPLEX': 'B Complex',
    'REALS NIGHT': 'Melatonin', 'FLUCOR': 'Fluoride',
    'TRYPSIN- CHYMOTRYPSIN': 'Trypsin-Chymotrypsin', 'TRYPSIN-CHYMOTRYPSIN': 'Trypsin-Chymotrypsin',
    'MALUTHER': 'Artemether/Lumefantrine', 'TAMETHER': 'Artemether/Lumefantrine', 'ARTELUM': 'Artemether/Lumefantrine',
    'P- ALAXIN': 'Artemether/Lumefantrine', 'ALAXIN': 'Artemether/Lumefantrine',
    'TELMISARTAN /HCTZ': 'Telmisartan/HCTZ', 'TELMISARTAN/HCTZ': 'Telmisartan/HCTZ',
    'LISINOPRIL / HCL': 'Lisinopril', 'LISINOPRIL/HCL': 'Lisinopril'
  };

  const HEADER_MAP = {
    medication_name: ['medication_name', 'medication', 'drug_name', 'item', 'medication name', 'generic_name', 'generic name'],
    strength: ['strength', 'dosage'],
    form: ['form', 'dosage_form', 'dosage form'],
    quantity: ['quantity', 'qty', 'stock', 'current_stock', 'quantity_on_hand', 'quantity on hand'],
    unit_of_measure: ['unit_of_measure', 'uom', 'unit of measure', 'unit'],
    expiry_date: ['expiry_date', 'expiry', 'expirary_date', 'expiration', 'expiry date'],
    unit_price: ['unit_price', 'price', 'selling_price', 'selling_price_per_unit', 'selling price per unit'],
    cost_per_unit: ['cost_per_unit', 'cost', 'cost_price', 'cost per unit'],
    price_unit: ['unit_for_pricing', 'price_unit', 'price_per', 'unit for pricing'],
    batch_number: ['batch_number', 'batch', 'batch number'],
    manufacturer: ['manufacturer', 'manufacturer_name', 'manufacturer name', 'mfg', 'maker', 'marketer', 'marketer name'],
    brand_name: ['brand_name', 'brand', 'brand name', 'trade_name', 'trade name', 'product_brand'],
    count_per_card: ['count_per_card', 'count per card', 'units_per_card', 'pack_tablets', 'blister_count'],
    pack_size: ['pack_size', 'pack size'],
    ndc: ['ndc', 'sku_ndc', 'national_drug_code'],
    barcode: ['barcode', 'ean', 'upc'],
    warehouse_location: ['warehouse_location', 'warehouse', 'location', 'site']
  };

  function toTitleCase(s) {
    if (!s || !s.trim()) return '';
    return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  function normalizeFormLabel(f) {
    if (f == null || f === '') return 'Tablet';
    const s = String(f).trim();
    if (!s) return 'Tablet';
    const k = s.toLowerCase();
    if (FORM_LABEL_MAP[k]) return FORM_LABEL_MAP[k];
    return toTitleCase(s);
  }

  function normalizeToEHRFormat(rawName) {
    if (!rawName || !rawName.trim()) return { medication_name: '', strength: '', form: 'Tablet' };
    const n = rawName.trim().toUpperCase();
    let form = 'Tablet';
    let prefix = '';
    for (const [p, fn] of Object.entries(FORM_PREFIX_MAP)) {
      if (n.startsWith(p + ' ') || n.startsWith(p)) {
        form = fn;
        prefix = p;
        break;
      }
    }
    if (n.startsWith('TABSTRYPSIN') || n.startsWith('TABSTRIPS')) {
      form = 'Tablet';
      prefix = 'TABS';
    }
    const rest = prefix ? n.substring(prefix.length).replace(/^\s+/, '') : n;
    const strengthMatch = rest.match(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*(?:\s*MG|\s*G|\s*ML|\s*MCG|\s*%|\s*IU)(?:\s*\/\s*[\w]+)?)/i)
      || rest.match(/(\d+(?:\.\d+)?(?:\/\d+)*)\s*(MG|G|ML|MCG|%)/i);
    let strength = '';
    let genericPart = rest;
    if (strengthMatch) {
      strength = strengthMatch[1].trim().replace(/\s+/g, '').toLowerCase();
      if (!strength.match(/mg|g|ml|mcg|%|iu/i)) strength += 'mg';
      genericPart = rest.substring(0, strengthMatch.index).trim();
    }
    genericPart = genericPart.replace(/\s*\([^)]+\)\s*$/i, '').trim();
    let generic = genericPart.replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
    if (!generic && rest) generic = rest;
    const aliasKey = generic.toUpperCase().replace(/\s+/g, ' ');
    if (NAME_ALIAS_MAP[aliasKey]) {
      generic = NAME_ALIAS_MAP[aliasKey];
    } else {
      generic = toTitleCase(generic);
    }
    const db = typeof window.DRUG_DATABASE !== 'undefined' ? window.DRUG_DATABASE : [];
    if (db.length && generic) {
      const gLower = generic.toLowerCase();
      const match = db.find(d => (d.name || '').toLowerCase() === gLower);
      if (match) generic = match.name;
    }
    return { medication_name: generic, strength, form };
  }

  function parseQuantity(qtyStr) {
    if (typeof qtyStr === 'number' && !isNaN(qtyStr)) {
      return { quantity: Math.max(0, Math.floor(qtyStr)), unit: null };
    }
    if (!qtyStr || !String(qtyStr).trim()) return { quantity: 0, unit: 'PCS' };
    const s = String(qtyStr).trim().toUpperCase();
    const numMatch = s.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)?$/i) || s.match(/^(\d+)([A-Z]+)$/i);
    if (numMatch) {
      const qty = parseInt(numMatch[1], 10) || 0;
      let unit = (numMatch[2] || 'PCS').trim();
      if (!unit) unit = 'PCS';
      if (['PACK', 'PACKS', 'PK', 'PKS'].some(u => unit.includes(u))) unit = 'PACKS';
      if (['TAB', 'TABS'].some(u => unit.includes(u))) unit = 'TABS';
      if (['BOTTLE', 'BOTTLES'].some(u => unit.includes(u))) unit = 'BOTTLES';
      if (['VIAL', 'VIALS'].some(u => unit.includes(u))) unit = 'VIALS';
      if (['TUBE', 'TUBES'].some(u => unit.includes(u))) unit = 'TUBES';
      if (['CARD', 'CARDS'].some(u => unit.includes(u))) unit = 'CARDS';
      if (['AMP', 'AMPOULES', 'AMPOULE'].some(u => unit.includes(u))) unit = 'AMPOULES';
      if (['BOX', 'BOXES'].some(u => unit.includes(u))) unit = 'BOXES';
      if (['SACHET', 'SACHETS'].some(u => unit.includes(u))) unit = 'SACHETS';
      return { quantity: qty, unit };
    }
    if (/^PCS$/i.test(s)) return { quantity: 1, unit: 'PCS' };
    return { quantity: 1, unit: 'PCS' };
  }

  /** Excel/Sheets serial date → YYYY-MM-DD (UTC noon to avoid TZ drift) */
  function excelSerialToIso(n) {
    if (typeof n !== 'number' || isNaN(n)) return null;
    const utc = Math.round((n - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  /**
   * Slash dates: if first part > 12 → D/M/Y; else if second > 12 → M/D/Y; else M/D/Y (Excel US default).
   */
  function parseSlashDate(s) {
    const m = String(s).trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (!m) return null;
    let p1 = parseInt(m[1], 10);
    let p2 = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    let month; let day;
    if (p1 > 12) { day = p1; month = p2; }
    else if (p2 > 12) { month = p1; day = p2; }
    else { month = p1; day = p2; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function parseExpiry(expStr) {
    if (expStr == null || expStr === '') return null;
    if (expStr instanceof Date && !isNaN(expStr.getTime())) {
      return expStr.toISOString().slice(0, 10);
    }
    if (typeof expStr === 'number' && !isNaN(expStr)) {
      const iso = excelSerialToIso(expStr);
      if (iso) return iso;
    }
    const s = String(expStr).trim();
    if (!s) return null;
    const mmyy = s.match(/^([A-Za-z]{3})-(\d{2})$/) || s.match(/^(\d{1,2})-([A-Za-z]{3})$/);
    if (mmyy) {
      const monthStr = mmyy[1].length === 3 ? mmyy[1] : mmyy[2];
      const yearPart = mmyy[1].length === 3 ? mmyy[2] : mmyy[1];
      const month = MONTH_MAP[monthStr] || 1;
      const y = parseInt(yearPart, 10);
      const year = y < 50 ? 2000 + y : 1900 + y;
      return `${year}-${String(month).padStart(2, '0')}-01`;
    }
    const slash = parseSlashDate(s);
    if (slash) return slash;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const tryDate = new Date(s);
    if (!isNaN(tryDate.getTime())) return tryDate.toISOString().slice(0, 10);
    return null;
  }

  function parseUnitPrice(priceStr) {
    if (priceStr == null || priceStr === '') return { price: null, unit: null };
    const s = String(priceStr).trim();
    if (!s) return { price: null, unit: null };
    const withUnit = s.match(/^([\d.]+)\s*\/\s*([A-Z]+)$/i) || s.match(/^([\d.]+)\/([A-Z]+)$/i);
    if (withUnit) {
      return { price: parseFloat(withUnit[1]) || 0, unit: withUnit[2].toUpperCase() };
    }
    const num = parseFloat(s.replace(/[^\d.]/g, ''));
    if (isNaN(num)) return { price: null, unit: null };
    return { price: num, unit: null };
  }

  function parsePackSize(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'number' && !isNaN(val)) {
      const n = Math.round(val);
      return n > 0 ? n : null;
    }
    const s = String(val).trim();
    if (!s) return null;
    const n = parseInt(s.replace(/[^\d]/g, ''), 10);
    if (isNaN(n) || n <= 0) return null;
    return n;
  }

  /** RFC-style CSV →2D array of strings */
  function parseCSVTextToRows(csvText) {
    const text = csvText.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cur);
        cur = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur);
        cur = '';
        if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
    row.push(cur);
    if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
    return rows;
  }

  function normalizeHeaders(rawHeaders) {
    return rawHeaders.map(h => String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_'));
  }

  function colIndex(headers, logicalKey) {
    const keys = HEADER_MAP[logicalKey] || [logicalKey];
    for (const k of keys) {
      const idx = headers.indexOf(k);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function cell(parts, idx) {
    if (idx < 0) return '';
    const v = parts[idx];
    if (v == null) return '';
    return String(v).trim();
  }

  function mergeDuplicateRow(seenRow, incoming) {
    if (!seenRow.brand_name && incoming.brand_name) seenRow.brand_name = incoming.brand_name;
    if (!seenRow.manufacturer && incoming.manufacturer) seenRow.manufacturer = incoming.manufacturer;
    if (seenRow.pack_size == null && incoming.pack_size != null) seenRow.pack_size = incoming.pack_size;
    if (!seenRow.batch_number && incoming.batch_number) seenRow.batch_number = incoming.batch_number;
    if (!seenRow.expiry_date && incoming.expiry_date) seenRow.expiry_date = incoming.expiry_date;
    if ((seenRow.selling_price_per_unit == null || seenRow.selling_price_per_unit === 0) && incoming.selling_price_per_unit != null) {
      seenRow.selling_price_per_unit = incoming.selling_price_per_unit;
    }
    if (seenRow.cost_per_unit == null && incoming.cost_per_unit != null) seenRow.cost_per_unit = incoming.cost_per_unit;
    if (!seenRow.price_unit && incoming.price_unit) seenRow.price_unit = incoming.price_unit;
  }

  function parsePreferredRows(rows, rawHeaders, headers) {
    const items = [];
    const idx = {
      med: colIndex(headers, 'medication_name'),
      str: colIndex(headers, 'strength'),
      form: colIndex(headers, 'form'),
      qty: colIndex(headers, 'quantity'),
      uom: colIndex(headers, 'unit_of_measure'),
      exp: colIndex(headers, 'expiry_date'),
      price: colIndex(headers, 'unit_price'),
      cost: colIndex(headers, 'cost_per_unit'),
      punit: colIndex(headers, 'price_unit'),
      batch: colIndex(headers, 'batch_number'),
      mfg: colIndex(headers, 'manufacturer'),
      brand: colIndex(headers, 'brand_name'),
      cpc: colIndex(headers, 'count_per_card'),
      pks: colIndex(headers, 'pack_size'),
      ndc: colIndex(headers, 'ndc'),
      barcode: colIndex(headers, 'barcode'),
      wh: colIndex(headers, 'warehouse_location')
    };

    for (let i = 1; i < rows.length; i++) {
      const parts = (rows[i] || []).map(c => (c == null ? '' : c));
      const medName = cell(parts, idx.med);
      if (!medName) continue;
      const qtyStr = cell(parts, idx.qty) || '0';
      const rawQty = parts[idx.qty];
      let quantity = 0;
      let unitFromQty = null;
      if (typeof rawQty === 'number' && !isNaN(rawQty)) {
        quantity = Math.max(0, Math.floor(rawQty));
      } else {
        const pq = parseQuantity(qtyStr);
        quantity = pq.quantity;
        unitFromQty = pq.unit;
      }
      const unit = cell(parts, idx.uom) || unitFromQty || 'PCS';
      const expRaw = idx.exp >= 0 ? parts[idx.exp] : '';
      const expiry = parseExpiry(expRaw) || (expRaw && /^\d{4}-\d{2}-\d{2}/.test(String(expRaw)) ? String(expRaw).substring(0, 10) : null);
      const priceStr = cell(parts, idx.price);
      const { price, unit: priceUnit } = parseUnitPrice(priceStr);
      const priceUnitCol = cell(parts, idx.punit);
      const costStr = cell(parts, idx.cost);
      const costNum = costStr ? (parseFloat(String(costStr).replace(/[^\d.-]/g, '')) || null) : null;
      const batchVal = cell(parts, idx.batch) || null;
      const mfg = cell(parts, idx.mfg) || null;
      const brand = cell(parts, idx.brand) || null;
      let packSize = parsePackSize(idx.pks >= 0 ? parts[idx.pks] : null);
      if (packSize == null && idx.cpc >= 0) packSize = parsePackSize(parts[idx.cpc]);
      const ndcVal = cell(parts, idx.ndc) || null;
      const barcodeVal = cell(parts, idx.barcode) || null;
      const warehouseVal = cell(parts, idx.wh) || null;
      const strength = cell(parts, idx.str) || '—';
      const form = normalizeFormLabel(cell(parts, idx.form));

      items.push({
        medication_name: medName.trim(),
        generic_name: medName.trim(),
        strength,
        form,
        current_stock: quantity || parseInt(qtyStr, 10) || 0,
        unit_of_measure: unit,
        expiry_date: expiry,
        selling_price_per_unit: price,
        cost_per_unit: costNum,
        price_unit: priceUnitCol || priceUnit || null,
        batch_number: batchVal,
        manufacturer: mfg || undefined,
        brand_name: brand || undefined,
        pack_size: packSize != null ? packSize : undefined,
        minimum_stock: 5,
        maximum_stock: 1000,
        ndc: ndcVal || undefined,
        barcode: barcodeVal || undefined,
        warehouse_location: warehouseVal || undefined
      });
    }
    return items;
  }

  function parseLegacyRows(rows) {
    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const parts = (rows[i] || []).map(c => String(c ?? '').trim());
      const line0 = parts[0] || '';
      if (/^S\/NO/i.test(line0) || /^S\/\/NO/i.test(line0) || /^list of/i.test(line0)) continue;
      if (parts.length < 4) continue;
      const medName = parts[1];
      if (!medName) continue;
      const { quantity, unit } = parseQuantity(parts[2]);
      const expiry = parseExpiry(parts[3]);
      const { price, unit: priceUnit } = parseUnitPrice(parts[4] || '');
      const { medication_name, strength, form } = normalizeToEHRFormat(medName);
      items.push({
        medication_name: medication_name || medName.trim(),
        generic_name: medication_name || medName.trim(),
        strength: strength || '—',
        form: normalizeFormLabel(form || 'Tablet'),
        current_stock: quantity,
        unit_of_measure: unit,
        expiry_date: expiry,
        selling_price_per_unit: price,
        price_unit: priceUnit,
        minimum_stock: 5,
        maximum_stock: 1000
      });
    }
    return items;
  }

  /**
   * Parse first worksheet as a 2D grid (row 0 = headers). Used by CSV and Excel.
   */
  window.parsePharmacyInventorySheetRows = function(rows) {
    if (!rows || rows.length < 2) return [];
    const rawHeaders = rows[0].map(c => String(c ?? '').trim());
    const headers = normalizeHeaders(rawHeaders);
    const isPreferred = (headers.includes('medication_name') || headers.includes('medication') || rawHeaders.some(h => /medication|drug|item|generic/i.test(h)))
      && (headers.includes('strength') || headers.includes('dosage'))
      && (headers.includes('form') || headers.includes('dosage_form'));
    if (isPreferred) return parsePreferredRows(rows, rawHeaders, headers);
    return parseLegacyRows(rows);
  };

  window.parsePharmacyInventoryCSV = function(csvText) {
    if (!csvText || !String(csvText).trim()) return [];
    const rows = parseCSVTextToRows(String(csvText).trim());
    return window.parsePharmacyInventorySheetRows(rows);
  };

  /**
   * Parse .xlsx / .xls ArrayBuffer (requires SheetJS as global XLSX).
   */
  window.parsePharmacyInventoryExcelBuffer = function(arrayBuffer) {
    if (typeof XLSX === 'undefined') throw new Error('Excel support not loaded (XLSX).');
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const name = wb.SheetNames[0];
    if (!name) return [];
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    return window.parsePharmacyInventorySheetRows(rows);
  };

  const BATCH_SIZE = 80;
  const UPDATE_CONCURRENCY = 28;

  function toKey(item) {
    return (item.medication_name || '') + '|' + (item.strength || '') + '|' + (item.form || '');
  }

  function costDiffersImport(a, b) {
    const na = a == null || a === '' ? null : parseFloat(a);
    const nb = b == null || b === '' ? null : parseFloat(b);
    if (na == null && nb == null) return false;
    if (na == null || nb == null) return true;
    return Math.round(na * 100) !== Math.round(nb * 100);
  }

  function isLotsTableMissing(err) {
    if (!err) return false;
    const msg = String(err.message || '');
    return err.code === '42P01' || err.code === 'PGRST205' || msg.includes('inventory_lots');
  }

  /**
   * One round-trip each for purchase transactions, lots, and price history (opening cost seed).
   */
  async function batchInsertOpeningFollowUps(supabase, orgId, user, rowOrigPairs, errors) {
    const changedBy = user.username || 'unknown';
    const uid = user.id || user.user_id || null;
    const effectiveFrom = new Date().toISOString();
    const txRows = [];
    const lotRows = [];
    const priceRows = [];

    for (const { row, orig } of rowOrigPairs) {
      const stk = row.current_stock || 0;
      if (stk <= 0) continue;
      const rc = row.cost_per_unit != null ? parseFloat(row.cost_per_unit) : null;
      const uc = rc != null && !isNaN(rc) ? rc : null;
      const tx = {
        inventory_id: row.id,
        organization_id: orgId,
        transaction_type: 'purchase',
        quantity: stk,
        balance_after: stk,
        performed_by_username: changedBy,
        performed_by_user_id: uid,
        notes: 'Bulk import · opening stock'
      };
      if (uc != null) {
        tx.unit_cost = Math.round(uc * 10000) / 10000;
        tx.extended_cost = Math.round(stk * uc * 100) / 100;
      }
      txRows.push(tx);

      const lot = {
        organization_id: orgId,
        inventory_id: row.id,
        quantity_on_hand: stk,
        batch_number: (orig && orig.batch_number) || null,
        expiry_date: (orig && orig.expiry_date) || null,
        source: 'bulk_import',
        notes: 'Bulk import · opening stock layer',
        received_at: effectiveFrom
      };
      if (uc != null) lot.unit_cost = Math.round(uc * 10000) / 10000;
      lotRows.push(lot);

      if (uc != null && !isNaN(uc) && costDiffersImport(null, uc)) {
        priceRows.push({
          organization_id: orgId,
          inventory_id: row.id,
          field_changed: 'cost_per_unit',
          old_value: null,
          new_value: uc,
          old_value_text: null,
          new_value_text: null,
          effective_from: effectiveFrom,
          changed_by: changedBy,
          changed_by_user_id: uid
        });
      }
    }

    if (lotRows.length) {
      const { error: lErr } = await supabase.from('inventory_lots').insert(lotRows);
      if (lErr && !isLotsTableMissing(lErr)) {
        errors.push({ item: 'inventory_lots batch', error: lErr.message || String(lErr) });
      }
    }

    if (txRows.length) {
      let { error: tErr } = await supabase.from('inventory_transactions').insert(txRows);
      if (tErr && (tErr.code === '42703' || String(tErr.message || '').includes('unit_cost'))) {
        txRows.forEach(r => {
          delete r.unit_cost;
          delete r.extended_cost;
        });
        tErr = (await supabase.from('inventory_transactions').insert(txRows)).error;
      }
      if (tErr) {
        errors.push({ item: 'inventory_transactions batch', error: tErr.message || String(tErr) });
      }
    }

    if (priceRows.length) {
      try {
        const { error: pErr } = await supabase.from('inventory_price_history').insert(priceRows);
        if (pErr && pErr.code !== '42P01' && !String(pErr.message || '').includes('does not exist')) {
          errors.push({ item: 'inventory_price_history batch', error: pErr.message || String(pErr) });
        } else if (!pErr && typeof logAuditEvent === 'function') {
          await logAuditEvent('inventory_bulk_opening_costs_recorded', {
            organization_id: orgId,
            rows: priceRows.length,
            source: 'bulk_import_opening',
            performed_by: changedBy
          });
        }
      } catch (e) {
        if (e.code !== '42P01' && !String(e.message || '').includes('does not exist')) {
          errors.push({ item: 'inventory_price_history batch', error: (e && e.message) || String(e) });
        }
      }
    }
  }

  window.importPharmacyOpeningStock = async function(parsedItems, options = {}) {
    const { replaceExisting = false, currency = null, onProgress = null } = options;
    const curr = currency || (typeof window.getDefaultCurrency === 'function' ? window.getDefaultCurrency() : 'CAD');
    const supabase = typeof window.getPharmacySupabaseClient === 'function' ? await window.getPharmacySupabaseClient() : null;
    const orgId = typeof window.getPharmacyOrgId === 'function' ? await window.getPharmacyOrgId() : null;
    if (!supabase || !orgId) throw new Error('Pharmacy client or org not available');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    function emitProgress(payload) {
      if (!onProgress) return;
      const workDone = payload.workDone != null ? payload.workDone : 0;
      const workTotal = Math.max(1, payload.workTotal || 1);
      let etaSeconds = null;
      if (workDone > 0 && workTotal > workDone) {
        const elapsedSec = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) / 1000;
        const rate = workDone / Math.max(elapsedSec, 0.05);
        etaSeconds = Math.max(0, Math.round((workTotal - workDone) / Math.max(rate, 0.001)));
      }
      onProgress(Object.assign({ currency: curr }, payload, { etaSeconds, workTotal }));
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    emitProgress({
      phase: 'preparing',
      phaseLabel: 'Loading existing inventory…',
      workDone: 0,
      workTotal: 1,
      rowsInFile: parsedItems.length
    });
    const { data: existingRows } = await supabase
      .from('medication_inventory')
      .select('id, medication_name, strength, form, current_stock, cost_per_unit')
      .eq('organization_id', orgId)
      .eq('is_active', true);

    const existingMap = {};
    (existingRows || []).forEach(r => {
      existingMap[toKey(r)] = {
        id: r.id,
        current_stock: r.current_stock || 0,
        cost_per_unit: r.cost_per_unit
      };
    });

    const deduped = [];
    const seen = {};
    for (const item of parsedItems) {
      const key = toKey(item);
      if (seen[key]) {
        seen[key].current_stock = (seen[key].current_stock || 0) + (item.current_stock || 0);
        mergeDuplicateRow(seen[key], item);
      } else {
        seen[key] = { ...item, current_stock: item.current_stock || 0 };
        deduped.push(seen[key]);
      }
    }

    const toInsert = [];
    const toUpdate = [];
    for (const item of deduped) {
      const key = toKey(item);
      const ex = existingMap[key];
      if (ex && !replaceExisting) {
        skipped++;
        continue;
      }
      if (ex) {
        toUpdate.push({
          ...item,
          existingId: ex.id,
          existingStock: ex.current_stock,
          existingCost: ex.cost_per_unit
        });
      } else {
        const insertPayload = {
          organization_id: orgId,
          medication_name: item.medication_name,
          generic_name: item.generic_name || item.medication_name,
          strength: item.strength,
          form: item.form,
          route: 'oral',
          current_stock: item.current_stock || 0,
          minimum_stock: item.minimum_stock || 5,
          maximum_stock: item.maximum_stock || 1000,
          unit_of_measure: item.unit_of_measure || 'PCS',
          selling_price_per_unit: item.selling_price_per_unit != null ? item.selling_price_per_unit : 0,
          cost_per_unit: item.cost_per_unit ?? null,
          expiry_date: item.expiry_date || null,
          batch_number: item.batch_number || null,
          is_active: true,
          created_by: user.username
        };
        if (item.price_unit) insertPayload.price_unit = item.price_unit;
        if (item.manufacturer) insertPayload.manufacturer = item.manufacturer;
        if (item.brand_name) insertPayload.brand_name = item.brand_name;
        if (item.pack_size != null) insertPayload.pack_size = item.pack_size;
        if (item.ndc) insertPayload.ndc = item.ndc;
        if (item.barcode) insertPayload.barcode = item.barcode;
        if (item.warehouse_location) insertPayload.warehouse_location = item.warehouse_location;
        toInsert.push(insertPayload);
      }
    }

    const workTotal = 1 + toInsert.length + toUpdate.length;
    let workDone = 1;
    emitProgress({
      phase: 'running',
      phaseLabel: 'Importing new items',
      workDone,
      workTotal,
      rowsInFile: parsedItems.length,
      uniqueSkus: deduped.length,
      newCount: toInsert.length,
      updateCount: toUpdate.length,
      skippedCount: skipped,
      subLabel: `${parsedItems.length} rows in file · ${deduped.length} unique SKUs · ${toInsert.length} new · ${toUpdate.length} updates · ${skipped} skipped (already in inventory)`
    });

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { data: insertedRows, error } = await supabase.from('medication_inventory').insert(batch).select('id, medication_name, current_stock, cost_per_unit');
      if (error) {
        batch.forEach((_, idx) => errors.push({ item: batch[idx].medication_name, error: error.message }));
      } else {
        const n = (insertedRows || []).length;
        imported += n;
        const pairs = [];
        for (let j = 0; j < n; j++) {
          pairs.push({ row: insertedRows[j], orig: batch[j] || {} });
        }
        try {
          await batchInsertOpeningFollowUps(supabase, orgId, user, pairs, errors);
        } catch (e) {
          errors.push({ item: 'batch follow-up', error: (e && e.message) || String(e) });
        }
        workDone += n;
        emitProgress({
          phase: 'inserting',
          phaseLabel: 'New items',
          workDone,
          workTotal,
          rowsInFile: parsedItems.length,
          newCount: toInsert.length,
          updateCount: toUpdate.length,
          skippedCount: skipped,
          subLabel: `${Math.min(i + BATCH_SIZE, toInsert.length)} / ${toInsert.length} new saved`
        });
      }
    }

    emitProgress({
      phase: 'updating',
      phaseLabel: 'Updating existing rows',
      workDone,
      workTotal,
      rowsInFile: parsedItems.length,
      newCount: toInsert.length,
      updateCount: toUpdate.length,
      skippedCount: skipped
    });
    for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
      const chunk = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async u => {
          try {
            const oldQty = u.existingStock || 0;
            const addQty = u.current_stock || 0;
            const newStock = oldQty + addQty;
            const oldCost = u.existingCost;
            const rc = u.cost_per_unit != null && u.cost_per_unit !== '' ? parseFloat(u.cost_per_unit) : null;
            let newWac;
            if (addQty > 0 && rc != null && !isNaN(rc)) {
              newWac =
                typeof window.computeInventoryWeightedAverageCost === 'function'
                  ? window.computeInventoryWeightedAverageCost(oldQty, oldCost, addQty, rc)
                  : Math.round(((oldQty * (parseFloat(oldCost) || 0) + addQty * rc) / (oldQty + addQty)) * 100) / 100;
            } else if (addQty > 0) {
              newWac = oldCost != null && oldCost !== '' ? parseFloat(oldCost) : null;
            } else if (rc != null && !isNaN(rc)) {
              newWac = Math.round(rc * 100) / 100;
            } else {
              newWac = oldCost != null && oldCost !== '' ? parseFloat(oldCost) : null;
            }

            const updatePayload = {
              current_stock: newStock,
              expiry_date: u.expiry_date || null,
              unit_of_measure: u.unit_of_measure || 'PCS',
              updated_at: new Date().toISOString(),
              cost_per_unit: newWac
            };
            if (u.selling_price_per_unit != null) updatePayload.selling_price_per_unit = u.selling_price_per_unit;
            if (rc != null && !isNaN(rc)) updatePayload.last_purchase_cost = Math.round(rc * 100) / 100;
            if (u.batch_number != null) updatePayload.batch_number = u.batch_number;
            if (u.price_unit) updatePayload.price_unit = u.price_unit;
            if (u.manufacturer) updatePayload.manufacturer = u.manufacturer;
            if (u.brand_name) updatePayload.brand_name = u.brand_name;
            if (u.pack_size != null) updatePayload.pack_size = u.pack_size;
            if (u.generic_name) updatePayload.generic_name = u.generic_name;

            const { error: upErr } = await supabase.from('medication_inventory').update(updatePayload).eq('id', u.existingId);
            if (upErr) return { error: upErr };

            const followUps = [];
            if (typeof window.recordInventoryCostPerUnitChange === 'function') {
              followUps.push(
                window.recordInventoryCostPerUnitChange(
                  supabase,
                  orgId,
                  u.existingId,
                  u.medication_name,
                  oldCost,
                  newWac,
                  {
                    changedBy: user.username,
                    changedByUserId: user.id || user.user_id,
                    source: 'bulk_import',
                    reason:
                      addQty > 0 && rc != null
                        ? 'Receipt ' + addQty + ' @ ' + rc + ' → WAC ' + (newWac != null ? newWac : '—')
                        : addQty > 0
                          ? 'Stock +' + addQty + ' (no receipt cost)'
                          : rc != null
                            ? 'Cost-only update'
                            : null
                  }
                )
              );
            }
            if (addQty > 0 && typeof window.recordInventoryPurchaseTransaction === 'function') {
              followUps.push(
                window.recordInventoryPurchaseTransaction(supabase, {
                  inventoryId: u.existingId,
                  orgId,
                  quantity: addQty,
                  balanceAfter: newStock,
                  unitCost: rc != null && !isNaN(rc) ? rc : null,
                  performedByUsername: user.username,
                  performedByUserId: user.id || user.user_id,
                  notes:
                    'Bulk import · receipt unit cost ' +
                    (rc != null ? rc : 'n/a') +
                    ' · WAC after ' +
                    (newWac != null ? newWac : 'n/a')
                })
              );
            }
            if (addQty > 0 && typeof window.addInventoryReceiptLot === 'function') {
              followUps.push(
                window.addInventoryReceiptLot(supabase, {
                  orgId,
                  inventoryId: u.existingId,
                  quantity: addQty,
                  unitCost: rc != null && !isNaN(rc) ? rc : newWac,
                  batchNumber: u.batch_number || null,
                  expiryDate: u.expiry_date || null,
                  source: 'bulk_import',
                  notes: 'Bulk import · receipt layer'
                })
              );
            }
            if (followUps.length) await Promise.all(followUps);

            return { error: null };
          } catch (e) {
            return { error: { message: (e && e.message) || String(e) } };
          }
        })
      );
      const ok = results.filter(r => !r.error).length;
      updated += ok;
      results.forEach((r, idx) => {
        if (r.error) errors.push({ item: chunk[idx].medication_name, error: r.error.message });
      });
      workDone += chunk.length;
      emitProgress({
        phase: 'updating',
        phaseLabel: 'Updating existing rows',
        workDone,
        workTotal,
        rowsInFile: parsedItems.length,
        newCount: toInsert.length,
        updateCount: toUpdate.length,
        skippedCount: skipped,
        subLabel: `${Math.min(i + UPDATE_CONCURRENCY, toUpdate.length)} / ${toUpdate.length} updates processed`
      });
    }

    emitProgress({
      phase: 'done',
      phaseLabel: 'Completed',
      workDone: workTotal,
      workTotal,
      rowsInFile: parsedItems.length,
      imported,
      updated,
      skippedCount: skipped,
      errorCount: errors.length
    });
    return { imported, updated, skipped, errors };
  };
})();
