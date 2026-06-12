/**
 * Standard patient race options (US/Canada clinical & research categories).
 */
(function () {
  const PATIENT_RACE_OPTIONS = [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Latino or Hispanic',
    'Middle Eastern or North African',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Two or More Races',
    'Declined to Disclose'
  ];

  const RACE_FIELD_HELP_NOTE =
    'Race is collected to support equitable care and future advances in medical research. You may choose Declined to Disclose.';

  function populatePatientRaceSelect(selectEl, selectedValue) {
    if (!selectEl) return;
    const prev = (selectedValue || selectEl.value || '').trim();
    selectEl.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = !prev;
    placeholder.textContent = 'Select Race';
    selectEl.appendChild(placeholder);
    PATIENT_RACE_OPTIONS.forEach(function (race) {
      const opt = document.createElement('option');
      opt.value = race;
      opt.textContent = race;
      if (prev === race) opt.selected = true;
      selectEl.appendChild(opt);
    });
    if (prev && PATIENT_RACE_OPTIONS.indexOf(prev) === -1) {
      const legacy = document.createElement('option');
      legacy.value = prev;
      legacy.textContent = prev;
      legacy.selected = true;
      selectEl.appendChild(legacy);
    }
  }

  function initPatientRaceFields() {
    document.querySelectorAll('select#race, select[id="race"]').forEach(function (sel) {
      const preset = sel.getAttribute('data-selected') || sel.value;
      populatePatientRaceSelect(sel, preset);
    });
    document.querySelectorAll('[data-patient-race-help]').forEach(function (el) {
      el.textContent = RACE_FIELD_HELP_NOTE;
    });
  }

  window.PATIENT_RACE_OPTIONS = PATIENT_RACE_OPTIONS;
  window.RACE_FIELD_HELP_NOTE = RACE_FIELD_HELP_NOTE;
  window.populatePatientRaceSelect = populatePatientRaceSelect;
  window.normalizePatientRaceForLoad = function (record) {
    if (!record) return '';
    return String(record.race || '').trim();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPatientRaceFields);
  } else {
    initPatientRaceFields();
  }
})();
