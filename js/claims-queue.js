'use strict';

(function (global) {
  async function loadOrgClaims() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('insurance_claims')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });
    if (error) {
      console.warn('Claims queue load:', error.message);
      return [];
    }
    return data || [];
  }

  async function updateClaimStatus(claimId, status, extra = {}) {
    if (!global.supabase) return { ok: false, error: 'Supabase not configured' };
    const payload = { status, updated_at: new Date().toISOString(), ...extra };
    const { error } = await global.supabase.from('insurance_claims').update(payload).eq('id', claimId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function submitClaimViaGateway(claimRow, patient, provider, invoice, services) {
    if (!global.MediForgeInteropClient) return { queued: true, reason: 'Interop client not loaded' };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return global.MediForgeInteropClient.call('submitClaim', {
      patient,
      provider,
      invoice,
      services: services || claimRow.claim_payload?.serviceLines || [],
      payerCode: claimRow.payer_code || 'OHIP',
      organizationId: user.organizationId || user.organization_id,
      userId: user.id || user.userId
    });
  }

  function statusBadge(status) {
    const colors = {
      draft: '#607D8B',
      submitted: '#1565C0',
      accepted: '#008753',
      rejected: '#c62828',
      paid: '#2e7d32',
      void: '#9e9e9e'
    };
    const c = colors[status] || '#666';
    return `<span class="badge" style="background:${c}22;color:${c}">${status}</span>`;
  }

  function renderTable(container, rows) {
    if (!rows.length) {
      container.innerHTML =
        '<p>No insurance claims in queue yet. Claims are created when OHIP invoices are finalized with payer routing.</p>';
      return;
    }
    const html = [
      '<table class="claims-table"><thead><tr><th>Invoice</th><th>Payer</th><th>Status</th><th>Updated</th><th>Error</th><th>Actions</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      const inv = r.invoice_id || (r.claim_payload?.invoice?.invoiceNumber) || '';
      const err = r.error ? String(r.error).slice(0, 80) : '';
      html.push(
        `<tr data-claim-id="${r.id}">` +
          `<td>${inv}</td><td>${r.payer_code || ''}</td>` +
          `<td>${statusBadge(r.status)}</td>` +
          `<td>${(r.updated_at || '').slice(0, 10)}</td>` +
          `<td>${err}</td>` +
          `<td>` +
          (r.status === 'rejected'
            ? `<button type="button" class="btn-sm" data-resubmit="${r.id}">Reset to draft</button>`
            : '') +
          `</td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeClaimsQueue = {
    loadOrgClaims,
    updateClaimStatus,
    submitClaimViaGateway,
    renderTable,
    statusBadge
  };
})(typeof window !== 'undefined' ? window : globalThis);
