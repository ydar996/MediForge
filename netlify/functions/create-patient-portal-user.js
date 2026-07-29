/**
 * Create a patient portal Auth user via Admin API (service role).
 * Staff JWT stays in the browser — never signUp/signIn as the patient.
 *
 * POST body: {
 *   email, password, username, first_name, last_name,
 *   patient_id?, organization_id?, reset_password_if_exists?
 * }
 * Header: Authorization: Bearer <staff access_token>
 */

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body)
  };
}

function getBearerToken(event) {
  const raw =
    event.headers.authorization ||
    event.headers.Authorization ||
    event.headers['authorization'] ||
    '';
  const m = String(raw).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function isPatientRole(role) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'patient' || r === 'client' || r === 'client-patient';
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[create-patient-portal-user] Missing SUPABASE_URL or service role key');
    return jsonResponse(500, { error: 'Server configuration error' });
  }

  const staffToken = getBearerToken(event);
  if (!staffToken) {
    return jsonResponse(401, { error: 'Staff login required' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const username = String(body.username || '').trim();
  const firstName = String(body.first_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  const patientId = body.patient_id ? String(body.patient_id) : null;
  const organizationId = body.organization_id ? String(body.organization_id) : null;
  const resetIfExists = body.reset_password_if_exists !== false;

  if (!email || !password || password.length < 8) {
    return jsonResponse(400, { error: 'email and password (min 8 characters) are required' });
  }

  const serviceHeaders = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };

  try {
    // Verify caller is an authenticated staff user (not Patient)
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey || serviceKey,
        Authorization: `Bearer ${staffToken}`
      }
    });

    if (!userRes.ok) {
      return jsonResponse(401, { error: 'Invalid or expired staff session. Please sign in again.' });
    }

    const authUser = await userRes.json();
    const authUserId = authUser && authUser.id;
    if (!authUserId) {
      return jsonResponse(401, { error: 'Could not verify staff session' });
    }

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id,role,organization_id,auth_user_id&or=(auth_user_id.eq.${authUserId},id.eq.${authUserId})&limit=1`,
      { method: 'GET', headers: serviceHeaders }
    );

    if (!profileRes.ok) {
      return jsonResponse(500, { error: 'Failed to verify staff profile' });
    }

    const profiles = await profileRes.json();
    const staffProfile = profiles && profiles[0];
    if (!staffProfile || isPatientRole(staffProfile.role)) {
      return jsonResponse(403, { error: 'Only clinic staff can create patient portal accounts' });
    }

    if (organizationId && staffProfile.organization_id && String(staffProfile.organization_id) !== String(organizationId)) {
      // Platform roles may span orgs; clinic staff must match patient org
      const role = String(staffProfile.role || '').toLowerCase();
      const isPlatform = role.includes('platform');
      if (!isPlatform) {
        return jsonResponse(403, { error: 'Patient is outside your organization' });
      }
    }

    // If Auth user already exists, find and optionally reset password
    let existingId = null;

    // Prefer users table link when patient_id known
    if (patientId && isUuid(patientId)) {
      const linkedRes = await fetch(
        `${supabaseUrl}/rest/v1/users?select=id,auth_user_id,email,username&patient_id=eq.${patientId}&role=eq.Patient&limit=1`,
        { method: 'GET', headers: serviceHeaders }
      );
      if (linkedRes.ok) {
        const linked = await linkedRes.json();
        if (linked && linked[0] && (linked[0].auth_user_id || linked[0].id)) {
          existingId = linked[0].auth_user_id || linked[0].id;
        }
      }
    }

    if (!existingId) {
      const byEmailRes = await fetch(
        `${supabaseUrl}/rest/v1/users?select=id,auth_user_id&email=eq.${encodeURIComponent(email)}&limit=1`,
        { method: 'GET', headers: serviceHeaders }
      );
      if (byEmailRes.ok) {
        const rows = await byEmailRes.json();
        if (rows && rows[0] && (rows[0].auth_user_id || rows[0].id)) {
          existingId = rows[0].auth_user_id || rows[0].id;
        }
      }
    }

    if (existingId && isUuid(existingId)) {
      if (resetIfExists) {
        const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${existingId}`, {
          method: 'PUT',
          headers: serviceHeaders,
          body: JSON.stringify({
            password,
            email_confirm: true,
            user_metadata: {
              username: username || undefined,
              first_name: firstName || undefined,
              last_name: lastName || undefined,
              role: 'Patient',
              patient_id: patientId || undefined,
              organization_id: organizationId || undefined
            }
          })
        });
        if (!updateRes.ok) {
          const errText = await updateRes.text().catch(() => '');
          console.error('[create-patient-portal-user] Password update failed:', updateRes.status, errText);
          return jsonResponse(502, { error: 'Could not update existing portal Auth user password' });
        }
      }
      return jsonResponse(200, {
        ok: true,
        created: false,
        user: { id: existingId, email }
      });
    }

    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: username || undefined,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          role: 'Patient',
          patient_id: patientId || undefined,
          organization_id: organizationId || undefined
        }
      })
    });

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      const msg = String(errBody.msg || errBody.error_description || errBody.message || createRes.statusText || '');

      // Race: user created elsewhere — look up via list (email match)
      if (/already|registered|exists/i.test(msg)) {
        const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
          method: 'GET',
          headers: serviceHeaders
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const users = listData.users || listData || [];
          const found = (Array.isArray(users) ? users : []).find(
            (u) => String(u.email || '').toLowerCase() === email
          );
          if (found && found.id) {
            if (resetIfExists) {
              await fetch(`${supabaseUrl}/auth/v1/admin/users/${found.id}`, {
                method: 'PUT',
                headers: serviceHeaders,
                body: JSON.stringify({ password, email_confirm: true })
              });
            }
            return jsonResponse(200, {
              ok: true,
              created: false,
              user: { id: found.id, email }
            });
          }
        }
      }

      console.error('[create-patient-portal-user] createUser failed:', createRes.status, msg);
      return jsonResponse(502, { error: msg || 'Failed to create portal Auth user' });
    }

    const created = await createRes.json();
    const newId = created.id || (created.user && created.user.id);
    if (!newId) {
      return jsonResponse(502, { error: 'Auth user created but id missing from response' });
    }

    return jsonResponse(200, {
      ok: true,
      created: true,
      user: { id: newId, email }
    });
  } catch (err) {
    console.error('[create-patient-portal-user] Exception:', err);
    return jsonResponse(500, { error: err.message || 'Unexpected server error' });
  }
};
