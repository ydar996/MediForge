(function setupConsoleFiltering() {
  if (window.__consoleFilteringApplied) {
    return;
  }
  window.__consoleFilteringApplied = true;

  const urlParams = new URLSearchParams(window.location.search);
  const verboseEnabled = urlParams.get('debugLogs') === 'true';
  window.ENABLE_VERBOSE_LOGS = verboseEnabled;
  window.__DEBUG_LOGS = verboseEnabled;
  if (!verboseEnabled) {
    try {
      localStorage.setItem('enableVerboseLogs', 'false');
    } catch (_) {
      // Ignore storage write errors (e.g., privacy mode)
    }
  }

  const SENSITIVE_KEYS = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'apikey',
    'api_key',
    'service_role_key',
    'supabase_service_role_key',
    'supabase_key',
    'patient_id',
    'patientid',
    'first_name',
    'last_name',
    'middle_name',
    'firstname',
    'lastname',
    'middlename',
    'dob',
    'date_of_birth',
    'email',
    'phone',
    'address',
    'gender',
    'tribe',
    'national_id',
    'nin',
    'medical_history',
    'diagnosis',
    'diagnoses',
    'allergies',
    'conditions',
    'soap',
    'encounters',
    'unstructured_records'
  ];

  const REDACTED = '[REDACTED]';
  const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const BEARER_REGEX = /\b(bearer\s+)[^\s]+/gi;

  const sanitizeString = (value) => {
    if (!value) return value;
    let sanitized = value.replace(EMAIL_REGEX, REDACTED);
    sanitized = sanitized.replace(BEARER_REGEX, `$1${REDACTED}`);
    return sanitized;
  };

  const sanitizeObject = (value) => {
    if (!value || typeof value !== 'object') return value;
    const copy = Array.isArray(value) ? [...value] : { ...value };
    Object.keys(copy).forEach((key) => {
      if (SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))) {
        copy[key] = REDACTED;
        return;
      }
      if (typeof copy[key] === 'string') {
        copy[key] = sanitizeString(copy[key]);
      }
    });
    return copy;
  };

  const sanitizeArgs = (args) => args.map((arg) => {
    if (typeof arg === 'string') return sanitizeString(arg);
    if (arg && typeof arg === 'object') return sanitizeObject(arg);
    return arg;
  });

  const wrapConsoleMethod = (method) => {
    if (!console || typeof console[method] !== 'function') return;
    const original = console[method].bind(console);
    console[method] = (...args) => {
      const sanitizedArgs = sanitizeArgs(args);
      if (!verboseEnabled && method !== 'error') {
        return;
      }
      original(...sanitizedArgs);
    };
  };

  wrapConsoleMethod('log');
  wrapConsoleMethod('info');
  wrapConsoleMethod('debug');
  wrapConsoleMethod('warn');
  wrapConsoleMethod('error');
})();
