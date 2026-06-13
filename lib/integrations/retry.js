'use strict';

/**
 * Retry helper for outbound hub calls (MLLP, FHIR, provincial web services).
 * Uses exponential backoff; respects config.security.maxRetries.
 */

async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const wrapped = new Error(`Integration failed after ${maxRetries + 1} attempts: ${lastError.message}`);
  wrapped.cause = lastError;
  wrapped.attempts = maxRetries + 1;
  throw wrapped;
}

module.exports = { withRetry };
