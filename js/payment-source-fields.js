/**
 * Show payer-specific ID fields when primary payer / payment source changes.
 * Used on add-patient, edit-patient, and patient-intake.
 */
(function (global) {
  const PANEL_IDS = [
    'sharedPayerProvinceFields',
    'provincialPayerFields',
    'insuranceFields',
    'wcbPayerFields',
    'selfPayPayerNote'
  ];

  const PANELS_BY_SOURCE = {
    provincial: ['sharedPayerProvinceFields', 'provincialPayerFields'],
    private_insurance: ['insuranceFields'],
    wcb: ['sharedPayerProvinceFields', 'wcbPayerFields'],
    self_pay: ['selfPayPayerNote']
  };

  const LEGACY_PANELS = {
    Insurance: ['insuranceFields'],
    Cash: ['selfPayPayerNote']
  };

  const REQUIRED_BY_SOURCE = {
    provincial: ['patientProvince', 'healthCardNumber'],
    private_insurance: ['insuranceName', 'insuranceMemberNumber'],
    Insurance: ['insuranceName', 'insuranceMemberNumber'],
    wcb: ['patientProvince', 'wcbClaimNumber']
  };

  function normalizePaymentSource(value) {
    const raw = String(value || '').trim();
    const v = raw.toLowerCase();
    if (!v) return '';
    if (v === 'insurance' || v === 'private_insurance' || v.includes('private')) return 'private_insurance';
    if (v === 'cash' || v === 'self_pay' || v === 'self pay' || v.includes('self-pay') || v.includes('uninsured')) {
      return 'self_pay';
    }
    if (v === 'provincial' || v.includes('provincial') || v.includes('ohip') || v.includes('ramq') || v.includes('msp')) {
      return 'provincial';
    }
    if (v === 'wcb' || v.includes('workers')) return 'wcb';
    return raw;
  }

  function setFieldRequired(id, required) {
    const el = document.getElementById(id);
    if (!el) return;
    if (required) el.setAttribute('required', 'required');
    else el.removeAttribute('required');
  }

  function hideAllPanels() {
    PANEL_IDS.forEach((id) => {
      const panel = document.getElementById(id);
      if (panel) panel.style.display = 'none';
    });
  }

  function showPanels(ids) {
    (ids || []).forEach((id) => {
      const panel = document.getElementById(id);
      if (panel) panel.style.display = 'block';
    });
  }

  function updatePaymentSourceFields(selectEl) {
    const select = selectEl || document.getElementById('paymentSource');
    if (!select) return;

    const raw = select.value || '';
    const source = normalizePaymentSource(raw);
    hideAllPanels();

    const panels = PANELS_BY_SOURCE[source] || LEGACY_PANELS[raw] || [];
    showPanels(panels);

    const allRequired = new Set(Object.values(REQUIRED_BY_SOURCE).flat());
    allRequired.forEach((id) => setFieldRequired(id, false));

    const requiredIds = REQUIRED_BY_SOURCE[source] || REQUIRED_BY_SOURCE[raw] || [];
    requiredIds.forEach((id) => setFieldRequired(id, true));
  }

  function getMissingPaymentFields(selectEl) {
    const select = selectEl || document.getElementById('paymentSource');
    const source = normalizePaymentSource(select?.value || '');
    const missing = [];

    function requireValue(id, label) {
      const value = document.getElementById(id)?.value?.trim?.() ?? document.getElementById(id)?.value ?? '';
      if (!String(value).trim()) missing.push(label);
    }

    if (source === 'provincial') {
      requireValue('patientProvince', 'Province / Territory');
      requireValue('healthCardNumber', 'Health Card Number (PHN)');
    } else if (source === 'private_insurance') {
      requireValue('insuranceName', 'Insurance Company Name');
      requireValue('insuranceMemberNumber', 'Member / Certificate Number');
    } else if (source === 'wcb') {
      requireValue('patientProvince', 'Province / Territory');
      requireValue('wcbClaimNumber', 'WCB Claim / File Number');
    }

    return missing;
  }

  function initPaymentSourceFields(selectId) {
    const select = document.getElementById(selectId || 'paymentSource');
    if (!select) return;
    select.addEventListener('change', () => updatePaymentSourceFields(select));
    updatePaymentSourceFields(select);
  }

  global.MediForgePaymentSourceFields = {
    init: initPaymentSourceFields,
    update: updatePaymentSourceFields,
    normalizePaymentSource,
    getMissingFields: getMissingPaymentFields
  };
})(typeof window !== 'undefined' ? window : globalThis);
