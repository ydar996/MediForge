/**
 * Lazy-load and search Health Canada DPD formulary (js/canadian-formulary.js).
 */
(function (global) {
  "use strict";

  const SCRIPT_ID = "canadian-formulary-data-script";
  const SCRIPT_PATH = "js/canadian-formulary.js";
  const BUILD_STAMP = "20260615";

  let loadPromise = null;
  let searchIndex = null;

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

  function toPrescriptionDrug(row) {
    const d = normalizeDrug(row);
    return {
      name: d.brand || d.generic,
      generic: d.generic || d.brand,
      strength: d.strength,
      form: d.form,
      category: d.category,
      route: d.route,
      din: d.din,
      ccdd: d.ccdd,
      interactions: [],
      contraindications: [],
      source: "canadian-formulary",
    };
  }

  function buildSearchIndex() {
    if (searchIndex) return searchIndex;
    const list = global.CANADIAN_FORMULARY || [];
    searchIndex = list.map((row) => {
      const d = normalizeDrug(row);
      const haystack = [
        d.din,
        d.brand,
        d.generic,
        d.strength,
        d.form,
        d.route,
        d.ccdd,
      ]
        .join(" ")
        .toLowerCase();
      return { row, drug: toPrescriptionDrug(row), haystack };
    });
    return searchIndex;
  }

  function loadCanadianFormulary() {
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      if (Array.isArray(global.CANADIAN_FORMULARY) && global.CANADIAN_FORMULARY.length) {
        buildSearchIndex();
        resolve(global.CANADIAN_FORMULARY.length);
        return;
      }
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        existing.addEventListener("load", () => {
          buildSearchIndex();
          resolve((global.CANADIAN_FORMULARY || []).length);
        });
        existing.addEventListener("error", () => reject(new Error("Failed to load Canadian formulary")));
        return;
      }
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = `${SCRIPT_PATH}?v=${BUILD_STAMP}`;
      script.async = true;
      script.onload = () => {
        buildSearchIndex();
        resolve((global.CANADIAN_FORMULARY || []).length);
      };
      script.onerror = () => reject(new Error("Failed to load Canadian formulary"));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  function searchCanadianDrugs(term, limit = 15) {
    const q = (term || "").trim().toLowerCase();
    if (!searchIndex || q.length < 2) return [];
    const results = [];
    for (const entry of searchIndex) {
      if (entry.haystack.includes(q)) {
        results.push(entry.drug);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  function getCanadianFormularySuggestions(limit = 20) {
    if (!searchIndex) return [];
    return searchIndex.slice(0, limit).map((e) => e.drug);
  }

  function isCanadianFormularyReady() {
    return !!(searchIndex && searchIndex.length);
  }

  global.loadCanadianFormulary = loadCanadianFormulary;
  global.searchCanadianDrugs = searchCanadianDrugs;
  global.getCanadianFormularySuggestions = getCanadianFormularySuggestions;
  global.isCanadianFormularyReady = isCanadianFormularyReady;
  global.toPrescriptionDrugFromFormulary = toPrescriptionDrug;
})(window);
