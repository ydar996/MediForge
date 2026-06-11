/**
 * Netlify Function: CSP violation report endpoint
 * Receives Content-Security-Policy violation reports (report-uri).
 * Logs violations for monitoring; returns 204 to satisfy browser.
 */

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      body: 'Method Not Allowed'
    };
  }
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const blocked = body?.['csp-report']?.['blocked-uri'] ?? body?.['blocked-uri'] ?? 'unknown';
    const violated = body?.['csp-report']?.['violated-directive'] ?? body?.['violated-directive'] ?? 'unknown';
    console.warn('[CSP] Violation:', { blocked, violated, documentUri: body?.['csp-report']?.['document-uri'] });
  } catch (_) {
    // Ignore parse errors
  }
  return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
};
