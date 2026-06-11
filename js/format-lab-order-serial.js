// Format lab/imaging order serial numbers to shorter display format (LAB-MEC-001, IMG-MEC-002)
// Retroactively normalizes legacy LAB-XXX to LAB-MEC-XXX for consistent display
window.formatLabOrderSerial = window.formatLabOrderSerial || function formatLabOrderSerial(serialNumber, orderId, orderOrOrgId) {
  if (!serialNumber) {
    return orderId ? orderId.substring(0, 8) : 'N/A';
  }
  const normalized = String(serialNumber || '').trim().toUpperCase();
  const prefix = normalized.startsWith('IMG') ? 'IMG' : 'LAB';

  function getOrgPrefix() {
    let orgId = null;
    if (orderOrOrgId) {
      orgId = typeof orderOrOrgId === 'object' ? (orderOrOrgId.organization_id || orderOrOrgId.orgId) : orderOrOrgId;
    }
    if (!orgId) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        orgId = user.organizationId || user.organization_id;
      } catch (e) {}
    }
    if (orgId) {
      try {
        const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
        const org = Object.values(orgs).find(o => o && o.id === orgId);
        if (org?.name) return org.name.substring(0, 3).toUpperCase();
      } catch (e) {}
    }
    return 'MEC';
  }

  // Legacy format LAB-XXX, IMG-XXX, or LABXXX/IMGXXX - normalize to LAB-MEC-XXX
  let legacyMatch = normalized.match(/^(LAB|IMG)-(\d+)$/);
  if (!legacyMatch) legacyMatch = normalized.match(/^(LAB|IMG)(\d+)$/);
  if (legacyMatch) {
    const numPart = legacyMatch[2];
    const padded = numPart.length <= 3 ? numPart.padStart(3, '0') : numPart;
    return `${prefix}-${getOrgPrefix()}-${padded}`;
  }

  // Already in correct format LAB-MEC-XXX
  if (normalized.length <= 20 && /^(LAB|IMG)-[A-Z]{2,4}-\d+$/.test(normalized)) {
    return normalized;
  }
  if (normalized.length <= 15 && !normalized.match(/^(LAB|IMG)-?/)) return String(serialNumber || '').trim();
  const parts = serialNumber.split('-');
  if (parts.length > 2 && (parts[0] === 'LAB' || parts[0] === 'IMG')) {
    let orgPrefix = null;
    if (parts.length >= 2) {
      const orgPrefixMatch = parts[1].match(/^([A-Z]{2,4})\d+$/);
      if (orgPrefixMatch) orgPrefix = orgPrefixMatch[1];
    }
    const timestampPart = parts.find(p => /^\d{10,}$/.test(p));
    if (timestampPart) {
      const lastThreeDigits = timestampPart.substring(timestampPart.length - 3);
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastThreeDigits}` : `${prefix}-${lastThreeDigits}`;
    }
    const numericPart = parts.find(p => /^\d+$/.test(p));
    if (numericPart) {
      const lastThreeDigits = numericPart.substring(Math.max(0, numericPart.length - 3));
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastThreeDigits.padStart(3, '0')}` : `${prefix}-${lastThreeDigits.padStart(3, '0')}`;
    }
    if (orderId && orderId.length >= 4) {
      const shortId = orderId.substring(orderId.length - 4).replace(/-/g, '');
      return orgPrefix ? `${prefix}-${orgPrefix}-${shortId}` : `${prefix}-${shortId}`;
    }
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length >= 3) {
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastPart.substring(0, 3)}` : `${prefix}-${lastPart.substring(0, 3)}`;
    }
  }
  if (normalized.length > 20) return String(serialNumber || '').trim().substring(0, 17) + '...';
  // FINAL SAFEGUARD: Never return legacy LAB-XXX/IMG-XXX - force convert
  const lastLegacy = normalized.match(/^(LAB|IMG)-?(\d+)$/);
  if (lastLegacy) {
    const p = lastLegacy[1];
    const n = (lastLegacy[2] || '').padStart(3, '0');
    return `${p}-${getOrgPrefix()}-${n}`;
  }
  return String(serialNumber || '').trim();
};
