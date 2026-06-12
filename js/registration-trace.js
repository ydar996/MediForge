/**
 * Structured registration trace logs for debugging signup issues.
 * Filter console by: MediForge-REG
 * After a failure, run: copy(getRegistrationTraceReport())
 */
(function () {
  const PREFIX = '[MediForge-REG]';
  const STORAGE_KEY = 'mediforgeRegTraceLog';
  const TRACE_ID_KEY = 'mediforgeRegTraceId';
  const MAX_EVENTS = 100;

  function tracingEnabled() {
    return localStorage.getItem('mediforgeRegTrace') !== 'off';
  }

  function maskEmail(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) return email;
    const parts = email.split('@');
    const local = parts[0];
    const shown = local.length <= 4 ? local[0] + '***' : local.slice(0, 4) + '***';
    return `${shown}@${parts[1]}`;
  }

  function sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;
    const out = { ...data };
    if ('password' in out) out.password = '[hidden]';
    if ('email' in out) out.email = maskEmail(out.email);
    if ('authEmail' in out) out.authEmail = maskEmail(out.authEmail);
    if ('phone' in out) out.phone = '[hidden]';
    return out;
  }

  function serializeError(err) {
    if (!err) return null;
    if (typeof err === 'string') return { message: err };
    return {
      message: err.message || String(err),
      code: err.code || err.status || null,
      details: err.details || null,
      hint: err.hint || null
    };
  }

  function hintForError(err) {
    const msg = (err && err.message ? err.message : String(err || '')).toLowerCase();
    if (msg.includes('row-level security') || msg.includes('permission denied') || msg.includes('rls')) {
      return 'Database permission (RLS). Run users registration RLS SQL on this Supabase project.';
    }
    if (msg.includes('invalid') && msg.includes('email')) {
      return 'Auth rejected signup email. Check Supabase Auth → Email → Confirm email OFF on dev.';
    }
    if (msg.includes('not authorized')) {
      return 'Email not authorized on this Supabase project. Configure Auth email settings or Custom SMTP.';
    }
    if (msg.includes('duplicate') || msg.includes('already')) {
      return 'Username or email already exists. Try another username or remove orphaned Auth user.';
    }
    if (msg.includes('foreign key') || msg.includes('organization')) {
      return 'Organization missing or invalid organization_id.';
    }
    if (msg.includes('check constraint') || msg.includes('role')) {
      return 'Invalid role value for users.role check constraint.';
    }
    return null;
  }

  class RegistrationTrace {
    constructor() {
      this.traceId = null;
      this.events = [];
      this._startedAt = 0;
    }

    start(context) {
      this.traceId = `reg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      this.events = [];
      this._startedAt = Date.now();
      window.__MEDIFORGE_REG_TRACE_ID__ = this.traceId;
      this._record('START', 'registration_started', sanitizeData(context));
      this._console('info', 'registration_started', context);
      return this.traceId;
    }

    step(step, data) {
      this._record('STEP', step, sanitizeData(data));
      if (tracingEnabled()) this._console('log', step, data);
    }

    ok(step, data) {
      this._record('OK', step, sanitizeData(data));
      if (tracingEnabled()) this._console('log', step, data);
    }

    fail(step, error, data) {
      const errObj = serializeError(error);
      const supportHint = hintForError(error);
      const payload = sanitizeData({ ...data, supportHint });
      this._record('FAIL', step, payload, errObj);
      this._console('error', step, { ...payload, error: errObj });
      this._persist();
    }

    _record(level, step, data, error) {
      if (!this.traceId) {
        this.traceId = window.__MEDIFORGE_REG_TRACE_ID__ || `reg-${Date.now().toString(36)}`;
      }
      this.events.push({
        t: new Date().toISOString(),
        elapsedMs: this._startedAt ? Date.now() - this._startedAt : 0,
        level,
        step,
        traceId: this.traceId,
        ...(data || {}),
        ...(error ? { error } : {})
      });
      if (this.events.length > MAX_EVENTS) {
        this.events = this.events.slice(-MAX_EVENTS);
      }
      this._persist();
    }

    _persist() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
        sessionStorage.setItem(TRACE_ID_KEY, this.traceId || '');
      } catch (e) {
        /* ignore quota errors */
      }
    }

    _console(kind, step, data) {
      const label = `${PREFIX} [${this.traceId}] ${step}`;
      if (kind === 'error') console.error(label, data || '');
      else if (kind === 'info') console.info(label, data || '');
      else console.log(label, data || '');
    }

    getTextReport() {
      const lines = [`Trace ID: ${this.traceId}`, '---'];
      this.events.forEach(function (e) {
        lines.push(
          `[${e.elapsedMs}ms] ${e.level} ${e.step}` +
          (e.supportHint ? ` | hint: ${e.supportHint}` : '') +
          (e.error ? ` | ${e.error.message}` : '')
        );
      });
      return lines.join('\n');
    }
  }

  window.RegTrace = new RegistrationTrace();

  window.getRegistrationTraceReport = function getRegistrationTraceReport() {
    let stored = [];
    try {
      stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      stored = window.RegTrace.events || [];
    }
    return JSON.stringify(
      {
        traceId: window.RegTrace.traceId || sessionStorage.getItem(TRACE_ID_KEY),
        text: window.RegTrace.getTextReport(),
        events: stored
      },
      null,
      2
    );
  };

  window.copyRegistrationTraceReport = function copyRegistrationTraceReport() {
    const text = window.getRegistrationTraceReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    console.log(text);
    return Promise.resolve();
  };

  if (tracingEnabled()) {
    console.info(
      `${PREFIX} Trace logging ON. Disable with localStorage.setItem("mediforgeRegTrace","off"). ` +
      'After a failure: copy(getRegistrationTraceReport())'
    );
  }
})();
