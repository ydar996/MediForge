'use strict';

(function (global) {
  async function loadRecentFailures(limit = 25) {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('interop_messages')
      .select('id, message_type, direction, standard, status, correlation_id, error, created_at')
      .eq('organization_id', orgId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('interop failures load:', error.message);
      return [];
    }
    return data || [];
  }

  async function loadFailureCount() {
    const rows = await loadRecentFailures(50);
    return rows.length;
  }

  function summarizeByMessageType(rows) {
    const counts = {};
    (rows || []).forEach((r) => {
      const key = r.message_type || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }

  function renderFailureSummary(container, rows) {
    const summary = summarizeByMessageType(rows);
    if (!summary.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML =
      '<p><strong>Failures by type:</strong> ' +
      summary.map((s) => `${s.type} (${s.count})`).join(' · ') +
      '</p>';
  }

  function renderFailuresTable(container, rows) {
    if (!rows.length) {
      container.innerHTML = '<p>No failed integration messages in the audit trail.</p>';
      return;
    }
    const html = [
      '<table class="fail-table"><thead><tr><th>When</th><th>Type</th><th>Direction</th><th>Correlation</th><th>Error</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      html.push(
        `<tr><td>${(r.created_at || '').slice(0, 16).replace('T', ' ')}</td>` +
          `<td>${r.message_type || ''}</td><td>${r.direction || ''}</td>` +
          `<td>${r.correlation_id || ''}</td>` +
          `<td>${String(r.error || '').slice(0, 120)}</td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeInteropFailures = {
    loadRecentFailures,
    loadFailureCount,
    summarizeByMessageType,
    renderFailureSummary,
    renderFailuresTable
  };
})(typeof window !== 'undefined' ? window : globalThis);
