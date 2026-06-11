/**
 * SECURITY DEFINER RPC helpers for anon-safe login / registration lookups.
 * Used when RLS blocks direct SELECT on users / organizations.
 */
(function () {
  function firstRow(data) {
    return Array.isArray(data) && data.length ? data[0] : null;
  }

  async function lookupUserPublicLogin(client, identifier, type, role) {
    if (!client || identifier == null || String(identifier).trim() === '') {
      return { data: null, error: null };
    }
    const { data, error } = await client.rpc('lookup_user_public_login', {
      p_identifier: String(identifier).trim(),
      p_type: type === 'email' ? 'email' : 'username',
      p_role: role == null || String(role).trim() === '' ? null : String(role).trim()
    });
    if (error) return { data: null, error };
    return { data: firstRow(data), error: null };
  }

  async function verifyOrganizationCodeRpc(client, orgCode) {
    if (!client || orgCode == null || String(orgCode).trim() === '') {
      return { data: null, error: null };
    }
    const { data, error } = await client.rpc('verify_organization_code', {
      p_org_code: String(orgCode).trim()
    });
    if (error) return { data: null, error };
    return { data: firstRow(data), error: null };
  }

  async function isUsernameAvailableRpc(client, username) {
    if (!client || username == null || String(username).trim() === '') {
      return { available: true, error: null };
    }
    const { data, error } = await client.rpc('is_username_available', {
      p_username: String(username).trim()
    });
    if (error) return { available: true, error };
    return { available: data === true, error: null };
  }

  window.lookupUserPublicLogin = lookupUserPublicLogin;
  window.verifyOrganizationCodeRpc = verifyOrganizationCodeRpc;
  window.isUsernameAvailableRpc = isUsernameAvailableRpc;
})();
