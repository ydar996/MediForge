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

  function parseRejectionDetails(row) {
    const err = row.error ? String(row.error) : '';
    const payload = row.claim_payload || {};
    let code = row.rejection_code || payload.rejectionCode || '';
    const codeMatch = err.match(/(?:REJ|code)[:\s]+([A-Z0-9-]+)/i);
    if (!code && codeMatch) code = codeMatch[1];
    const invoice = row.invoice_id || payload.invoice?.invoiceNumber || payload.invoiceNumber || '';
    const guidance =
      code && /PHN|HC/i.test(code)
        ? 'Verify patient PHN and demographics on the invoice, then resubmit.'
        : code && /FEE|CODE/i.test(code)
          ? 'Check OHIP fee codes and service dates on the invoice.'
          : 'Review the invoice in billing, correct the issue, then reset to draft and resubmit.';
    return { message: err || 'Rejected by payer (no detail stored).', code, invoice, guidance };
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

  function renderTable(container, rows, options = {}) {
    const filter = options.statusFilter || 'all';
    const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
    if (!filtered.length) {
      container.innerHTML =
        '<p>No insurance claims match this filter. Claims are created when OHIP invoices are finalized with payer routing.</p>';
      return;
    }
    const html = [
      '<table class="claims-table"><thead><tr><th>Invoice</th><th>Payer</th><th>Status</th><th>Updated</th><th>Details</th><th>Actions</th></tr></thead><tbody>'
    ];
    filtered.forEach((r) => {
      const inv = r.invoice_id || r.claim_payload?.invoice?.invoiceNumber || '';
      const rej = r.status === 'rejected' ? parseRejectionDetails(r) : null;
      const details = rej
        ? `<div class="rej-detail"><strong>Code:</strong> ${rej.code || 'n/a'}<br><strong>Reason:</strong> ${rej.message}<br><em>${rej.guidance}</em></div>`
        : r.error
          ? String(r.error).slice(0, 120)
          : '';
      const invoiceLink = inv
        ? `<a href="billing-dashboard?invoice=${encodeURIComponent(inv)}">Open billing</a>`
        : '';
      html.push(
        `<tr data-claim-id="${r.id}">` +
          `<td>${inv}</td><td>${r.payer_code || ''}</td>` +
          `<td>${statusBadge(r.status)}</td>` +
          `<td>${(r.updated_at || '').slice(0, 10)}</td>` +
          `<td>${details}</td>` +
          `<td>` +
          (r.status === 'rejected'
            ? `${invoiceLink} <button type="button" class="btn-sm" data-resubmit="${r.id}">Reset to draft</button>`
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
    parseRejectionDetails,
    renderTable,
    statusBadge
  };
})(typeof window !== 'undefined' ? window : globalThis);
