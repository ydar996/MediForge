'use strict';

(function (global) {
  async function saveRemittanceRecord({ payerCode, remittanceDate, totalPaid, payload, reconciled }) {
    if (!global.supabase) return { ok: false, error: 'Supabase not configured' };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const { data, error } = await global.supabase
      .from('remittance_records')
      .insert({
        organization_id: orgId,
        payer_code: payerCode || 'OHIP',
        remittance_date: remittanceDate,
        total_paid: totalPaid,
        payload,
        reconciled: reconciled === true
      })
      .select()
      .single();
    return error ? { ok: false, error: error.message } : { ok: true, record: data };
  }

  async function loadRemittanceRecords() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const { data, error } = await global.supabase
      .from('remittance_records')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return [];
    return data || [];
  }

  async function processRemittanceViaGateway(raw, invoices) {
    if (!global.MediForgeInteropClient) return { error: 'Interop client not loaded' };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return global.MediForgeInteropClient.call('processRemittance', {
      raw,
      invoices,
      organizationId: user.organizationId || user.organization_id,
      userId: user.id
    });
  }

  function renderReconciliationResults(container, result) {
    const rows = result.reconciliation || [];
    if (!rows.length) {
      container.innerHTML = '<p>No payments in remittance file.</p>';
      return;
    }
    const html = [
      '<table class="remit-table"><thead><tr><th>Claim ref</th><th>Matched invoice</th><th>Paid</th><th>Status</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      const inv = r.invoice ? (r.invoice.invoiceNumber || r.invoice.id) : 'n/a';
      html.push(
        `<tr><td>${r.remittancePayment?.claimId || ''}</td>` +
          `<td>${inv}</td>` +
          `<td>$${(r.remittancePayment?.paidAmount || 0).toFixed(2)}</td>` +
          `<td>${r.matched ? 'Matched' : 'Unmatched'}</td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeRemittanceReconcile = {
    saveRemittanceRecord,
    loadRemittanceRecords,
    processRemittanceViaGateway,
    renderReconciliationResults
  };
})(typeof window !== 'undefined' ? window : globalThis);
