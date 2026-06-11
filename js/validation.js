/**
 * MediForge Central Validation Module
 * App-wide input validation and sanitization.
 * Use for forms, API payloads, and user input.
 * All functions are non-throwing; they return results for safe use.
 */
(function() {
  'use strict';

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const DEFAULT_MAX_STRING_LENGTH = 10000;

  /**
   * Sanitize a string: remove control chars, angle brackets, trim.
   * Matches patient-intake.js behavior for compatibility.
   */
  function sanitizeString(value, maxLength) {
    if (value == null) return value;
    if (typeof value !== 'string') return String(value);
    let s = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').trim();
    if (maxLength && s.length > maxLength) s = s.slice(0, maxLength);
    return s;
  }

  /**
   * Recursively sanitize objects and arrays.
   */
  function sanitizeValue(value, maxLength) {
    if (Array.isArray(value)) {
      return value.map(v => sanitizeValue(v, maxLength));
    }
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).reduce((acc, [k, v]) => {
        acc[k] = sanitizeValue(v, maxLength);
        return acc;
      }, {});
    }
    return sanitizeString(value, maxLength);
  }

  /**
   * Validate UUID format.
   */
  function validateUUID(value) {
    return typeof value === 'string' && UUID_REGEX.test(value.trim());
  }

  /**
   * Validate email format (basic).
   */
  function validateEmail(value) {
    if (!value || typeof value !== 'string') return false;
    return value.length <= 254 && EMAIL_REGEX.test(value.trim());
  }

  /**
   * Validate string length. Returns { valid, error }.
   */
  function validateStringLength(value, min, max) {
    const s = value == null ? '' : String(value);
    if (min != null && s.length < min) return { valid: false, error: `Must be at least ${min} characters` };
    if (max != null && s.length > max) return { valid: false, error: `Must be at most ${max} characters` };
    return { valid: true };
  }

  /**
   * Validate non-empty string.
   */
  function validateRequired(value, fieldName) {
    if (value == null || (typeof value === 'string' && !value.trim())) {
      return { valid: false, error: (fieldName || 'Field') + ' is required' };
    }
    return { valid: true };
  }

  /**
   * Validate integer in range.
   */
  function validateInteger(value, min, max) {
    const n = parseInt(value, 10);
    if (isNaN(n)) return { valid: false, error: 'Must be a valid number' };
    if (min != null && n < min) return { valid: false, error: `Must be at least ${min}` };
    if (max != null && n > max) return { valid: false, error: `Must be at most ${max}` };
    return { valid: true };
  }

  /**
   * Validate number in range.
   */
  function validateNumber(value, min, max) {
    const n = parseFloat(value);
    if (isNaN(n)) return { valid: false, error: 'Must be a valid number' };
    if (min != null && n < min) return { valid: false, error: `Must be at least ${min}` };
    if (max != null && n > max) return { valid: false, error: `Must be at most ${max}` };
    return { valid: true };
  }

  /**
   * Validate login input (username/email, password).
   * Username is sanitized; password is length-checked only (no sanitization).
   * Returns { valid: boolean, error?: string, sanitized?: { username, password } }.
   */
  function validateLoginInput(username, password) {
    const req = validateRequired(username, 'Username or email');
    if (!req.valid) return req;
    const userLen = validateStringLength(username, 1, 254);
    if (!userLen.valid) return userLen;
    const pwdReq = validateRequired(password, 'Password');
    if (!pwdReq.valid) return pwdReq;
    const pwdLen = validateStringLength(password, 1, 256);
    if (!pwdLen.valid) return pwdLen;
    const sanitizedUsername = sanitizeString(username, 254);
    return { valid: true, sanitized: { username: sanitizedUsername, password: String(password) } };
  }

  /**
   * Validate and sanitize object keys for safe insertion (e.g. audit_logs).
   */
  function validateAuditPayload(payload) {
    if (!payload || typeof payload !== 'object') return { valid: false, error: 'Payload must be an object' };
    const p = payload;
    const username = p.username != null ? sanitizeString(String(p.username), 255) : null;
    const action = p.action != null ? sanitizeString(String(p.action), 255) : null;
    if (!username || !action) return { valid: false, error: 'username and action are required' };
    const len = validateStringLength(username, 1, 255);
    if (!len.valid) return len;
    const actionLen = validateStringLength(action, 1, 255);
    if (!actionLen.valid) return actionLen;
    return { valid: true, sanitized: { ...p, username, action } };
  }

  // Expose globally
  window.Validation = {
    sanitizeString,
    sanitizeValue,
    validateUUID,
    validateEmail,
    validateStringLength,
    validateRequired,
    validateInteger,
    validateNumber,
    validateLoginInput,
    validateAuditPayload,
    UUID_REGEX,
    EMAIL_REGEX
  };
})();
