/**
 * Title-case registration text fields before they are saved to the database.
 * Names: samson -> Samson, dauda -> Dauda. Also normalizes address/city text fields.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.MediForgeRegistrationCase = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (root) {
  const SMALL_WORDS = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to',
    'from', 'by', 'of', 'in', 'with', 'as', 'vs', 'via', 'per', 'etc.'
  ]);

  const PRESERVED_PHRASES = [
    'MediForge',
    'Declined to Disclose',
    'Two or More Races'
  ];

  function fixBrandSpelling(text) {
    return String(text).replace(/\bMediforge\b/g, 'MediForge');
  }

  function formatToken(token, isFirst, isLast) {
    if (!token) return token;
    if (/^e\.g\.$/i.test(token)) return 'e.g.';
    if (/^[A-Z0-9]{2,}$/.test(token.replace(/[^\w]/g, '')) && /[A-Z]/.test(token)) return token;

    const match = token.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9'.]*)([^A-Za-z0-9]*)$/);
    if (!match) return token;

    const [, prefix, core, suffix] = match;
    if (/[a-z][A-Z]/.test(core)) return token;
    const lower = core.toLowerCase();
    const useLower = !isFirst && !isLast && SMALL_WORDS.has(lower.replace(/\.$/, ''));
    const formatted = useLower
      ? lower
      : lower.charAt(0).toUpperCase() + lower.slice(1);
    return `${prefix || ''}${formatted}${suffix || ''}`;
  }

  function toStoredTitleCase(input) {
    if (input == null) return input;
    const text = String(input);
    const trimmed = text.trim();
    if (!trimmed) return text;

    if (root.MediForgeTitleCase && typeof root.MediForgeTitleCase.toTitleCase === 'function') {
      return root.MediForgeTitleCase.toTitleCase(trimmed);
    }

    for (let i = 0; i < PRESERVED_PHRASES.length; i += 1) {
      if (trimmed.toLowerCase() === PRESERVED_PHRASES[i].toLowerCase()) {
        return PRESERVED_PHRASES[i];
      }
    }

    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('@')) return text;
    if (/^[\d\s\-+().,/]+$/.test(trimmed)) return text;

    const words = trimmed.split(/\s+/);
    return fixBrandSpelling(words.map((word, index) => {
      if (word.includes('/')) {
        return word.split('/').map((part, partIndex) => (
          formatToken(part, index === 0 && partIndex === 0, index === words.length - 1)
        )).join('/');
      }
      return formatToken(word, index === 0, index === words.length - 1);
    }).join(' '));
  }

  function shouldSkipValue(value) {
    if (value == null || typeof value !== 'string') return true;
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed.includes('@')) return true;
    if (/^https?:\/\//i.test(trimmed)) return true;
    if (/^\+?[\d\s().-]{7,}$/.test(trimmed)) return true;
    return false;
  }

  function applyToKeys(record, keys) {
    if (!record || typeof record !== 'object') return record;
    const out = { ...record };
    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(out, key)) return;
      const value = out[key];
      if (shouldSkipValue(value)) return;
      out[key] = toStoredTitleCase(value);
    });
    return out;
  }

  const PATIENT_KEYS = [
    'firstName', 'lastName', 'middleName',
    'emergencyFirstName', 'emergencyLastName', 'emergencyRelationship',
    'addressLine1', 'addressLine2', 'city',
    'emergencyAddressLine1', 'emergencyAddressLine2', 'emergencyCity',
    'insuranceName',
    'first_name', 'last_name', 'middle_name',
    'emergency_contact_relationship',
    'address_line1', 'address_line2',
    'emergency_contact_name'
  ];

  const USER_KEYS = ['firstName', 'lastName', 'first_name', 'last_name', 'specialization'];

  const SPECIALIST_KEYS = [
    'firstName', 'lastName', 'businessName',
    'addressLine1', 'addressLine2', 'city'
  ];

  function normalizePatientRecord(record) {
    return applyToKeys(record, PATIENT_KEYS);
  }

  function normalizeUserRecord(record) {
    return applyToKeys(record, USER_KEYS);
  }

  function normalizeSpecialistRecord(record) {
    return applyToKeys(record, SPECIALIST_KEYS);
  }

  return {
    toStoredTitleCase,
    normalizePatientRecord,
    normalizeUserRecord,
    normalizeSpecialistRecord,
    applyToPatient: normalizePatientRecord,
    applyToUser: normalizeUserRecord,
    applyToSpecialist: normalizeSpecialistRecord
  };
});
