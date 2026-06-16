/**
 * Lazy-load and search Health Canada DPD + LNHPD (js/canadian-formulary.js, js/canadian-nhp-formulary.js).
 */
(function (global) {
  "use strict";

  const DPD_SCRIPT_ID = "canadian-formulary-data-script";
  const DPD_SCRIPT_PATH = "js/canadian-formulary.js";
  const NHP_SCRIPT_ID = "canadian-nhp-formulary-data-script";
  const NHP_SCRIPT_PATH = "js/canadian-nhp-formulary.js";
  const BUILD_STAMP = "20260617";

  let dpdLoadPromise = null;
  let nhpLoadPromise = null;
  let dpdSearchIndex = null;
  let nhpSearchIndex = null;
  let dpdSuggestionCache = null;

  function normalizeDrug(row) {
    const brand = (row.brand || row.name || "").trim();
    const generic = (row.generic || brand).trim();
    const strength = (row.strength || "").trim();
    const form = (row.form || "").trim();
    const route = (row.route || "").trim();
    const category = (row.category || "Human").trim();
    const din = (row.din || "").trim();
    const ccdd = (row.ccdd || "").trim();
    const displayName = brand || generic;
    return {
      din,
      ccdd,
      npn: "",
      brand,
      generic,
      name: displayName,
      strength: strength || "See product label",
      form: form || route || "Product",
      route,
      category,
      ccddDisplay: row.ccddDisplay || "",
      source: "dpd",
    };
  }

  function normalizeNhp(row) {
    const brand = (row.brand || "").trim();
    const npn = (row.npn || "").trim();
    const form = (row.form || "").trim();
    return {
      din: "",
      ccdd: "",
      npn,
      brand,
      generic: brand,
      name: brand,
      strength: "See product label",
      form: form || "Product",
      route: "",
      category: row.category || "Natural Health Product",
      company: row.company || "",
      source: "nhp",
    };
  }

  function toPrescriptionDrug(row, source) {
    const d = source === "nhp" ? normalizeNhp(row) : normalizeDrug(row);
    return {
      name: d.brand || d.generic,
      generic: d.generic || d.brand,
      strength: d.strength,
      form: d.form,
      category: d.category,
      route: d.route,
      din: d.din,
      npn: d.npn,
      ccdd: d.ccdd,
      company: d.company || "",
      interactions: [],
      contraindications: [],
      source: source === "nhp" ? "canadian-nhp" : "canadian-formulary",
    };
  }

  function buildDpdSearchIndex() {
    if (dpdSearchIndex) return dpdSearchIndex;
    const list = global.CANADIAN_FORMULARY || [];
    dpdSearchIndex = list.map((row) => {
      const d = normalizeDrug(row);
      const brandLower = d.brand.toLowerCase();
      const genericLower = d.generic.toLowerCase();
      const dinLower = d.din.toLowerCase();
      const haystack = [d.din, d.brand, d.generic, d.strength, d.form, d.route, d.ccdd].join(" ").toLowerCase();
      return { row, drug: toPrescriptionDrug(row, "dpd"), haystack, brandLower, genericLower, idLower: dinLower, source: "dpd" };
    });
    dpdSuggestionCache = null;
    return dpdSearchIndex;
  }

  function buildNhpSearchIndex() {
    if (nhpSearchIndex) return nhpSearchIndex;
    const list = global.CANADIAN_NHP_FORMULARY || [];
    nhpSearchIndex = list.map((row) => {
      const d = normalizeNhp(row);
      const brandLower = d.brand.toLowerCase();
      const npnLower = d.npn.toLowerCase();
      const companyLower = (d.company || "").toLowerCase();
      const haystack = [d.npn, d.brand, d.form, d.company, d.category].join(" ").toLowerCase();
      return { row, drug: toPrescriptionDrug(row, "nhp"), haystack, brandLower, genericLower: brandLower, idLower: npnLower, companyLower, source: "nhp" };
    });
    return nhpSearchIndex;
  }

  function scoreEntry(entry, q) {
    if (!q) return 0;
    if (entry.idLower === q) return 120;
    if (entry.idLower.startsWith(q)) return 110;
    if (entry.brandLower.startsWith(q)) return 100;
    if (entry.genericLower.startsWith(q)) return 95;
    if (entry.brandLower.includes(q)) return 80;
    if (entry.genericLower.includes(q)) return 75;
    if (entry.companyLower && entry.companyLower.includes(q)) return 60;
    if (entry.haystack.includes(q)) return 50;
    return 0;
  }

  function loadScript(id, path, globalCheck) {
    return new Promise((resolve, reject) => {
      if (globalCheck()) {
        resolve(true);
        return;
      }
      const existing = document.getElementById(id);
      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", () => reject(new Error("Failed to load " + path)));
        return;
      }
      const script = document.createElement("script");
      script.id = id;
      script.src = `${path}?v=${BUILD_STAMP}`;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Failed to load " + path));
      document.head.appendChild(script);
    });
  }

  function loadCanadianFormulary() {
    if (dpdLoadPromise) return dpdLoadPromise;
    dpdLoadPromise = loadScript(DPD_SCRIPT_ID, DPD_SCRIPT_PATH, () => Array.isArray(global.CANADIAN_FORMULARY) && global.CANADIAN_FORMULARY.length)
      .then(() => {
        buildDpdSearchIndex();
        return (global.CANADIAN_FORMULARY || []).length;
      });
    return dpdLoadPromise;
  }

  function loadCanadianNhpFormulary() {
    if (nhpLoadPromise) return nhpLoadPromise;
    nhpLoadPromise = loadScript(NHP_SCRIPT_ID, NHP_SCRIPT_PATH, () => Array.isArray(global.CANADIAN_NHP_FORMULARY) && global.CANADIAN_NHP_FORMULARY.length)
      .then(() => {
        buildNhpSearchIndex();
        return (global.CANADIAN_NHP_FORMULARY || []).length;
      });
    return nhpLoadPromise;
  }

  function loadAllCanadianFormularies() {
    return Promise.all([loadCanadianFormulary(), loadCanadianNhpFormulary()]).then(([dpd, nhp]) => ({ dpd, nhp }));
  }

  function searchIndexEntries(term, limit, sources) {
    const q = (term || "").trim().toLowerCase();
    if (q.length < 2) return [];
    const useNhp = !sources || sources.includes("nhp");
    const useDpd = !sources || sources.includes("dpd");
    const indexes = [];
    if (useDpd && dpdSearchIndex) indexes.push(dpdSearchIndex);
    if (useNhp && nhpSearchIndex) indexes.push(nhpSearchIndex);

    const scored = [];
    for (const index of indexes) {
      for (const entry of index) {
        const score = scoreEntry(entry, q);
        if (score > 0) scored.push({ drug: entry.drug, score, source: entry.source });
      }
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.drug.name || "").localeCompare(b.drug.name || "");
    });

    const seen = new Set();
    const out = [];
    for (const item of scored) {
      const key = `${item.source}|${item.drug.npn || item.drug.din || ""}|${(item.drug.name || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item.drug);
      if (out.length >= limit) break;
    }
    return out;
  }

  function searchCanadianDrugs(term, limit = 15) {
    return searchIndexEntries(term, limit, ["dpd", "nhp"]);
  }

  function searchCanadianNhpProducts(term, limit = 15) {
    return searchIndexEntries(term, limit, ["nhp"]);
  }

  function getCanadianFormularySuggestions(limit = 20) {
    if (!dpdSearchIndex) return [];
    if (!dpdSuggestionCache) {
      dpdSuggestionCache = dpdSearchIndex.map((e) => e.drug).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return dpdSuggestionCache.slice(0, limit);
  }

  function isCanadianFormularyReady() {
    return !!((dpdSearchIndex && dpdSearchIndex.length) || (nhpSearchIndex && nhpSearchIndex.length));
  }

  function getCanadianFormularyMeta() {
    return {
      ready: isCanadianFormularyReady(),
      dpdCount: dpdSearchIndex ? dpdSearchIndex.length : (global.CANADIAN_FORMULARY || []).length,
      nhpCount: nhpSearchIndex ? nhpSearchIndex.length : (global.CANADIAN_NHP_FORMULARY || []).length,
      dpdBuild: global.CANADIAN_FORMULARY_BUILD || null,
      nhpBuild: global.CANADIAN_NHP_FORMULARY_BUILD || null,
    };
  }

  global.loadCanadianFormulary = loadCanadianFormulary;
  global.loadCanadianNhpFormulary = loadCanadianNhpFormulary;
  global.loadAllCanadianFormularies = loadAllCanadianFormularies;
  global.searchCanadianDrugs = searchCanadianDrugs;
  global.searchCanadianNhpProducts = searchCanadianNhpProducts;
  global.getCanadianFormularySuggestions = getCanadianFormularySuggestions;
  global.isCanadianFormularyReady = isCanadianFormularyReady;
  global.getCanadianFormularyMeta = getCanadianFormularyMeta;
  global.toPrescriptionDrugFromFormulary = (row) => toPrescriptionDrug(row, row.npn ? "nhp" : "dpd");
})(window);
