/**
 * Patient-reported medication search/browse for add-patient and patient intake.
 * Prioritizes Canadian OTC list, supports free-text entry when not in list.
 */
(function (global) {
  const DEFAULT_IDS = {
    medName: "med-name",
    medDosage: "med-dosage",
    medicationSuggestions: "medication-suggestions",
    dosageSuggestions: "dosage-suggestions",
    customButton: "med-use-custom-name-btn"
  };

  const SEARCH_LIMIT = 25;
  const BROWSE_OTC_LIMIT = 60;
  const BROWSE_FORMULARY_LIMIT = 40;

  let activeIds = { ...DEFAULT_IDS };
  let searchIndex = null;
  let formularyLoadTriggered = false;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeDrug(entry) {
    return {
      name: entry.name || "",
      generic: entry.generic || entry.name || "",
      strength: entry.strength || "",
      form: entry.form || "",
      category: entry.category || "Medication",
      interactions: entry.interactions || [],
      contraindications: entry.contraindications || []
    };
  }

  function drugKey(drug) {
    return `${(drug.name || "").trim().toLowerCase()}|${(drug.generic || "").trim().toLowerCase()}`;
  }

  function normalizeFormularyDrug(entry) {
    return {
      name: entry.name || entry.brand || "",
      generic: entry.generic || entry.name || "",
      strength: entry.strength || "",
      form: entry.form || "",
      category: entry.category || "Health Canada DPD",
      din: entry.din || "",
      interactions: entry.interactions || [],
      contraindications: entry.contraindications || []
    };
  }

  function isFormularyReady() {
    return typeof global.isCanadianFormularyReady === "function" && global.isCanadianFormularyReady();
  }

  function ensureFormularyLoading() {
    if (typeof global.loadCanadianFormulary !== "function") return Promise.resolve();
    if (!formularyLoadTriggered) {
      formularyLoadTriggered = true;
      return global.loadCanadianFormulary().catch(() => {});
    }
    return Promise.resolve();
  }

  function searchFormulary(query, limit) {
    if (!isFormularyReady() || typeof global.searchCanadianDrugs !== "function") return null;
    return global.searchCanadianDrugs(query, limit).map(normalizeFormularyDrug);
  }

  function mergeDrugLists(primary, secondary) {
    const seen = new Set();
    const merged = [];
    primary.concat(secondary || []).forEach((drug) => {
      const key = drugKey(drug);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(drug);
    });
    return merged;
  }

  function getOtcList() {
    return Array.isArray(global.COMMON_OTC_MEDICATIONS_CA)
      ? global.COMMON_OTC_MEDICATIONS_CA.map(normalizeDrug)
      : [];
  }

  function getPatientReportedMedicationPool() {
    // Patient-reported browse: OTC shortcuts only. Search uses Health Canada DPD formulary.
    return getOtcList();
  }

  function buildSearchIndex() {
    searchIndex = getPatientReportedMedicationPool().map((drug) => ({
      drug,
      nameLower: String(drug.name || "").toLowerCase(),
      genericLower: String(drug.generic || "").toLowerCase(),
      categoryLower: String(drug.category || "").toLowerCase()
    }));
    return searchIndex;
  }

  function getSearchIndex() {
    if (!searchIndex) return buildSearchIndex();
    return searchIndex;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function metaLine(drug) {
    return [drug.strength, drug.form, drug.category].filter(Boolean).join(" | ");
  }

  function suggestionStyle() {
    return "padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;";
  }

  function renderDrugSuggestion(drug) {
    return `
      <div class="medication-suggestion" data-name="${escapeHtml(drug.name)}" data-strength="${escapeHtml(drug.strength)}" data-form="${escapeHtml(drug.form)}" data-category="${escapeHtml(drug.category)}" style="${suggestionStyle()}">
        <div style="font-weight: 600; color: #333;">${escapeHtml(drug.name)}</div>
        <div style="font-size: 12px; color: #666;">${escapeHtml(metaLine(drug))}</div>
      </div>`;
  }

  function renderCustomSuggestion(label) {
    return `
      <div class="medication-suggestion medication-suggestion-custom" data-custom="true" data-name="${escapeHtml(label)}" style="${suggestionStyle()} background: #f0f7ff;">
        <div style="font-weight: 600; color: #0b3356;">Use "${escapeHtml(label)}" (not in list)</div>
        <div style="font-size: 12px; color: #666;">Self-entered patient-reported medication</div>
      </div>`;
  }

  function hideSuggestions(container) {
    if (container) container.style.display = "none";
  }

  function bindOutsideClick(container, medNameId) {
    setTimeout(() => {
      const handler = function (event) {
        if (!event.target.closest(`#${medNameId}`) && !event.target.closest(`#${activeIds.medicationSuggestions}`)) {
          hideSuggestions(container);
          document.removeEventListener("click", handler);
        }
      };
      document.addEventListener("click", handler);
    }, 100);
  }

  function bindDrugSuggestionClicks(container) {
    Array.from(container.querySelectorAll(".medication-suggestion")).forEach((node) => {
      node.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      node.addEventListener("click", () => {
        if (node.dataset.custom === "true") {
          selectCustomMedication(node.dataset.name || "");
        } else {
          selectMedication(
            node.dataset.name || "",
            node.dataset.strength || "",
            node.dataset.form || "",
            node.dataset.category || ""
          );
        }
      });
    });
  }

  const DEFAULT_DOSAGE_PLACEHOLDER = "e.g. 500 mg twice daily";

  function enableManualDosage(placeholder) {
    const dosageInput = el(activeIds.medDosage);
    if (!dosageInput) return;
    dosageInput.readOnly = false;
    dosageInput.removeAttribute("readonly");
    dosageInput.placeholder = placeholder || DEFAULT_DOSAGE_PLACEHOLDER;
  }

  function resetDosageField() {
    const dosageInput = el(activeIds.medDosage);
    if (!dosageInput) return;
    dosageInput.value = "";
    dosageInput.readOnly = false;
    dosageInput.removeAttribute("readonly");
    dosageInput.placeholder = DEFAULT_DOSAGE_PLACEHOLDER;
    hideSuggestions(el(activeIds.dosageSuggestions));
  }

  function confirmCustomFromInput() {
    const medNameInput = el(activeIds.medName);
    if (!medNameInput) return false;
    const query = medNameInput.value.trim();
    if (!query) return false;
    selectCustomMedication(query);
    return true;
  }

  function selectMedication(name, strength, form, category) {
    const medNameInput = el(activeIds.medName);
    const suggestionsDiv = el(activeIds.medicationSuggestions);
    const dosageInput = el(activeIds.medDosage);
    if (!medNameInput) return;

    medNameInput.value = name;
    global.selectedMedication = { name, strength, form, category };

    if (strength) {
      populateDosageDropdown(strength.split(",").map((s) => s.trim()).filter(Boolean));
      if (dosageInput) dosageInput.value = "";
      enableManualDosage("Choose a suggested dosage or type your own");
    } else {
      if (dosageInput) dosageInput.value = "";
      enableManualDosage("Enter dosage (e.g. 1 tablet daily)");
    }

    hideSuggestions(suggestionsDiv);
  }

  function selectCustomMedication(name) {
    const medNameInput = el(activeIds.medName);
    const suggestionsDiv = el(activeIds.medicationSuggestions);
    if (!medNameInput) return;

    medNameInput.value = name;
    global.selectedMedication = { name, strength: "", form: "", category: "Patient-reported" };
    hideSuggestions(el(activeIds.dosageSuggestions));
    enableManualDosage("Enter dosage (e.g. 1 tablet daily)");
    hideSuggestions(suggestionsDiv);
  }

  function populateDosageDropdown(strengths) {
    const dosageSuggestions = el(activeIds.dosageSuggestions);
    if (!dosageSuggestions) return;

    dosageSuggestions.innerHTML = strengths.map((strength) => `
      <div class="dosage-suggestion" data-dosage="${escapeHtml(strength)}" style="${suggestionStyle()}">
        <div style="font-weight: 600; color: #333;">${escapeHtml(strength)}</div>
      </div>
    `).join("");

    Array.from(dosageSuggestions.querySelectorAll(".dosage-suggestion")).forEach((node) => {
      node.addEventListener("click", () => selectDosage(node.dataset.dosage || ""));
    });
  }

  function selectDosage(dosage) {
    const dosageInput = el(activeIds.medDosage);
    const dosageSuggestions = el(activeIds.dosageSuggestions);
    if (!dosageInput) return;
    dosageInput.value = dosage;
    hideSuggestions(dosageSuggestions);
  }

  function showMedicationSuggestions(drugs, customQuery) {
    const suggestionsDiv = el(activeIds.medicationSuggestions);
    if (!suggestionsDiv) return;

    const trimmed = (customQuery || "").trim();
    let html = "";
    if (trimmed) {
      html += renderCustomSuggestion(trimmed);
    }
    html += drugs.map(renderDrugSuggestion).join("");

    if (!html) {
      hideSuggestions(suggestionsDiv);
      return;
    }

    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = "block";
    bindDrugSuggestionClicks(suggestionsDiv);
    bindOutsideClick(suggestionsDiv, activeIds.medName);
  }

  function searchMedications() {
    const input = el(activeIds.medName);
    if (!input) return;

    const query = input.value.trim();
    const queryLower = query.toLowerCase();

    if (!query) {
      hideSuggestions(el(activeIds.medicationSuggestions));
      global.selectedMedication = null;
      resetDosageField();
      return;
    }

    enableManualDosage();

    const formularyMatches = searchFormulary(query, SEARCH_LIMIT);
    if (formularyMatches) {
      showMedicationSuggestions(formularyMatches, query);
      return;
    }

    const matches = getSearchIndex().filter((item) =>
      item.nameLower.includes(queryLower) ||
      item.genericLower.includes(queryLower) ||
      item.categoryLower.includes(queryLower)
    ).slice(0, SEARCH_LIMIT).map((item) => item.drug);

    showMedicationSuggestions(matches, query);

    if (!isFormularyReady()) {
      ensureFormularyLoading().then(() => {
        const currentQuery = (el(activeIds.medName) || {}).value;
        if (!currentQuery || currentQuery.trim() !== query) return;
        const retry = searchFormulary(query, SEARCH_LIMIT);
        if (retry) showMedicationSuggestions(retry, query);
      });
    }
  }

  function showAllMedications() {
    const otc = getOtcList().slice(0, BROWSE_OTC_LIMIT);
    const input = el(activeIds.medName);
    let browseList = otc;

    if (isFormularyReady() && typeof global.getCanadianFormularySuggestions === "function") {
      const formularyBrowse = global.getCanadianFormularySuggestions(BROWSE_FORMULARY_LIMIT)
        .map(normalizeFormularyDrug);
      browseList = mergeDrugLists(otc, formularyBrowse);
    } else {
      ensureFormularyLoading();
    }

    showMedicationSuggestions(browseList, input ? input.value.trim() : "");
  }

  function searchDosages() {
    const dosageInput = el(activeIds.medDosage);
    const dosageSuggestions = el(activeIds.dosageSuggestions);
    if (!dosageInput || !dosageSuggestions) return;

    const searchTerm = dosageInput.value.toLowerCase();
    const strengths = (global.selectedMedication && global.selectedMedication.strength)
      ? global.selectedMedication.strength.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    if (!strengths.length) {
      hideSuggestions(dosageSuggestions);
      return;
    }

    const matches = strengths.filter((strength) => strength.toLowerCase().includes(searchTerm));
    if (!matches.length) {
      hideSuggestions(dosageSuggestions);
      return;
    }

    populateDosageDropdown(matches);
    dosageSuggestions.style.display = "block";
  }

  function showAllDosages() {
    const dosageSuggestions = el(activeIds.dosageSuggestions);
    if (!global.selectedMedication || !global.selectedMedication.strength) {
      enableManualDosage("Enter dosage (e.g. 1 tablet daily)");
      return;
    }

    const strengths = global.selectedMedication.strength.split(",").map((s) => s.trim()).filter(Boolean);
    populateDosageDropdown(strengths);
    if (dosageSuggestions) dosageSuggestions.style.display = "block";
  }

  function handleMedicationKeydown(event) {
    if (event.key === " " && !event.target.value.trim()) {
      event.preventDefault();
      showAllMedications();
    }
    if (event.key === "Enter") {
      const query = event.target.value.trim();
      if (query) {
        event.preventDefault();
        selectCustomMedication(query);
      }
    }
  }

  function handleMedicationBlur() {
    const medNameInput = el(activeIds.medName);
    if (!medNameInput) return;
    const query = medNameInput.value.trim();
    if (!query) return;
    if (global.selectedMedication && global.selectedMedication.name === query) return;
    selectCustomMedication(query);
  }

  function handleDosageKeydown(event) {
    if (event.key === " " && !event.target.value.trim()) {
      event.preventDefault();
      showAllDosages();
    }
  }

  function resetFields(ids) {
    activeIds = { ...DEFAULT_IDS, ...(ids || {}) };
    global.selectedMedication = null;
    resetDosageField();
    hideSuggestions(el(activeIds.medicationSuggestions));
    searchIndex = null;
  }

  function setup(ids, options) {
    activeIds = { ...DEFAULT_IDS, ...(ids || {}) };
    const opts = options || {};
    buildSearchIndex();

    const medNameInput = el(activeIds.medName);
    const medDosageInput = el(activeIds.medDosage);
    if (!medNameInput || !medDosageInput) return;

    const debounceMs = opts.debounceMs || 200;
    let timer = null;
    const debouncedSearch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(searchMedications, debounceMs);
    };

    medNameInput.addEventListener("input", () => {
      const query = medNameInput.value.trim();
      if (query) {
        enableManualDosage();
      } else {
        global.selectedMedication = null;
        resetDosageField();
      }
      debouncedSearch();
    });
    medNameInput.addEventListener("keydown", handleMedicationKeydown);
    medNameInput.addEventListener("blur", handleMedicationBlur);
    medNameInput.addEventListener("focus", showAllMedications);
    medNameInput.addEventListener("click", showAllMedications);

    medDosageInput.addEventListener("input", searchDosages);
    medDosageInput.addEventListener("keydown", handleDosageKeydown);
    medDosageInput.addEventListener("focus", () => {
      if (medNameInput.value.trim()) {
        enableManualDosage();
      }
      if (global.selectedMedication && global.selectedMedication.strength) {
        showAllDosages();
      }
    });

    const customBtn = el(activeIds.customButton);
    if (customBtn) {
      customBtn.addEventListener("click", (event) => {
        event.preventDefault();
        if (!confirmCustomFromInput()) {
          alert("Enter a medication name first, then click this button to use it.");
          el(activeIds.medName)?.focus();
        } else {
          el(activeIds.medDosage)?.focus();
        }
      });
    }

    resetFields(activeIds);
  }

  global.MediForgePatientReportedMeds = {
    setup,
    resetFields,
    searchMedications,
    showAllMedications,
    selectMedication,
    selectCustomMedication,
    confirmCustomFromInput,
    searchDosages,
    showAllDosages,
    handleMedicationKeydown,
    handleMedicationBlur,
    handleDosageKeydown,
    getPool: getPatientReportedMedicationPool,
    getOtcList
  };

  // Backward-compatible globals used by add-patient inline handlers
  global.searchMedications = searchMedications;
  global.selectMedication = selectMedication;
  global.showAllMedications = showAllMedications;
  global.searchDosages = searchDosages;
  global.selectDosage = selectDosage;
  global.showAllDosages = showAllDosages;
  global.handleMedicationKeydown = handleMedicationKeydown;
  global.handleDosageKeydown = handleDosageKeydown;
  global.initializeMedicationSearch = function initializeMedicationSearch() {
    setup();
  };
})(window);
