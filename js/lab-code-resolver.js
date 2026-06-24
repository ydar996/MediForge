/**
 * Browser lab/imaging code resolver: dual CPT (USA) and provincial fee codes (Canada).
 * Internal catalog keys stay LAB - #####.
 */
(function (global) {
  'use strict';

  let mapCache = null;
  let modeCache = 'Canada';
  let provinceCache = 'ON';
  let mapLoadPromise = null;

  const CODE_SYSTEM_LABELS = { ON: 'OHIP', BC: 'MSP', AB: 'AHCIP', QC: 'RAMQ' };

  function normalizeMode(mode) {
    const m = String(mode || 'Canada').trim();
    if (m.toUpperCase() === 'USA' || m === 'US') return 'USA';
    return 'Canada';
  }

  function normalizeProvince(province) {
    const p = String(province || provinceCache || 'ON').trim().toUpperCase();
    if (['BC', 'AB', 'QC', 'ON'].includes(p)) return p;
    return 'ON';
  }

  function getProvinceMap(fullMap, province) {
    const p = normalizeProvince(province);
    if (fullMap?.provinces?.[p]) return fullMap.provinces[p];
    return fullMap || { byCpt: {}, byPanelCpt: {}, byLabCode: {}, byTestName: {}, imagingByCpt: {} };
  }

  function getCodeSystemLabel(province) {
    return CODE_SYSTEM_LABELS[normalizeProvince(province)] || 'Provincial';
  }

  function extractCptFromLabCode(code) {
    const raw = String(code || '').trim();
    const match = raw.match(/^LAB\s*-\s*(.+)$/i);
    if (!match) return null;
    const segment = match[1].trim();
    if (segment.includes('/')) return segment;
    if (/^\d{4,5}$/.test(segment)) return segment;
    return segment.split(/\s+/)[0] || null;
  }

  function normalizePanelCpt(cpt) {
    return String(cpt || '').trim().replace(/\s+/g, '').split('/').filter(Boolean).join('/');
  }

  function lookupProvincialFee(cpt, labCode, name, province) {
    const cfg = getProvinceMap(mapCache, province);
    const panelKey = normalizePanelCpt(cpt);
    if (panelKey && cfg.byPanelCpt?.[panelKey]) return cfg.byPanelCpt[panelKey];
    if (labCode && cfg.byLabCode?.[labCode]) return cfg.byLabCode[labCode];
    if (name && cfg.byTestName) {
      const norm = String(name).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (norm && cfg.byTestName[norm]) return cfg.byTestName[norm];
    }
    const primary = panelKey ? panelKey.split('/')[0] : String(cpt || '').trim();
    if (primary && cfg.byCpt?.[primary]) return cfg.byCpt[primary];
    return null;
  }

  function resolveLabCode(opts) {
    const mode = normalizeMode(opts.billingMode || modeCache);
    const province = normalizeProvince(opts.province || provinceCache);
    const type = opts.type || 'lab';
    const labCode = opts.code || (opts.cpt ? 'LAB - ' + opts.cpt : null);
    const resolvedCpt = opts.cpt || extractCptFromLabCode(labCode) || extractCptFromLabCode(opts.code);
    const panelCpt = resolvedCpt && String(resolvedCpt).includes('/') ? resolvedCpt : null;
    const codeSystem = getCodeSystemLabel(province);
    const feeLabel = 'Fee Code (' + codeSystem + ')';

    if (mode === 'USA') {
      const display = panelCpt || resolvedCpt || labCode || opts.name || '';
      return {
        billingMode: 'USA',
        province,
        internalCode: labCode || opts.code,
        cpt: panelCpt || resolvedCpt,
        displayCode: display,
        claimFeeCode: panelCpt || resolvedCpt,
        codeSystem: 'CPT',
        columnLabel: 'CPT Code',
        columnLabelPlural: 'CPT Code(s)'
      };
    }

    const provMap = getProvinceMap(mapCache, province);
    const fee =
      opts.provincialFeeCode ||
      opts.ohipFeeCode ||
      lookupProvincialFee(panelCpt || resolvedCpt, labCode, opts.name, province) ||
      (type === 'imaging' && resolvedCpt ? provMap.imagingByCpt?.[String(resolvedCpt).split('/')[0]] : null);

    return {
      billingMode: 'Canada',
      province,
      internalCode: labCode || opts.code,
      cpt: panelCpt || resolvedCpt,
      ohipFeeCode: fee,
      provincialFeeCode: fee,
      displayCode: fee === 'PRIVATE' ? 'Private pay' : (fee || panelCpt || resolvedCpt || labCode || ':'),
      claimFeeCode: fee,
      cptReference: panelCpt || resolvedCpt,
      codeSystem: fee ? codeSystem : 'CPT (unmapped)',
      columnLabel: feeLabel,
      columnLabelPlural: feeLabel,
      unmapped: !fee
    };
  }

  async function loadMap() {
    if (mapCache) return mapCache;
    if (!mapLoadPromise) {
      mapLoadPromise = fetch('/config/lab-code-map-canada.json')
        .then((r) => (r.ok ? r.json() : { provinces: {}, byCpt: {}, byPanelCpt: {}, imagingByCpt: {} }))
        .catch(() => ({ provinces: {}, byCpt: {}, byPanelCpt: {}, imagingByCpt: {} }))
        .then((json) => {
          mapCache = json;
          return mapCache;
        });
    }
    return mapLoadPromise;
  }

  async function refreshMode() {
    if (global.MediForgeBillingMode?.getBillingMode) {
      modeCache = await global.MediForgeBillingMode.getBillingMode();
    }
    return modeCache;
  }

  function inferProvince() {
    const patient = global.currentPatientData || global.currentPrescription?.patient || null;
    if (patient?.province || patient?.state) {
      provinceCache = normalizeProvince(patient.province || patient.state);
    }
    return provinceCache;
  }

  async function init() {
    await Promise.all([loadMap(), refreshMode()]);
    inferProvince();
    applyDocumentLabels();
  }

  function getColumnLabel(type, province) {
    const mode = normalizeMode(modeCache);
    const prov = normalizeProvince(province || provinceCache);
    if (mode === 'USA') return type === 'imaging' ? 'CPT Code' : 'CPT Code(s)';
    return 'Fee Code (' + getCodeSystemLabel(prov) + ')';
  }

  function formatDisplayCode(item, type, province) {
    const obj = typeof item === 'object' && item ? item : { cpt: item };
    const r = resolveLabCode({
      code: obj.code,
      name: obj.name || obj.testName,
      cpt: obj.cpt,
      ohipFeeCode: obj.ohipFeeCode,
      provincialFeeCode: obj.provincialFeeCode,
      billingMode: modeCache,
      province: province || obj.province || inferProvince(),
      type: type || 'lab'
    });
    if (normalizeMode(modeCache) === 'Canada' && r.provincialFeeCode && r.cptReference) {
      return r.provincialFeeCode + ' <span style="font-size:0.85em;color:#666;">(CPT ' + r.cptReference + ')</span>';
    }
    return r.displayCode || 'N/A';
  }

  function formatFeeDisplay(fee) {
    if (fee === 'PRIVATE') return 'Private pay';
    return fee;
  }

  function formatDisplayCodePlain(item, type, province) {
    const obj = typeof item === 'object' && item ? item : { cpt: item };
    const r = resolveLabCode({
      code: obj.code,
      name: obj.name,
      cpt: obj.cpt,
      ohipFeeCode: obj.ohipFeeCode,
      billingMode: modeCache,
      province: province || obj.province || inferProvince(),
      type: type || 'lab'
    });
    return formatFeeDisplay(r.displayCode) || 'N/A';
  }

  function enrichClaimServiceLine(line) {
    const r = resolveLabCode({
      code: line.code,
      name: line.name || line.description,
      cpt: line.cpt || extractCptFromLabCode(line.code),
      ohipFeeCode: line.ohipFeeCode,
      provincialFeeCode: line.provincialFeeCode,
      billingMode: modeCache,
      province: line.province || inferProvince(),
      type: (line.category || '').toLowerCase() === 'imaging' ? 'imaging' : 'lab'
    });
    if (normalizeMode(modeCache) === 'Canada' && r.claimFeeCode) {
      return {
        ...line,
        cpt: r.cpt,
        feeCode: r.claimFeeCode,
        ohipFeeCode: r.claimFeeCode,
        provincialFeeCode: r.claimFeeCode,
        serviceCode: r.claimFeeCode,
        billingCodeSystem: r.codeSystem,
        province: r.province,
        cptReference: r.cpt
      };
    }
    return {
      ...line,
      cpt: r.cpt || line.cpt,
      feeCode: r.claimFeeCode || line.feeCode,
      serviceCode: r.claimFeeCode || line.serviceCode || line.cpt,
      billingCodeSystem: 'CPT'
    };
  }

  function enrichCatalogService(service) {
    if (!service) return service;
    const isLab =
      String(service.category || '').toLowerCase() === 'laboratory' ||
      /^LAB\s*-/i.test(String(service.code || ''));
    if (!isLab) return service;
    const cpt = service.cpt || extractCptFromLabCode(service.code);
    const r = resolveLabCode({
      code: service.code,
      name: service.name,
      cpt,
      billingMode: modeCache,
      province: service.province || inferProvince()
    });
    return {
      ...service,
      cpt,
      ohipFeeCode: r.provincialFeeCode || service.ohipFeeCode || null,
      provincialFeeCode: r.provincialFeeCode || service.provincialFeeCode || null
    };
  }

  function applyDocumentLabels() {
    const prov = inferProvince();
    const labLabel = getColumnLabel('lab', prov);
    const imgLabel = getColumnLabel('imaging', prov);
    document.querySelectorAll('[data-lab-code-header]').forEach((el) => {
      el.textContent = el.getAttribute('data-imaging') ? imgLabel : labLabel;
    });
    document.querySelectorAll('[data-billing-code-label]').forEach((el) => {
      const t = el.getAttribute('data-billing-code-type') || 'lab';
      el.textContent = getColumnLabel(t, prov);
    });
  }

  global.MediForgeLabCodes = {
    init,
    loadMap,
    refreshMode,
    getMode: () => modeCache,
    getProvince: () => provinceCache,
    setProvince: (p) => { provinceCache = normalizeProvince(p); applyDocumentLabels(); },
    getColumnLabel,
    getCodeSystemLabel,
    resolveLabCode,
    extractCptFromLabCode,
    formatDisplayCode,
    formatDisplayCodePlain,
    enrichClaimServiceLine,
    enrichCatalogService,
    applyDocumentLabels
  };

  global.mfFormatBillingCode = formatDisplayCodePlain;
  global.mfBillingCodeHeader = (type) => getColumnLabel(type || 'lab');

  global.addEventListener?.('mediforge:billingModeChanged', async () => {
    await refreshMode();
    applyDocumentLabels();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init().catch(() => {}); });
  } else {
    init().catch(() => {});
  }
})(typeof window !== 'undefined' ? window : global);
