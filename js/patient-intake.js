// Purpose: Handles public patient intake submission flow with Supabase-first persistence and local fallback

/* eslint-disable no-console */
(function() {
  const form = document.getElementById("patient-intake-form");
  const orgNameEl = document.getElementById("org-name");
  const titleEl = document.getElementById("intake-title");
  const statusEl = document.getElementById("submission-status");
  const submitButton = document.getElementById("submit-intake");
  const clearButton = document.getElementById("clear-intake");
  const orgHintEl = document.getElementById("intake-org-hint");
  const orgContextBanner = document.getElementById("intake-org-context");
  const orgContextNameEl = document.getElementById("intake-org-name-label");
  const orgTaglineEl = document.getElementById("intake-org-tagline");
  const organizationInput = document.getElementById("organization-id");
  const customFieldsSection = document.getElementById("custom-fields-section");
  const customFieldsContainer = document.getElementById("custom-fields-container");

  const localQueueKey = "mediForge.pendingIntakeSubmissions";
  const customFieldDefinitions = [];
  let refreshEmergencyAddressState = null;

  function sanitizeString(value) {
    if (typeof window.Validation !== 'undefined' && window.Validation.sanitizeString) {
      return window.Validation.sanitizeString(value);
    }
    return typeof value === "string"
      ? value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/[<>]/g, "").trim()
      : value;
  }

  function sanitizeValue(value) {
    if (typeof window.Validation !== 'undefined' && window.Validation.sanitizeValue) {
      return window.Validation.sanitizeValue(value);
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (value && typeof value === "object") {
      return Object.entries(value).reduce((accumulator, [key, val]) => {
        accumulator[key] = sanitizeValue(val);
        return accumulator;
      }, {});
    }
    return sanitizeString(value);
  }

  function applyOrgBranding(displayName, tagline) {
    if (displayName) {
      if (orgNameEl) orgNameEl.textContent = displayName;
      if (orgContextNameEl) orgContextNameEl.textContent = displayName;
      if (titleEl) {
        const existingSpan = titleEl.querySelector("#org-name");
        if (existingSpan) {
          existingSpan.textContent = displayName;
        }
      }
      if (orgContextBanner) orgContextBanner.hidden = false;
    }

    if (orgTaglineEl) {
      const resolvedTagline = tagline !== undefined && tagline !== null
        ? tagline
        : (displayName ? `Secure onboarding for ${displayName}` : "");
      if (resolvedTagline) {
        orgTaglineEl.textContent = resolvedTagline;
        orgTaglineEl.hidden = false;
      } else {
        orgTaglineEl.hidden = true;
      }
    }
  }

  const TABLE_META = {
    "history-table": {
      wrapperId: "history-table-wrapper",
      emptyId: "history-empty",
      getData: () => (typeof tempMedicalHistory !== "undefined" ? tempMedicalHistory : window.tempMedicalHistory || [])
    },
    "medications-table": {
      wrapperId: "medications-table-wrapper",
      emptyId: "medications-empty",
      getData: () => (typeof tempMedications !== "undefined" ? tempMedications : window.tempMedications || [])
    },
    "allergies-table": {
      wrapperId: "allergies-table-wrapper",
      emptyId: "allergies-empty",
      getData: () => (typeof tempAllergies !== "undefined" ? tempAllergies : window.tempAllergies || [])
    },
    "immunizations-table": {
      wrapperId: "immunizations-table-wrapper",
      emptyId: "immunizations-empty",
      getData: () => (typeof tempImmunizations !== "undefined" ? tempImmunizations : window.tempImmunizations || [])
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const organizationId = urlParams.get("org");
  const sourceChannel = urlParams.get("source") || null;
  const hint = urlParams.get("hint");
  const urlOrgName = urlParams.get("orgName");

  if (!form) {
    console.warn("Patient intake form not found on page.");
    return;
  }

  if (!organizationId) {
    disableForm("Missing organization information. Please contact your clinic for a valid intake link.");
    return;
  }

  organizationInput.value = organizationId;
  applyOrgBranding(urlOrgName, hint);
  if (hint && orgHintEl) {
    orgHintEl.textContent = hint;
    orgHintEl.hidden = false;
  }

  const SUPABASE_TIMEOUT_MS = 10000;

  const originalDisplayTempTable = typeof window.displayTempTable === "function" ? window.displayTempTable : null;
  if (originalDisplayTempTable) {
    window.displayTempTable = function(tableId, data, fields) {
      originalDisplayTempTable(tableId, data, fields);
      syncTableState(tableId);
    };
  }

  function waitForSupabase() {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function poll() {
        if (window.supabaseClient) {
          resolve(window.supabaseClient);
        } else if (Date.now() - start > SUPABASE_TIMEOUT_MS) {
          reject(new Error("Supabase client failed to initialize"));
        } else {
          setTimeout(poll, 150);
        }
      })();
    });
  }

  function showStatus(message, variant = "info") {
    statusEl.textContent = message;
    statusEl.classList.remove("success", "error", "info");
    statusEl.classList.add(variant);
    statusEl.hidden = false;
  }

  function hideStatus() {
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("success", "error", "info");
  }

  function disableForm(message) {
    if (submitButton) submitButton.disabled = true;
    if (clearButton) clearButton.disabled = true;
    if (message) showStatus(message, "error");
  }

  function enableForm() {
    if (submitButton) submitButton.disabled = false;
    if (clearButton) clearButton.disabled = false;
  }

  function setPhoneCountryCode(inputId, country) {
    const resolved = country || "Canada";
    const codeSelectId = inputId === "phone" ? "phoneCountryCode"
      : inputId === "emergencyPhone" ? "emergencyPhoneCountryCode"
      : `${inputId}CountryCode`;
    if (typeof window.setPhoneCountryCodeForAddressCountry === "function") {
      window.setPhoneCountryCodeForAddressCountry(codeSelectId, resolved);
      updatePhonePlaceholder();
      updateEmergencyPhonePlaceholder();
      return;
    }
    if (!window.COUNTRIES_DATA || !COUNTRIES_DATA[resolved]) return;
    const code = COUNTRIES_DATA[resolved].phoneCode;
    const codeSelect = document.getElementById(`${inputId}-country-code`) || 
                       document.getElementById(`${inputId}CountryCode`) ||
                       (inputId === 'phone' ? document.getElementById('phoneCountryCode') : null) ||
                       (inputId === 'emergencyPhone' ? document.getElementById('emergencyPhoneCountryCode') : null);
    if (codeSelect && code) {
      codeSelect.value = code;
      // Trigger change event to update phone placeholder
      updatePhonePlaceholder();
      updateEmergencyPhonePlaceholder();
    }
  }

  function updatePhonePlaceholder() {
    const phoneInput = document.getElementById("phone");
    const codeSelect = document.getElementById("phoneCountryCode");
    if (!phoneInput) return;
    if (codeSelect?.value) {
      phoneInput.placeholder = "00000";
    } else {
      phoneInput.placeholder = "00000";
    }
  }

  function updateEmergencyPhonePlaceholder() {
    const phoneInput = document.getElementById("emergencyPhone");
    const codeSelect = document.getElementById("emergencyPhoneCountryCode");
    if (!phoneInput) return;
    if (codeSelect?.value) {
      phoneInput.placeholder = "00000";
    } else {
      phoneInput.placeholder = "00000";
    }
  }

  function normalizePhoneInput(inputId, codeSelectId) {
    const input = document.getElementById(inputId);
    const codeSelect = document.getElementById(codeSelectId);
    if (!input || !codeSelect) return;
    const rawValue = (input.value || "").trim();
    if (!rawValue) return;

    // If the number already includes a country code, split it out
    if (rawValue.startsWith("+")) {
      const match = rawValue.match(/^(\+\d{1,4})(.*)$/);
      if (match) {
        const code = match[1];
        const number = match[2].trim();
        const option = Array.from(codeSelect.options || []).find(opt => opt.value === code);
        if (option) {
          codeSelect.value = code;
          updatePhonePlaceholder();
          updateEmergencyPhonePlaceholder();
        }
        input.value = number.replace(/^[\s-]+/, "");
      }
    }
  }

  function handleCountryChange(countrySelectId, stateSelectId, phoneInputId, options) {
    const countrySelect = document.getElementById(countrySelectId);
    if (!countrySelect) return;
    const country = countrySelect.value;
    const opts = options || {};

    if (typeof populateStateDropdown === "function") {
      populateStateDropdown(stateSelectId, country);
    }
    if (typeof updatePhoneFormat === "function") {
      updatePhoneFormat(phoneInputId, country);
    }

    if (opts.postalInputId && typeof window.updatePostalCodeField === "function") {
      window.updatePostalCodeField(country, opts.postalInputId, opts.postalLabelId);
    }
    if (opts.citySelectId && typeof window.handleAddressStateChange === "function") {
      const state = document.getElementById(stateSelectId)?.value || "";
      window.handleAddressStateChange(countrySelectId, stateSelectId, opts.citySelectId, opts.postalInputId || null);
    } else if (opts.citySelectId && typeof window.populateCityDropdown === "function") {
      const state = document.getElementById(stateSelectId)?.value || "";
      if (state) {
        window.populateCityDropdown(opts.citySelectId, country, state);
        const cityEl = document.getElementById(opts.citySelectId);
        if (cityEl) cityEl.disabled = false;
      }
    }
    if (typeof window.setPhoneCountryCodeForAddressCountry === "function") {
      const codeSelectId = phoneInputId === "phone" ? "phoneCountryCode" : "emergencyPhoneCountryCode";
      window.setPhoneCountryCodeForAddressCountry(codeSelectId, country || "Canada");
    } else {
      setPhoneCountryCode(phoneInputId, country);
    }
  }

  function handleStateChange(countrySelectId, stateSelectId, citySelectId, postalSelectId) {
    const country = document.getElementById(countrySelectId)?.value || "";
    const state = document.getElementById(stateSelectId)?.value || "";
    const postalId = postalSelectId !== undefined ? postalSelectId : "postalCode";
    if (typeof window.handleAddressStateChange === "function") {
      window.handleAddressStateChange(countrySelectId, stateSelectId, citySelectId, postalId);
    } else if (typeof window.populateCityDropdown === "function" && country && state) {
      window.populateCityDropdown(citySelectId, country, state);
      const cityEl = document.getElementById(citySelectId);
      if (cityEl) cityEl.disabled = false;
    }
  }

  function handleCityChange(countrySelectId, stateSelectId, citySelectId, postalSelectId) {
    const postalId = postalSelectId !== undefined ? postalSelectId : "postalCode";
    if (typeof window.handleAddressCityChange === "function") {
      window.handleAddressCityChange(countrySelectId, stateSelectId, citySelectId, postalId);
    }
  }

  function applyDefaultAddressCountry(country, state) {
    const resolved = country || "Canada";
    const countrySelect = document.getElementById("country");
    const emergencyCountrySelect = document.getElementById("emergencyCountry");
    if (countrySelect && !countrySelect.value && countrySelect.querySelector(`option[value="${resolved}"]`)) {
      countrySelect.value = resolved;
      handleCountryChange("country", "state", "phone", {
        postalInputId: "postalCode",
        postalLabelId: "postal-code-label",
        citySelectId: "city"
      });
      if (state) {
        const stateSelect = document.getElementById("state");
        if (stateSelect) {
          if (typeof window.populateStateDropdown === "function") {
            window.populateStateDropdown("state", resolved, state);
          }
          stateSelect.value = state;
          handleStateChange("country", "state", "city", "postalCode");
        }
      }
    }
    if (emergencyCountrySelect && !emergencyCountrySelect.value && emergencyCountrySelect.querySelector(`option[value="${resolved}"]`)) {
      emergencyCountrySelect.value = resolved;
      handleCountryChange("emergencyCountry", "emergencyState", "emergencyPhone", { citySelectId: "emergencyCity" });
    }
  }

  function syncTableState(tableId) {
    const meta = TABLE_META[tableId];
    if (!meta) return;
    const wrapper = document.getElementById(meta.wrapperId);
    const empty = document.getElementById(meta.emptyId);
    if (!wrapper || !empty) return;
    const data = meta.getData();
    if (!Array.isArray(data) || data.length === 0) {
      wrapper.style.display = "none";
      empty.style.display = "block";
    } else {
      wrapper.style.display = "";
      empty.style.display = "none";
    }
  }

  function syncAllTables() {
    Object.keys(TABLE_META).forEach(syncTableState);
  }

  function setupEmergencyAddressSync() {
    const sameAsCheckbox = document.getElementById("emergencySameAddress");
    const addressContainer = document.getElementById("emergency-address-fields");
    const emergencyLine1 = form.elements["emergencyAddressLine1"];
    const emergencyLine2 = form.elements["emergencyAddressLine2"];
    const emergencyCity = form.elements["emergencyCity"];
    const emergencyState = form.elements["emergencyState"];
    const emergencyCountry = form.elements["emergencyCountry"];

    if (!sameAsCheckbox || !addressContainer || !emergencyLine1 || !emergencyCity || !emergencyState || !emergencyCountry) {
      refreshEmergencyAddressState = null;
      return;
    }

    const requiredInputs = [emergencyLine1, emergencyCity, emergencyState, emergencyCountry];
    const patientFields = [
      form.elements["addressLine1"],
      form.elements["addressLine2"],
      form.elements["city"],
      form.elements["state"],
      form.elements["country"]
    ].filter(Boolean);

    function syncFromPatient() {
      if (!sameAsCheckbox.checked) return;

      const patientAddressLine1 = form.elements["addressLine1"]?.value || "";
      const patientAddressLine2 = form.elements["addressLine2"]?.value || "";
      const patientCity = form.elements["city"]?.value || "";
      const patientCountry = form.elements["country"]?.value || "";
      const patientState = form.elements["state"]?.value || "";

      emergencyLine1.value = patientAddressLine1;
      if (emergencyLine2) emergencyLine2.value = patientAddressLine2;
      emergencyCountry.value = patientCountry;

      handleCountryChange("emergencyCountry", "emergencyState", "emergencyPhone", { citySelectId: "emergencyCity" });
      if (patientState) {
        emergencyState.value = patientState;
        if (typeof window.handleAddressStateChange === "function") {
          window.handleAddressStateChange("emergencyCountry", "emergencyState", "emergencyCity", null, patientCity);
        } else if (typeof window.populateCityDropdown === "function") {
          window.populateCityDropdown("emergencyCity", patientCountry, patientState, patientCity);
          emergencyCity.disabled = false;
        }
      }
      if (patientCity) emergencyCity.value = patientCity;
      setPhoneCountryCode("emergencyPhone", patientCountry || "Canada");
    }

    function clearEmergencyAddress() {
      emergencyLine1.value = "";
      if (emergencyLine2) emergencyLine2.value = "";
      if (emergencyCity.tagName === "SELECT") {
        emergencyCity.innerHTML = '<option value="">-- Select state/province first --</option>';
        emergencyCity.disabled = true;
      } else {
        emergencyCity.value = "";
      }
      emergencyState.value = "";
      emergencyCountry.value = "";
      handleCountryChange("emergencyCountry", "emergencyState", "emergencyPhone", { citySelectId: "emergencyCity" });
    }

    function applySameAddressState(options = {}) {
      if (sameAsCheckbox.checked) {
        syncFromPatient();
        addressContainer.style.display = "none";
        requiredInputs.forEach(input => { input.required = false; });
      } else {
        addressContainer.style.display = "";
        requiredInputs.forEach(input => { input.required = true; });
        if (options.clear !== false) {
          clearEmergencyAddress();
        }
      }
    }

    sameAsCheckbox.addEventListener("change", () => {
      applySameAddressState({ clear: true });
    });

    patientFields.forEach(field => {
      field.addEventListener("input", syncFromPatient);
      field.addEventListener("change", syncFromPatient);
    });

    refreshEmergencyAddressState = () => applySameAddressState({ clear: false });
    applySameAddressState({ clear: false });
  }

  function shimSubformReset(containerId, fieldIds, afterReset) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.reset = () => {
      fieldIds.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        if (field.type === "checkbox" || field.type === "radio") {
          field.checked = false;
        } else if (field.type === "select-one" || field.type === "select-multiple") {
          field.selectedIndex = 0;
        } else {
          field.value = "";
        }
      });
      if (typeof afterReset === "function") {
        afterReset();
      }
    };
  }

  function resetTempArrays() {
    if (typeof tempMedicalHistory !== "undefined") {
      tempMedicalHistory = [];
    }
    window.tempMedicalHistory = [];

    if (typeof tempDiagnoses !== "undefined") {
      tempDiagnoses = [];
    }
    window.tempDiagnoses = [];

    if (typeof tempMedications !== "undefined") {
      tempMedications = [];
    }
    window.tempMedications = [];

    if (typeof tempAllergies !== "undefined") {
      tempAllergies = [];
    }
    window.tempAllergies = [];

    if (typeof tempImmunizations !== "undefined") {
      tempImmunizations = [];
    }
    window.tempImmunizations = [];
    Object.keys(TABLE_META).forEach(tableId => {
      const tbody = document.querySelector(`#${tableId} tbody`);
      if (tbody) tbody.innerHTML = "";
    });
    syncAllTables();
  }

  function setupMedicationSearchHandlers() {
    if (typeof window.MediForgePatientReportedMeds !== "undefined") {
      window.MediForgePatientReportedMeds.setup();
    }
  }

  function setupIcdClickSuggestions() {
    const historyInput = document.getElementById("history-event");
    const historyResults = document.getElementById("icd-results-history");
    if (!historyInput || !historyResults) return;
    if (historyInput.dataset.icdBound === "true") return;
    historyInput.dataset.icdBound = "true";

    const showInitial = async () => {
      if (typeof window.loadIcdCodes === "function") {
        await window.loadIcdCodes();
      }
      let initial = [];
      if (typeof window.getIcdInitialSuggestions === "function") {
        initial = window.getIcdInitialSuggestions(20);
      } else {
        const codes = typeof window.getActiveIcdCodes === "function"
          ? window.getActiveIcdCodes()
          : (window.ICD_CODES || window.ICD11_CODES || []);
        if (!codes.length) return;
        initial = codes.slice(0, 20);
      }
      if (typeof window.displayIcdResults === "function") {
        window.displayIcdResults(initial, historyResults, "history-event");
      } else if (typeof displayIcdResults === "function") {
        displayIcdResults(initial, historyResults, "history-event");
      }
    };

    historyInput.addEventListener("focus", showInitial);
    historyInput.addEventListener("click", showInitial);

    historyResults.addEventListener("click", (event) => {
      const item = event.target.closest(".icd-result-item");
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();

      const code = item.dataset.icdCode || "";
      const title = item.dataset.icdTitle || "";
      const custom = item.dataset.icdCustom === "true";
      const customText = item.dataset.icdCustomText || "";

      if (custom && typeof window.selectCustomIcdEntry === "function") {
        window.selectCustomIcdEntry(customText || historyInput.value, "history-event");
      } else if (typeof window.selectIcdResult === "function") {
        window.selectIcdResult(code, title, "history-event");
      } else {
        historyInput.value = code && title ? `${code} - ${title}` : (customText || historyInput.value);
        historyResults.style.display = "none";
      }
    });
  }

  function replaceInputNode(inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.parentNode) return input;
    const clone = input.cloneNode(true);
    clone.value = input.value;
    if (clone.dataset) {
      delete clone.dataset.icdSearchBound;
    }
    input.parentNode.replaceChild(clone, input);
    return clone;
  }

  function setupIntakeIcdSearch() {
    const historyInput = replaceInputNode("history-event");
    const historyResults = document.getElementById("icd-results-history");
    if (!historyInput || !historyResults) return;
    if (historyInput.dataset.icdSearchBound === "true") return;
    historyInput.dataset.icdSearchBound = "true";

    const showInitial = async () => {
      if (typeof window.loadIcdCodes === "function") {
        await window.loadIcdCodes();
      }
      let initial = [];
      if (typeof window.getIcdInitialSuggestions === "function") {
        initial = window.getIcdInitialSuggestions(20);
      } else {
        const codes = typeof window.getActiveIcdCodes === "function"
          ? window.getActiveIcdCodes()
          : (window.ICD_CODES || window.ICD11_CODES || []);
        if (!codes.length) return;
        initial = codes.slice(0, 20);
      }
      if (typeof window.displayIcdResults === "function") {
        window.displayIcdResults(initial, historyResults, "history-event");
      } else if (typeof displayIcdResults === "function") {
        displayIcdResults(initial, historyResults, "history-event");
      }
    };

    const handleInput = debounce(async function() {
      const query = (this.value || "").trim();
      if (query.length < 2) {
        historyResults.style.display = "none";
        return;
      }
      if (typeof window.loadIcdCodes === "function") {
        await window.loadIcdCodes();
      }
      let results = [];
      if (typeof window.searchLocalCodesOptimized === "function") {
        results = window.searchLocalCodesOptimized(query, 50);
      } else if (typeof window.searchLocalCodes === "function") {
        results = window.searchLocalCodes(query);
      }
      if (typeof window.displayIcdResults === "function") {
        window.displayIcdResults(results, historyResults, "history-event", query);
      } else if (typeof displayIcdResults === "function") {
        displayIcdResults(results, historyResults, "history-event", query);
      }
    }, 250);

    historyInput.addEventListener("input", handleInput);
    historyInput.addEventListener("focus", showInitial);
    historyInput.addEventListener("click", showInitial);
  }

  function debounce(fn, delay = 200) {
    let timer = null;
    return function(...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function getLocalQueue() {
    try {
      return JSON.parse(localStorage.getItem(localQueueKey) || "[]");
    } catch (e) {
      console.warn("Failed to parse local intake queue", e);
      return [];
    }
  }

  function saveLocalQueue(queue) {
    localStorage.setItem(localQueueKey, JSON.stringify(queue));
  }

  async function flushLocalQueue(supabaseClient) {
    const queue = getLocalQueue();
    if (!queue.length) return;

    const retained = [];
    for (const submission of queue) {
      try {
        const { error } = await supabaseClient
          .from("patient_intake_submissions")
          .insert({
            organization_id: submission.organization_id,
            status: "pending",
            patient_payload: submission.patient_payload,
            custom_field_values: submission.custom_field_values,
            first_name: submission.first_name,
            middle_name: submission.middle_name || null,
            last_name: submission.last_name,
            email: submission.email || null,
            phone: submission.phone || null,
            submitted_from: submission.submitted_from || null
          });
        if (error) {
          console.warn("Failed to flush queued submission", error);
          retained.push(submission);
        }
      } catch (error) {
        console.warn("Unexpected error flushing queued submission", error);
        retained.push(submission);
      }
    }
    saveLocalQueue(retained);
    if (!retained.length) {
      console.log("✅ Pending intake submissions synced");
    }
  }

  function getLocalQueue() {
    try {
      return JSON.parse(localStorage.getItem(localQueueKey) || "[]");
    } catch (error) {
      console.warn("Failed to parse local intake queue", error);
      return [];
    }
  }

  function saveLocalQueue(queue) {
    localStorage.setItem(localQueueKey, JSON.stringify(queue));
  }

  async function flushLocalQueue(supabaseClient) {
    const queue = getLocalQueue();
    if (!queue.length) return;

    const retained = [];
    for (const submission of queue) {
      try {
        const { error } = await supabaseClient
          .from("patient_intake_submissions")
          .insert({
            organization_id: submission.organization_id,
            status: "pending",
            patient_payload: submission.patient_payload,
            custom_field_values: submission.custom_field_values,
            first_name: submission.first_name,
            middle_name: submission.middle_name || null,
            last_name: submission.last_name,
            email: submission.email || null,
            phone: submission.phone || null,
            submitted_from: submission.submitted_from || null
          });
        if (error) {
          console.warn("Failed to flush queued submission", error);
          retained.push(submission);
        }
      } catch (error) {
        console.warn("Unexpected error flushing queued submission", error);
        retained.push(submission);
      }
    }
    saveLocalQueue(retained);
    if (!retained.length) {
      console.log("✅ Pending intake submissions synced");
    }
  }

  async function loadOrganizationDetails(supabaseClient) {
    try {
      const { data: rows, error } = await supabaseClient.rpc('get_organization_intake_context', {
        p_org_id: organizationId
      });

      const data = Array.isArray(rows) && rows.length ? rows[0] : null;

      if (error) {
        console.warn("Could not fetch organization details:", error.message);
        if (typeof window.populateCountryDropdown === "function") {
          applyDefaultAddressCountry("Canada", null);
        }
        return;
      }

      if (data?.name) {
        const tagline = hint || (orgHintEl && !orgHintEl.hidden ? orgHintEl.textContent : "");
        applyOrgBranding(data.name, tagline);
      }
      applyDefaultAddressCountry(data?.country || "Canada", data?.state || null);
    } catch (error) {
      console.warn("Organization lookup failed:", error);
      applyDefaultAddressCountry("Canada", null);
    }
  }

  function isValidEmailFormat(value) {
    if (!value || typeof value !== "string") return false;
    const v = value.trim();
    if (!v) return false;
    if (window.Validation && typeof window.Validation.validateEmail === "function") {
      return window.Validation.validateEmail(v);
    }
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
  }

  function clearIntakeEmailCustomValidity() {
    ["email", "emergencyEmail"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setCustomValidity("");
    });
    customFieldDefinitions.forEach(field => {
      if (field.field_type !== "email") return;
      const el = document.getElementById(`custom-${field.field_key}`);
      if (el) el.setCustomValidity("");
    });
  }

  /** Browser + shared regex check for patient, emergency, and custom email fields */
  function validateIntakeEmailFields() {
    clearIntakeEmailCustomValidity();
    const msg = "Enter a valid email address (e.g. name@example.com).";
    for (const id of ["email", "emergencyEmail"]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const v = el.value.trim();
      if (!v) continue;
      if (!isValidEmailFormat(v)) {
        el.setCustomValidity(msg);
        el.reportValidity();
        showStatus(
          id === "email"
            ? "Please enter a valid email address, or leave it blank."
            : "Please enter a valid emergency contact email, or leave it blank.",
          "error"
        );
        return false;
      }
    }
    for (const field of customFieldDefinitions) {
      if (field.field_type !== "email") continue;
      const el = document.getElementById(`custom-${field.field_key}`);
      if (!el) continue;
      const v = el.value.trim();
      if (!v && !field.required) continue;
      if (!isValidEmailFormat(v)) {
        el.setCustomValidity(msg);
        el.reportValidity();
        showStatus(`Please enter a valid email for “${field.label}”.`, "error");
        return false;
      }
    }
    return true;
  }

  function validateIntakePostalFields() {
    const country = form.elements["country"]?.value || "";
    const postalEl = form.elements["postalCode"];
    if (!postalEl || typeof window.validatePostalCode !== "function") return true;
    const check = window.validatePostalCode(country, postalEl.value.trim());
    if (!check.valid) {
      showStatus(check.error, "error");
      postalEl.focus();
      return false;
    }
    if (check.normalized) postalEl.value = check.normalized;
    return true;
  }

  async function loadCustomFields(supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("patient_intake_custom_fields")
        .select("id, field_key, label, field_type, helper_text, options, required, sort_order, active")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.warn("Failed to load custom intake fields:", error.message);
        return;
      }

      if (!data || !data.length) {
        customFieldsSection.hidden = true;
        return;
      }

      customFieldDefinitions.splice(0, customFieldDefinitions.length, ...data);
      renderCustomFields(data);
    } catch (error) {
      console.warn("Unexpected error loading custom fields:", error);
    }
  }

  function renderCustomFields(fields) {
    customFieldsContainer.innerHTML = "";
    customFieldsSection.hidden = fields.length === 0;

    fields.forEach(field => {
      const wrapper = document.createElement("div");
      wrapper.className = "custom-field-group";
      wrapper.dataset.fieldKey = field.field_key;
      wrapper.dataset.fieldType = field.field_type;
      wrapper.dataset.fieldRequired = field.required ? "true" : "false";

      const label = document.createElement("label");
      label.setAttribute("for", `custom-${field.field_key}`);
      const labelMain =
        field.label +
        (field.field_type === "email" ? " (valid email address)" : "") +
        (field.required ? " *" : "");
      label.textContent = labelMain;
      wrapper.appendChild(label);

      if (field.helper_text) {
        const helper = document.createElement("span");
        helper.className = "helper-text";
        helper.textContent = field.helper_text;
        label.appendChild(helper);
      }

      const inputId = `custom-${field.field_key}`;
      let inputElement = null;

      switch (field.field_type) {
        case "textarea": {
          inputElement = document.createElement("textarea");
          inputElement.rows = 3;
          break;
        }
        case "select": {
          inputElement = document.createElement("select");
          inputElement.innerHTML = `<option value="" disabled selected>Select an option</option>`;
          (Array.isArray(field.options) ? field.options : []).forEach(option => {
            const opt = document.createElement("option");
            opt.value = option?.value ?? option;
            opt.textContent = option?.label ?? option?.value ?? option;
            inputElement.appendChild(opt);
          });
          break;
        }
        case "multiselect": {
          inputElement = document.createElement("select");
          inputElement.multiple = true;
          (Array.isArray(field.options) ? field.options : []).forEach(option => {
            const opt = document.createElement("option");
            opt.value = option?.value ?? option;
            opt.textContent = option?.label ?? option?.value ?? option;
            inputElement.appendChild(opt);
          });
          break;
        }
        case "number": {
          inputElement = document.createElement("input");
          inputElement.type = "number";
          break;
        }
        case "date": {
          inputElement = document.createElement("input");
          inputElement.type = "date";
          break;
        }
        case "email": {
          inputElement = document.createElement("input");
          inputElement.type = "email";
          inputElement.autocomplete = "email";
          inputElement.inputMode = "email";
          inputElement.spellcheck = false;
          inputElement.placeholder = "name@example.com";
          inputElement.title = "Use a valid email, e.g. name@example.com";
          inputElement.setAttribute("pattern", "[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}");
          break;
        }
        case "checkbox": {
          wrapper.classList.add("custom-checkbox");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = inputId;
          wrapper.insertBefore(checkbox, label);
          inputElement = checkbox;
          break;
        }
        default: {
          inputElement = document.createElement("input");
          inputElement.type = "text";
          break;
        }
      }

      if (inputElement && inputElement !== wrapper.firstChild) {
        inputElement.id = inputId;
        inputElement.dataset.fieldKey = field.field_key;
        if (field.required) {
          inputElement.required = true;
        }
        wrapper.appendChild(inputElement);
      }

      customFieldsContainer.appendChild(wrapper);
    });
  }

  function collectCustomFieldValues() {
    if (!customFieldDefinitions.length) return {};
    const values = {};

    customFieldDefinitions.forEach(field => {
      const inputId = `custom-${field.field_key}`;
      const element = document.getElementById(inputId);
      if (!element) return;

      let value = null;
      switch (field.field_type) {
        case "multiselect": {
          value = Array.from(element.selectedOptions || []).map(option => option.value);
          if (!value.length) value = null;
          break;
        }
        case "checkbox": {
          value = element.checked;
          break;
        }
        default: {
          value = element.value.trim();
          if (!value) value = null;
          break;
        }
      }

      if (value !== null) {
        values[field.field_key] = sanitizeValue(value);
      }
    });

    return values;
  }

  function buildPatientPayload() {
    const diabetesValue = form.elements["hasDiabetes"].value;
    const emergencyFirstName = form.elements["emergencyFirstName"].value.trim();
    const emergencyLastName = form.elements["emergencyLastName"].value.trim();

    const toFullNumber = id => (typeof window.getFullPhoneNumber === "function"
      ? window.getFullPhoneNumber(id)
      : form.elements[id]?.value.trim() || "");

    const medicalHistory = typeof tempMedicalHistory !== "undefined" ? tempMedicalHistory : window.tempMedicalHistory || [];
    const medications = typeof tempMedications !== "undefined" ? tempMedications : window.tempMedications || [];
    const allergies = typeof tempAllergies !== "undefined" ? tempAllergies : window.tempAllergies || [];
    const immunizations = typeof tempImmunizations !== "undefined" ? tempImmunizations : window.tempImmunizations || [];

    return sanitizeValue({
      firstName: form.elements["firstName"].value.trim(),
      middleName: form.elements["middleName"].value.trim(),
      lastName: form.elements["lastName"].value.trim(),
      dob: form.elements["dob"].value,
      gender: form.elements["gender"].value,
      maritalStatus: form.elements["maritalStatus"].value,
      race: form.elements["race"].value.trim(),
      email: form.elements["email"].value.trim(),
      phone: toFullNumber("phone"),
      addressLine1: form.elements["addressLine1"].value.trim(),
      addressLine2: form.elements["addressLine2"].value.trim(),
      city: form.elements["city"].value.trim(),
      state: form.elements["state"].value,
      country: form.elements["country"].value,
      postalCode: form.elements["postalCode"] ? form.elements["postalCode"].value.trim() : "",
      emergencyFirstName,
      emergencyLastName,
      emergencyRelationship: form.elements["emergencyRelationship"].value.trim(),
      emergencyPhone: toFullNumber("emergencyPhone"),
      emergencyEmail: form.elements["emergencyEmail"].value.trim(),
      emergencyAddressLine1: form.elements["emergencyAddressLine1"].value.trim(),
      emergencyAddressLine2: form.elements["emergencyAddressLine2"].value.trim(),
      emergencyCity: form.elements["emergencyCity"].value.trim(),
      emergencyState: form.elements["emergencyState"].value,
      emergencyCountry: form.elements["emergencyCountry"].value,
      hasDiabetes: diabetesValue === "true",
      paymentSource: form.elements["paymentSource"].value,
      preferredPaymentMethod: form.elements["preferredPaymentMethod"]?.value || "cash",
      province: form.elements["patientProvince"]?.value || form.elements["state"]?.value || "",
      healthCardNumber: form.elements["healthCardNumber"]?.value?.trim() || "",
      healthCardVersion: form.elements["healthCardVersion"]?.value?.trim() || "",
      phn: form.elements["healthCardNumber"]?.value?.trim() || "",
      insuranceName: form.elements["insuranceName"]?.value?.trim() || "",
      insuranceMemberNumber: form.elements["insuranceMemberNumber"]?.value?.trim() || "",
      insurancePolicyGroupNumber: form.elements["insurancePolicyGroupNumber"]?.value?.trim() || "",
      wcbClaimNumber: form.elements["wcbClaimNumber"]?.value?.trim() || "",
      medicalHistory,
      medications,
      allergies,
      immunizations
    });
  }

  function queueSubmission(payload) {
    const queue = getLocalQueue();
    const localQueueId = payload.localQueueId || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const safePayload = sanitizeValue(payload);
    queue.push({ ...safePayload, localQueueId });
    saveLocalQueue(queue);
    return localQueueId;
  }

  function resetForm(options = {}) {
    const { preserveStatus = false } = options;
    form.reset();
    organizationInput.value = organizationId;
    customFieldDefinitions.forEach(field => {
      const element = document.getElementById(`custom-${field.field_key}`);
      if (!element) return;
      if (field.field_type === "multiselect") {
        Array.from(element.options).forEach(option => { option.selected = false; });
      } else if (field.field_type === "checkbox") {
        element.checked = false;
      } else {
        element.value = "";
      }
    });
    resetTempArrays();
    if (!preserveStatus) {
      hideStatus();
    }
    refreshEmergencyAddressState?.();
    if (typeof window.MediForgePaymentSourceFields !== "undefined") {
      window.MediForgePaymentSourceFields.update(document.getElementById("paymentSource"));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    hideStatus();

    if (!form.reportValidity()) {
      showStatus("Please complete all required fields before submitting.", "error");
      return;
    }

    if (typeof window.MediForgePaymentSourceFields?.getMissingFields === "function") {
      const payerMissing = window.MediForgePaymentSourceFields.getMissingFields();
      if (payerMissing.length > 0) {
        showStatus("Please complete payer ID fields: " + payerMissing.join(", "), "error");
        return;
      }
    }

    if (typeof window.MediForgePatientCardUploads?.getMissingRegistrationCards === "function") {
      const cardMissing = window.MediForgePatientCardUploads.getMissingRegistrationCards();
      if (cardMissing.length > 0) {
        showStatus("Please upload required documents: " + cardMissing.join(", "), "error");
        return;
      }
    }

    if (!validateIntakeEmailFields()) {
      return;
    }

    if (!validateIntakePostalFields()) {
      return;
    }

    if (!window.supabaseClient) {
      showStatus("Connection is still initializing. Please wait a moment and try again.", "info");
      return;
    }

    // Check rate limit for intake submissions (by IP or session identifier)
    if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
      // Use a session-based identifier for client-side rate limiting
      let identifier = 'intake_submission';
      
      // Try to get IP from localStorage (set by server-side calls) or use session ID
      const sessionId = sessionStorage.getItem('session_id') || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (!sessionStorage.getItem('session_id')) {
        sessionStorage.setItem('session_id', sessionId);
      }
      identifier = `intake_${sessionId}`;
      
      const rateLimitCheck = await window.rateLimiter.checkRateLimit('intake', identifier);
      
      if (!rateLimitCheck.allowed) {
        const minutesRemaining = Math.ceil((rateLimitCheck.resetAt - new Date()) / (1000 * 60));
        showStatus(
          `Too many submission attempts. Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} before submitting again.`,
          "error"
        );
        
        // Log rate limit violation
        if (typeof window.logAuditEvent === 'function') {
          window.logAuditEvent('rate_limit_exceeded', {
            type: 'intake',
            identifier: identifier
          });
        }
        
        return;
      }
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    showStatus("Submitting your details. Please wait…", "info");

    let cardUploads = {};
    try {
      if (typeof window.MediForgePatientCardUploads?.readRegistrationCards !== "function") {
        throw new Error("Document upload handler is not available. Please refresh the page.");
      }
      cardUploads = await window.MediForgePatientCardUploads.readRegistrationCards({ required: true });
    } catch (cardError) {
      showStatus(cardError.message || "Please upload both required document files.", "error");
      submitButton.disabled = false;
      submitButton.textContent = "Submit Intake Form";
      return;
    }

    const patientPayload = { ...buildPatientPayload(), ...cardUploads };
    const customFieldValues = collectCustomFieldValues();

    const submissionPayload = {
      organization_id: organizationId,
      status: "pending",
      patient_payload: patientPayload,
      custom_field_values: Object.keys(customFieldValues).length ? customFieldValues : null,
      first_name: patientPayload.firstName,
      middle_name: patientPayload.middleName || null,
      last_name: patientPayload.lastName,
      email: patientPayload.email || null,
      phone: patientPayload.phone || null,
      submitted_from: sourceChannel
    };

    try {
      const supabaseClient = await waitForSupabase();
      const { error } = await supabaseClient
        .from("patient_intake_submissions")
        .insert(submissionPayload);

      if (error) {
        console.warn("Supabase insert failed, storing locally", error);
        
        // Record failed attempt for rate limiting
        if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
          const sessionId = sessionStorage.getItem('session_id') || 'intake_submission';
          await window.rateLimiter.recordFailedAttempt('intake', `intake_${sessionId}`);
        }
        
        queueSubmission(submissionPayload);
        const errorDetail = error?.message ? ` (${error.message})` : "";
        showStatus(
          `Submission was not delivered to the clinic server${errorDetail}. It is saved only on this device and will retry on this page when connectivity is restored.`,
          "error"
        );
        statusEl.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        // Clear rate limit on successful submission
        if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
          const sessionId = sessionStorage.getItem('session_id') || 'intake_submission';
          await window.rateLimiter.clearRateLimit('intake', `intake_${sessionId}`);
        }
        
        resetForm({ preserveStatus: true });
        showStatus("Thank you! Your intake form was submitted successfully. Our team will review and contact you shortly.", "success");
        statusEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (error) {
      console.warn("Unexpected error submitting intake form", error);
      queueSubmission(submissionPayload);
      const errorDetail = error?.message ? ` (${error.message})` : "";
      showStatus(
        `We encountered a connection issue${errorDetail}. Your submission is saved only on this device and will retry when you reopen this page.`,
        "error"
      );
      statusEl.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Intake Form";
    }
  }

  function handleClear() {
    const confirmed = window.confirm("Are you sure you want to clear all entered information?");
    if (!confirmed) return;
    resetForm();
  }

  async function initialize() {
    resetTempArrays();
    syncAllTables();

    // Ensure required globals are available (patient intake loads scripts in order,
    // but this guards against slow network or caching edge cases).
    let retries = 0;
    const maxRetries = 50; // 5 seconds max
    while (retries < maxRetries) {
      if (typeof window.populateCountryDropdown === "function" &&
          typeof window.COUNTRIES_DATA !== "undefined" &&
          typeof window.populateCountryCodeDropdown === "function") {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    // Populate country code dropdowns with full list if available
    if (typeof window.populateCountryCodeDropdown === "function") {
      window.populateCountryCodeDropdown("phoneCountryCode", "+1", true, "Canada");
      window.populateCountryCodeDropdown("emergencyPhoneCountryCode", "+1", true, "Canada");
    }
    const ensureCountryCodes = () => {
      const phoneCodeSelect = document.getElementById("phoneCountryCode");
      const emergencyCodeSelect = document.getElementById("emergencyPhoneCountryCode");
      const needsPopulate = (select) => select && select.options && select.options.length <= 1;
      if (needsPopulate(phoneCodeSelect) || needsPopulate(emergencyCodeSelect)) {
        if (typeof window.populateCountryCodeDropdown === "function") {
          window.populateCountryCodeDropdown("phoneCountryCode", "+1", true, "Canada");
          window.populateCountryCodeDropdown("emergencyPhoneCountryCode", "+1", true, "Canada");
        }
      }
    };
    setTimeout(ensureCountryCodes, 150);
    setTimeout(ensureCountryCodes, 500);

    // Normalize phone inputs if user pasted full number with country code
    document.getElementById("phone")?.addEventListener("blur", () => normalizePhoneInput("phone", "phoneCountryCode"));
    document.getElementById("emergencyPhone")?.addEventListener("blur", () => normalizePhoneInput("emergencyPhone", "emergencyPhoneCountryCode"));
    document.getElementById("phoneCountryCode")?.addEventListener("change", updatePhonePlaceholder);
    document.getElementById("emergencyPhoneCountryCode")?.addEventListener("change", updateEmergencyPhonePlaceholder);

    // Populate country dropdowns
    if (typeof window.populateCountryDropdown === "function") {
      await window.populateCountryDropdown("country");
      await window.populateCountryDropdown("emergencyCountry");
    } else if (typeof populateCountryDropdown === "function") {
      await populateCountryDropdown("country");
      await populateCountryDropdown("emergencyCountry");
    }

    // Ensure country dropdowns are populated (fallback retry)
    const ensureCountryOptions = async () => {
      const countrySelect = document.getElementById("country");
      const emergencyCountrySelect = document.getElementById("emergencyCountry");
      const needsPopulate = (select) => select && select.options && select.options.length <= 1;
      if (needsPopulate(countrySelect) || needsPopulate(emergencyCountrySelect)) {
        if (typeof window.populateCountryDropdown === "function") {
          await window.populateCountryDropdown("country");
          await window.populateCountryDropdown("emergencyCountry");
        } else if (typeof populateCountryDropdown === "function") {
          await populateCountryDropdown("country");
          await populateCountryDropdown("emergencyCountry");
        }
      }
    };
    setTimeout(ensureCountryOptions, 150);
    setTimeout(ensureCountryOptions, 500);

    if (typeof createAllergySelector === "function") {
      createAllergySelector("allergy-selector-container", "allergen", "reaction");
    }

    if (typeof createVaccineSelector === "function") {
      createVaccineSelector("vaccine-container", "vaccine");
    }

    // Ensure ICD codes are loaded before initializing search
    let icdRetries = 0;
    while (icdRetries < 30 && !(typeof window.getActiveIcdCodes === "function" && window.getActiveIcdCodes().length)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      icdRetries++;
    }

    if (typeof window.searchLocalCodes !== "function" && typeof window.searchLocalCodesOptimized === "function") {
      window.searchLocalCodes = (query) => window.searchLocalCodesOptimized(query, 50);
    }

    setupIntakeIcdSearch();
    setupIcdClickSuggestions();

    document.getElementById("country")?.addEventListener("change", () => handleCountryChange("country", "state", "phone", {
      postalInputId: "postalCode",
      postalLabelId: "postal-code-label",
      citySelectId: "city"
    }));
    document.getElementById("emergencyCountry")?.addEventListener("change", () => handleCountryChange("emergencyCountry", "emergencyState", "emergencyPhone", {
      citySelectId: "emergencyCity"
    }));

    document.getElementById("state")?.addEventListener("change", () => handleStateChange("country", "state", "city", "postalCode"));
    document.getElementById("city")?.addEventListener("change", () => handleCityChange("country", "state", "city", "postalCode"));
    document.getElementById("emergencyState")?.addEventListener("change", () => handleStateChange("emergencyCountry", "emergencyState", "emergencyCity", null));
    document.getElementById("emergencyCity")?.addEventListener("change", () => handleCityChange("emergencyCountry", "emergencyState", "emergencyCity", null));

    // Add auto-population for state dropdowns when clicked/focused
    const stateSelect = document.getElementById("state");
    const countrySelectForState = document.getElementById("country");
    if (stateSelect && countrySelectForState) {
      stateSelect.addEventListener("focus", function() {
        const countryValue = countrySelectForState.value;
        if (countryValue && stateSelect.options.length <= 1) {
          if (typeof window.populateStateDropdown === "function") {
            window.populateStateDropdown("state", countryValue);
          } else if (typeof populateStateDropdown === "function") {
            populateStateDropdown("state", countryValue);
          }
        }
      });
      stateSelect.addEventListener("click", function() {
        const countryValue = countrySelectForState.value;
        if (countryValue && stateSelect.options.length <= 1) {
          if (typeof window.populateStateDropdown === "function") {
            window.populateStateDropdown("state", countryValue);
          } else if (typeof populateStateDropdown === "function") {
            populateStateDropdown("state", countryValue);
          }
        }
      });
    }

    const emergencyStateSelect = document.getElementById("emergencyState");
    const emergencyCountrySelectForState = document.getElementById("emergencyCountry");
    if (emergencyStateSelect && emergencyCountrySelectForState) {
      emergencyStateSelect.addEventListener("focus", function() {
        const countryValue = emergencyCountrySelectForState.value;
        if (countryValue && emergencyStateSelect.options.length <= 1) {
          if (typeof window.populateStateDropdown === "function") {
            window.populateStateDropdown("emergencyState", countryValue);
          } else if (typeof populateStateDropdown === "function") {
            populateStateDropdown("emergencyState", countryValue);
          }
        }
      });
      emergencyStateSelect.addEventListener("click", function() {
        const countryValue = emergencyCountrySelectForState.value;
        if (countryValue && emergencyStateSelect.options.length <= 1) {
          if (typeof window.populateStateDropdown === "function") {
            window.populateStateDropdown("emergencyState", countryValue);
          } else if (typeof populateStateDropdown === "function") {
            populateStateDropdown("emergencyState", countryValue);
          }
        }
      });
    }

    setupEmergencyAddressSync();
    if (typeof window.MediForgePaymentSourceFields !== "undefined") {
      window.MediForgePaymentSourceFields.init("paymentSource");
    }
    setupMedicationSearchHandlers();
    shimSubformReset("add-history-form", ["history-date", "history-event", "history-notes"]);
    shimSubformReset("add-medication-form", ["med-name", "med-dosage", "med-start", "med-end", "med-notes"], () => {
      const medSuggestions = document.getElementById("medication-suggestions");
      if (medSuggestions) medSuggestions.style.display = "none";
      const dosageSuggestions = document.getElementById("dosage-suggestions");
      if (dosageSuggestions) dosageSuggestions.style.display = "none";
      if (typeof window.MediForgePatientReportedMeds !== "undefined") {
        window.MediForgePatientReportedMeds.resetFields();
      }
      window.selectedMedication = null;
    });
    shimSubformReset("add-allergy-form", ["allergen", "reaction", "severity", "allergy-notes"]);
    shimSubformReset("add-immunization-form", ["vaccine", "immun-date", "immun-notes"], () => {
      const vaccineSuggestions = document.querySelector("#vaccine-container .intake-suggestions");
      if (vaccineSuggestions) vaccineSuggestions.style.display = "none";
    });

    clearButton?.addEventListener("click", handleClear);
    form.addEventListener("submit", handleSubmit);

    try {
      const supabaseClient = await waitForSupabase();
      enableForm();
      await Promise.all([
        loadOrganizationDetails(supabaseClient),
        loadCustomFields(supabaseClient),
        flushLocalQueue(supabaseClient)
      ]);
    } catch (error) {
      console.warn("Initialization issues:", error);
      showStatus("We are in offline mode. You can still complete the form; it will submit once you regain connectivity.", "info");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();

