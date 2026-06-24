'use strict';

(function (global) {
  let cache = null;

  async function loadOntarioPharmacies() {
    if (cache) return cache;
    try {
      const res = await fetch('/config/pharmacies/ontario-sample.json');
      if (!res.ok) throw new Error('Pharmacy directory not found');
      const json = await res.json();
      cache = json.pharmacies || [];
      return cache;
    } catch (err) {
      console.warn('Pharmacy directory:', err.message);
      return [];
    }
  }

  function searchPharmacies(pharmacies, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return pharmacies || [];
    return (pharmacies || []).filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q)
    );
  }

  function renderPharmacySelect(container, pharmacies, selectedId, onSelect) {
    if (!pharmacies.length) {
      container.innerHTML = '<p>No pharmacies loaded. Check config/pharmacies/ontario-sample.json.</p>';
      return;
    }
    const html = ['<select id="pharmacy-select" style="width:100%;padding:10px;margin:8px 0"><option value="">Select pharmacy…</option>'];
    pharmacies.forEach((p) => {
      const sel = p.id === selectedId ? ' selected' : '';
      html.push(`<option value="${p.id}"${sel}>${p.name} - ${p.address || ''}</option>`);
    });
    html.push('</select>');
    container.innerHTML = html.join('');
    const sel = container.querySelector('#pharmacy-select');
    sel.addEventListener('change', () => {
      const ph = pharmacies.find((x) => x.id === sel.value);
      if (onSelect) onSelect(ph || null);
    });
  }

  global.MediForgePharmacyDirectory = {
    loadOntarioPharmacies,
    searchPharmacies,
    renderPharmacySelect
  };
})(typeof window !== 'undefined' ? window : globalThis);
