/**
 * Patient-reported medication search/browse for add-patient and patient intake.
 * Prioritizes Canadian OTC list, supports free-text entry when not in list.
 */
(function (global) {
  const DEFAULT_IDS = {
    medName: "med-name",
    medDosage: "med-dosage",
    medicationSuggestions: "medication-suggestions",
    dosageSuggestions: "dosage-suggestions"
  };

  const SEARCH_LIMIT = 25;
  const BROWSE_OTC_LIMIT = 60;

  let activeIds = { ...DEFAULT_IDS };
  let searchIndex = null;

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

  function getOtcList() {
    return Array.isArray(global.COMMON_OTC_MEDICATIONS_CA)
      ? global.COMMON_OTC_MEDICATIONS_CA.map(normalizeDrug)
      : [];
  }

  function getPatientReportedMedicationPool() {
    const seen = new Set();
    const pool = [];
    const otc = getOtcList();
    const clinical = Array.isArray(global.DRUG_DATABASE)
      ? global.DRUG_DATABASE.map(normalizeDrug)
      : [];

    otc.concat(clinical).forEach((drug) => {
      const key = drugKey(drug);
      if (seen.has(key)) return;
      seen.add(key);
      pool.push(drug);
    });
    return pool;
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

  function enableManualDosage(placeholder) {
    const dosageInput = el(activeIds.medDosage);
    if (!dosageInput) return;
    dosageInput.readOnly = false;
    dosageInput.placeholder = placeholder || "Enter dosage (e.g. 500 mg twice daily)";
  }

  function resetDosageField() {
    const dosageInput = el(activeIds.medDosage);
    if (!dosageInput) return;
    dosageInput.value = "";
    dosageInput.readOnly = true;
    dosageInput.placeholder = "Select from list or type medication name first";
    hideSuggestions(el(activeIds.dosageSuggestions));
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
    let html = drugs.map(renderDrugSuggestion).join("");
    if (trimmed) {
      html += renderCustomSuggestion(trimmed);
    }

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

    enableManualDosage("Choose a suggested dosage or type your own");

    const matches = getSearchIndex().filter((item) =>
      item.nameLower.includes(queryLower) ||
      item.genericLower.includes(queryLower) ||
      item.categoryLower.includes(queryLower)
    ).slice(0, SEARCH_LIMIT).map((item) => item.drug);

    showMedicationSuggestions(matches, query);
  }

  function showAllMedications() {
    const otc = getOtcList().slice(0, BROWSE_OTC_LIMIT);
    const input = el(activeIds.medName);
    showMedicationSuggestions(otc, input ? input.value.trim() : "");
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

    medNameInput.addEventListener("input", debouncedSearch);
    medNameInput.addEventListener("keydown", handleMedicationKeydown);
    medNameInput.addEventListener("focus", showAllMedications);
    medNameInput.addEventListener("click", showAllMedications);

    medDosageInput.addEventListener("input", searchDosages);
    medDosageInput.addEventListener("keydown", handleDosageKeydown);
    medDosageInput.addEventListener("focus", () => {
      if (medDosageInput.readOnly && medNameInput.value.trim()) {
        enableManualDosage();
      }
      if (global.selectedMedication && global.selectedMedication.strength) {
        showAllDosages();
      }
    });
    medDosageInput.addEventListener("click", () => {
      if (medDosageInput.readOnly && medNameInput.value.trim()) {
        enableManualDosage();
      }
    });

    resetFields(activeIds);
  }

  global.MediForgePatientReportedMeds = {
    setup,
    resetFields,
    searchMedications,
    showAllMedications,
    selectMedication,
    selectCustomMedication,
    searchDosages,
    showAllDosages,
    handleMedicationKeydown,
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
