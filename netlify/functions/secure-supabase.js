/**
 * Netlify Function: secure-supabase
 * Acts as a thin proxy between the browser and Supabase for privileged calls.
 * Requires environment variables:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 */

const { normalizePatientRecord } = require('../../js/registration-field-case.js');

const ALLOWED_RPCS = new Set([
  'get_patient_intake_submissions',
  'approve_patient_intake_submission',
  'reject_patient_intake_submission',
  'get_patients_for_org',
  'get_appointments_for_org',
  'get_organizations_with_owner',
  'get_organization_users',
  'get_failed_login_attempts',
  'get_suspicious_activity',
  'get_security_summary',
  'get_audit_logs',
  'get_platform_admin_by_username',
  'check_rate_limit',
  'record_rate_limit_attempt',
  'clear_rate_limit',
  'unlock_account',
  'get_locked_accounts',
  'get_login_attempt_history',
  'reset_user_password',
  'diagnose_user_auth',
  'create_download_request',
  'approve_download_request',
  'get_pending_download_requests',
  'mark_download_completed'
]);

const ALLOWED_TABLE_INSERTS = new Set(['audit_logs']);
const ALLOWED_TABLE_SELECTS = new Set(['audit_logs']); // For platform admin queries that bypass RLS

/** MFA Staff Clinic only: canonical MFA-SC IDs and merged sequence across MIN/MFA/MFA-MC/MFA-SC stems. */
const MFASC_ORGANIZATION_ID = '94534e80-06a8-468f-b8a2-ece3f07697c4';

const CORS_DEFAULT_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/** Build CORS headers with origin allowlist (Netlify, localhost). Falls back to * only if no Origin header. */
function buildCorsHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (process.env.URL) allowed.push(process.env.URL);
  if (process.env.DEPLOY_PRIME_URL) allowed.push(process.env.DEPLOY_PRIME_URL);
  allowed.push('http://localhost:8888', 'http://localhost:3000', 'http://127.0.0.1:8888', 'http://127.0.0.1:3000');
  const isAllowed = origin && (allowed.includes(origin) || /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin));
  return {
    ...CORS_DEFAULT_HEADERS,
    'Access-Control-Allow-Origin': isAllowed ? origin : (process.env.URL || '*')
  };
}

function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function normalizePrefix(prefix, fallback = 'MEC') {
  if (typeof prefix === 'string' && prefix.trim()) {
    return prefix.trim().replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || fallback;
  }
  return fallback;
}

/** MFA Staff Clinic only: same stem rules as js/supabase-patients.js (sequence must not restart when prefix changes). */
function maxPatientSequenceNumber(patientRows) {
  const stemPatterns = [
    /^MIN([0-9]{4})$/i,
    /^MFA([0-9]{4})$/i,
    /^MFA-MC([0-9]{4})$/i,
    /^MFA-SC([0-9]{4})$/i
  ];
  let maxNumber = 0;
  (patientRows || []).forEach((row) => {
    const pid = typeof row.patient_id === 'string' ? row.patient_id.trim() : '';
    if (!pid) return;
    let n = NaN;
    for (let i = 0; i < stemPatterns.length; i++) {
      const m = pid.match(stemPatterns[i]);
      if (m) {
        n = parseInt(m[1], 10);
        break;
      }
    }
    if (Number.isNaN(n)) {
      const tail = pid.match(/(\d{4})$/);
      if (tail) n = parseInt(tail[1], 10);
    }
    if (!Number.isNaN(n) && n > maxNumber) maxNumber = n;
  });
  return maxNumber;
}

function buildEmergencyAddress(payload) {
  const line1 = payload?.emergencyAddressLine1 || '';
  const line2 = payload?.emergencyAddressLine2 || '';
  const city = payload?.emergencyCity || '';
  const state = payload?.emergencyState || '';
  const country = payload?.emergencyCountry || '';
  const hasEmergency = line1 || line2 || city || state || country;
  if (hasEmergency) {
    return [line1, line2, city, state, country].filter(Boolean).join(', ');
  }
  return [
    payload?.addressLine1 || '',
    payload?.addressLine2 || '',
    payload?.city || '',
    payload?.state || '',
    payload?.country || ''
  ].filter(Boolean).join(', ');
}

function jsonResponse(statusCode, body, headers = null) {
  const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };
  const merged = headers
    ? { ...jsonHeaders, ...headers }
    : { ...jsonHeaders, ...CORS_DEFAULT_HEADERS, 'Access-Control-Allow-Origin': '*' };
  return {
    statusCode,
    headers: merged,
    body: JSON.stringify(body)
  };
}

function getClientIP(event) {
  const h = event?.headers || {};
  return h['x-forwarded-for']?.split(',')[0]?.trim() ||
         h['x-real-ip'] ||
         h['x-nf-client-connection-ip'] ||
         h['cf-connecting-ip'] ||
         h['true-client-ip'] ||
         h['x-client-ip'] ||
         h['client-ip'] ||
         'unknown';
}

function getuserAgent(event) {
  return event.headers['user-agent'] || 'unknown';
}

exports.handler = async function handler(event) {
  const corsHeaders = buildCorsHeaders(event);
  const res = (code, body) => jsonResponse(code, body, corsHeaders);
  const clientIP = getClientIP(event);
  const userAgent = getuserAgent(event);
  const requestTime = new Date().toISOString();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[SECURITY] Unauthorized method: ${event.httpMethod} from ${clientIP}`);
    return res(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[SECURITY] Missing Supabase environment variables');
    return res(500, { error: 'Supabase environment variables are not set' });
  }

  let payload = null;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (parseError) {
    return res(400, { error: 'Invalid JSON payload' });
  }

  const { kind, identifier, payload: rpcPayload } = payload || {};

  if (!kind || !identifier) {
    return res(400, { error: 'kind and identifier are required' });
  }

  const baseHeaders = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };

  try {
    // Special handler for password reset (uses Admin API)
    if (kind === 'rpc' && identifier === 'reset_user_password') {
      const { p_auth_user_id, p_new_password, p_user_id, p_reset_by, p_email } = rpcPayload || {};
      
      // PREVENTIVE MEASURE 1: Validate required parameters
      if (!p_auth_user_id || !p_new_password) {
        console.error(`[SECURITY] Password reset failed: Missing required parameters. auth_user_id: ${!!p_auth_user_id}, password: ${!!p_new_password}`);
        return res(400, { error: 'auth_user_id and new_password are required' });
      }

      // PREVENTIVE MEASURE 2: Validate password format
      if (typeof p_new_password !== 'string' || p_new_password.length < 8) {
        console.error(`[SECURITY] Password reset failed: Invalid password format (length: ${p_new_password?.length || 0})`);
        return res(400, { error: 'Password must be at least 8 characters long' });
      }

      // PREVENTIVE MEASURE 3: Validate auth_user_id format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(p_auth_user_id)) {
        console.error(`[SECURITY] Password reset failed: Invalid auth_user_id format: ${p_auth_user_id}`);
        return res(400, { error: 'Invalid auth_user_id format' });
      }

      console.log(`[SECURITY] Password reset request for user ${p_auth_user_id} (user_id: ${p_user_id || 'not provided'}) from ${clientIP} at ${requestTime}`);

      // PREVENTIVE MEASURE 4: Multi-strategy username lookup with validation
      let username = null;
      let currentEmail = null;
      let userRecord = null;
      const lookupErrors = [];

      // Strategy 1: Get username from users table (most reliable)
      if (p_user_id) {
        try {
          // Validate p_user_id format (should be UUID or valid ID)
          if (typeof p_user_id !== 'string' && typeof p_user_id !== 'number') {
            console.warn(`[SECURITY] Invalid p_user_id type: ${typeof p_user_id}`);
          } else {
            const usersTableResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${p_user_id}&select=id,username,email,auth_user_id`, {
              method: 'GET',
              headers: baseHeaders
            });
            
            if (usersTableResponse.ok) {
              const usersData = await usersTableResponse.json();
              if (usersData && usersData.length > 0) {
                userRecord = usersData[0];
                username = userRecord.username;
                
                // PREVENTIVE MEASURE 5: Validate username exists and is not empty
                if (username && typeof username === 'string' && username.trim().length > 0) {
                  console.log(`[SECURITY] ✅ Found username from users table: ${username}`);
                } else {
                  console.warn(`[SECURITY] ⚠️ Username from users table is invalid: ${username}`);
                  username = null; // Reset to null if invalid
                }
                
                // PREVENTIVE MEASURE 6: Verify auth_user_id matches
                if (userRecord.auth_user_id && userRecord.auth_user_id !== p_auth_user_id) {
                  console.warn(`[SECURITY] ⚠️ auth_user_id mismatch: users table has ${userRecord.auth_user_id}, but request has ${p_auth_user_id}`);
                }
              } else {
                lookupErrors.push(`No user found in users table with id=${p_user_id}`);
              }
            } else {
              const errorText = await usersTableResponse.text().catch(() => 'Unknown error');
              lookupErrors.push(`Users table query failed: ${usersTableResponse.status} - ${errorText}`);
            }
          }
        } catch (err) {
          lookupErrors.push(`Users table lookup exception: ${err.message}`);
          console.warn(`[SECURITY] Could not get username from users table: ${err.message}`);
        }
      } else {
        lookupErrors.push('p_user_id not provided, skipping users table lookup');
      }
      
      // Strategy 2: Get user's current email and metadata from Auth API
      let getUserResponse = null;
      let authUserData = null;
      try {
        getUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${p_auth_user_id}`, {
          method: 'GET',
          headers: baseHeaders
        });

        if (getUserResponse.ok) {
          authUserData = await getUserResponse.json();
          currentEmail = authUserData.email;
          
          // PREVENTIVE MEASURE 7: Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!currentEmail || !emailRegex.test(currentEmail)) {
            console.error(`[SECURITY] ⚠️ Invalid email format from Auth: ${currentEmail}`);
            lookupErrors.push(`Invalid email format from Auth API: ${currentEmail}`);
          } else {
            console.log(`[SECURITY] ✅ Retrieved email from Auth API: ${currentEmail}`);
          }
          
          // Strategy 2a: Try username from user_metadata
          if (!username && authUserData.user_metadata?.username) {
            const metaUsername = authUserData.user_metadata.username;
            if (typeof metaUsername === 'string' && metaUsername.trim().length > 0) {
              username = metaUsername.trim();
              console.log(`[SECURITY] ✅ Found username from Auth metadata: ${username}`);
            }
          }
          
          // Strategy 2b: Extract username from email prefix (fallback)
          if (!username && currentEmail) {
            const emailParts = currentEmail.split('@');
            if (emailParts.length === 2 && emailParts[0].trim().length > 0) {
              username = emailParts[0].trim();
              console.log(`[SECURITY] ✅ Extracted username from email prefix: ${username}`);
            }
          }
        } else {
          const errorText = await getUserResponse.text().catch(() => 'Unknown error');
          lookupErrors.push(`Auth API GET failed: ${getUserResponse.status} - ${errorText}`);
          console.error(`[SECURITY] ❌ Failed to get user from Auth API: ${getUserResponse.status} - ${errorText}`);
          
          // PREVENTIVE MEASURE 8: If Auth API fails, we cannot proceed safely
          return res(getUserResponse.status || 500, {
            error: `Cannot retrieve user from Auth API: ${errorText}`,
            details: 'User may not exist in Supabase Auth'
          });
        }
      } catch (err) {
        lookupErrors.push(`Auth API GET exception: ${err.message}`);
        console.error(`[SECURITY] ❌ Exception getting user from Auth API: ${err.message}`);
        return res(500, {
          error: `Failed to retrieve user information: ${err.message}`,
          details: 'Network or API error'
        });
      }

      // PREVENTIVE MEASURE 9: Final username validation - must have username at this point
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        console.error(`[SECURITY] ❌ CRITICAL: Could not determine username after all strategies. Errors: ${lookupErrors.join('; ')}`);
        return res(500, {
          error: 'Cannot determine username for password reset',
          details: 'Username lookup failed through all available methods',
          lookupErrors: lookupErrors
        });
      }

      // Clean username (remove whitespace, validate characters)
      username = username.trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        console.warn(`[SECURITY] ⚠️ Username contains invalid characters: ${username}. Sanitizing...`);
        username = username.replace(/[^a-zA-Z0-9_-]/g, '');
        if (username.length === 0) {
          return res(400, { error: 'Username contains only invalid characters' });
        }
      }

      // PREVENTIVE MEASURE 10: Determine correct email format with validation
      // CRITICAL: Use email from parameter (passed from force-password-reset tool), 
      // then try users table (org-scoped format), otherwise construct it
      let correctEmail = `${username}@mediforge.app`; // Default fallback
      
      // Priority 1: Use email passed as parameter (from force-password-reset tool)
      if (p_email && typeof p_email === 'string' && p_email.trim().includes('@')) {
        correctEmail = p_email.trim();
        console.log(`[SECURITY] ✅ Using email from parameter: ${correctEmail}`);
      } else if (userRecord && userRecord.email && userRecord.email.trim().includes('@')) {
        // Priority 2: Use email from users table (this is what login handler uses)
        correctEmail = userRecord.email.trim();
        console.log(`[SECURITY] ✅ Using email from users table: ${correctEmail}`);
      } else if (p_user_id) {
        // Priority 3: Try to get the actual email from users table
        try {
          const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${p_user_id}&select=email`, {
            method: 'GET',
            headers: {
              ...baseHeaders,
              'Accept': 'application/json'
            }
          });
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (usersData && usersData.length > 0 && usersData[0].email) {
              const dbEmail = usersData[0].email.trim();
              if (dbEmail && dbEmail.includes('@')) {
                correctEmail = dbEmail;
                console.log(`[SECURITY] ✅ Using email from users table query: ${correctEmail}`);
              }
            }
          }
        } catch (err) {
          console.warn(`[SECURITY] ⚠️ Could not get email from users table (non-critical): ${err.message}`);
        }
      }
      
      const emailNeedsUpdate = currentEmail && currentEmail !== correctEmail;
      
      console.log(`[SECURITY] Username determined: ${username}, Current email: ${currentEmail}, Target email: ${correctEmail}, Update needed: ${emailNeedsUpdate}`);

      // PREVENTIVE MEASURE 11: Retry logic for Supabase Auth API updates
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let adminResponse = null;
      let updateSuccess = false;

      while (retryCount < MAX_RETRIES && !updateSuccess) {
        try {
          const updatePayload = {
            password: p_new_password
          };

          // If email format doesn't match expected format, update it
          if (emailNeedsUpdate) {
            updatePayload.email = correctEmail;
            console.log(`[SECURITY] Attempt ${retryCount + 1}/${MAX_RETRIES}: Updating password and email from ${currentEmail} to ${correctEmail}`);
          } else {
            console.log(`[SECURITY] Attempt ${retryCount + 1}/${MAX_RETRIES}: Updating password only (email already correct)`);
          }

          adminResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${p_auth_user_id}`, {
            method: 'PUT',
            headers: {
              ...baseHeaders,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatePayload)
          });

          if (adminResponse.ok) {
            updateSuccess = true;
            console.log(`[SECURITY] ✅ Password reset successful on attempt ${retryCount + 1}`);
          } else {
            const errorResult = await adminResponse.json().catch(() => ({}));
            const errorMessage = errorResult?.message || `HTTP ${adminResponse.status}`;
            console.warn(`[SECURITY] ⚠️ Password reset attempt ${retryCount + 1} failed: ${errorMessage}`);
            
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              // Exponential backoff: wait 100ms, 200ms, 400ms
              const delay = Math.pow(2, retryCount - 1) * 100;
              console.log(`[SECURITY] Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (err) {
          retryCount++;
          console.error(`[SECURITY] ❌ Exception during password reset attempt ${retryCount}: ${err.message}`);
          if (retryCount >= MAX_RETRIES) {
            return res(500, {
              error: `Password reset failed after ${MAX_RETRIES} attempts: ${err.message}`,
              details: 'Network or API error during password update'
            });
          }
          // Exponential backoff
          const delay = Math.pow(2, retryCount - 1) * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!updateSuccess) {
        const errorResult = await adminResponse?.json().catch(() => ({}));
        const errorMessage = errorResult?.message || `HTTP ${adminResponse?.status || 500}`;
        console.error(`[SECURITY] ❌ Password reset failure after ${MAX_RETRIES} attempts for ${p_auth_user_id} from ${clientIP} - ${errorMessage}`);
        return res(adminResponse?.status || 500, {
          error: errorMessage || `Password reset failed for user ${p_auth_user_id}`,
          details: `Failed after ${MAX_RETRIES} retry attempts`
        });
      }

      // PREVENTIVE MEASURE 12: Update users table with error handling (non-critical)
      let usersTableUpdated = false;
      if (p_user_id) {
        try {
          const updateResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${p_user_id}`, {
            method: 'PATCH',
            headers: {
              ...baseHeaders,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal'
            },
            body: JSON.stringify({
              password_reset_required: true,
              temp_password: p_new_password
            })
          });

          if (updateResponse.ok) {
            usersTableUpdated = true;
            console.log(`[SECURITY] ✅ Updated users table for ${p_user_id}`);
          } else {
            const errorText = await updateResponse.text().catch(() => 'Unknown error');
            console.warn(`[SECURITY] ⚠️ Could not update users table for ${p_user_id} (non-critical): ${updateResponse.status} - ${errorText}`);
          }
        } catch (err) {
          console.warn(`[SECURITY] ⚠️ Exception updating users table (non-critical): ${err.message}`);
        }
      }

      // PREVENTIVE MEASURE 13: Verify the update was successful by fetching user again
      let verifiedEmail = correctEmail; // Default to expected email
      let verificationSuccess = false;
      try {
        const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${p_auth_user_id}`, {
          method: 'GET',
          headers: baseHeaders
        });
        
        if (verifyResponse.ok) {
          const verifiedData = await verifyResponse.json();
          verifiedEmail = verifiedData.email;
          verificationSuccess = true;
          console.log(`[SECURITY] ✅ Verification: User email in Auth is now ${verifiedEmail}`);
          
          if (emailNeedsUpdate && verifiedEmail !== correctEmail) {
            console.error(`[SECURITY] ⚠️ WARNING: Email update may have failed. Expected ${correctEmail}, but Auth shows ${verifiedEmail}`);
          }
        } else {
          const errorText = await verifyResponse.text().catch(() => 'Unknown error');
          console.warn(`[SECURITY] ⚠️ Could not verify password reset: ${verifyResponse.status} - ${errorText}`);
        }
      } catch (err) {
        console.warn(`[SECURITY] ⚠️ Could not verify password reset (non-critical): ${err.message}`);
      }

      const emailUpdated = emailNeedsUpdate && currentEmail !== correctEmail;
      const actualEmailMatches = verificationSuccess && verifiedEmail === correctEmail;
      
      console.log(`[SECURITY] ✅ Password reset success for user ${p_auth_user_id} from ${clientIP}`);
      console.log(`[SECURITY]    Expected email: ${correctEmail}`);
      console.log(`[SECURITY]    Verified email in Auth: ${verifiedEmail}`);
      console.log(`[SECURITY]    Email updated: ${emailUpdated}`);
      console.log(`[SECURITY]    Email matches expected: ${actualEmailMatches}`);
      console.log(`[SECURITY]    Users table updated: ${usersTableUpdated}`);
      
      // Use verified email if available, otherwise use expected email
      const loginEmail = verificationSuccess ? verifiedEmail : correctEmail;
      
      return res(200, { 
        success: true,
        message: emailUpdated 
          ? `Password reset successfully. Email updated to ${loginEmail}. User should login with: ${loginEmail}` 
          : `Password reset successfully. User should login with: ${loginEmail}`,
        email: loginEmail,
        expectedEmail: correctEmail,
        verifiedEmail: verificationSuccess ? verifiedEmail : null,
        emailUpdated: emailUpdated,
        emailMatchesExpected: actualEmailMatches,
        username: username,
        usersTableUpdated: usersTableUpdated,
        diagnostic: {
          currentEmailBeforeReset: currentEmail,
          expectedEmailAfterReset: correctEmail,
          verifiedEmailAfterReset: verificationSuccess ? verifiedEmail : 'verification_failed',
          emailUpdateAttempted: emailNeedsUpdate,
          emailUpdateSuccessful: actualEmailMatches
        }
      });
    }

    // Special handler for user auth diagnosis
    if (kind === 'rpc' && identifier === 'diagnose_user_auth') {
      const { p_username, p_auth_user_id, p_user_id } = rpcPayload || {};
      
      if (!p_username && !p_auth_user_id && !p_user_id) {
        return res(400, { error: 'username, auth_user_id, or user_id is required' });
      }

      console.log(`[SECURITY] User auth diagnosis request for: username=${p_username}, auth_user_id=${p_auth_user_id}, user_id=${p_user_id} from ${clientIP}`);

      let authUserId = p_auth_user_id || null;
      let username = p_username || null;
      let userRecord = null;

      // Always load public.users by id when provided (service role: works for platform admin diagnosing any org).
      if (p_user_id) {
        try {
          const uid = encodeURIComponent(String(p_user_id).trim());
          const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${uid}&select=id,username,auth_user_id,email`, {
            method: 'GET',
            headers: baseHeaders
          });
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (usersData && usersData.length > 0) {
              userRecord = usersData[0];
              if (!authUserId) authUserId = userRecord.auth_user_id;
              if (!username) username = userRecord.username;
            }
          }
        } catch (err) {
          console.warn(`[SECURITY] Could not get user from users table by id: ${err.message}`);
        }
      }

      // If we have username but not auth_user_id, try to find it
      if (username && !authUserId) {
        try {
          const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users?username=eq.${username}&select=id,username,auth_user_id,email`, {
            method: 'GET',
            headers: baseHeaders
          });
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (usersData && usersData.length > 0) {
              userRecord = usersData[0];
              authUserId = userRecord.auth_user_id;
              console.log(`[SECURITY] Found user in users table: ${username}, auth_user_id: ${authUserId || 'MISSING'}`);
            } else {
              console.warn(`[SECURITY] User not found in users table by username: ${username}`);
            }
          } else {
            const errorText = await usersResponse.text().catch(() => 'Unknown error');
            console.warn(`[SECURITY] Users table query failed: ${usersResponse.status} - ${errorText}`);
          }
        } catch (err) {
          console.warn(`[SECURITY] Could not find user by username: ${err.message}`);
        }
      }

      // If still no auth_user_id but we have username, try to find user in Auth by email
      if (!authUserId && username) {
        console.log(`[SECURITY] No auth_user_id found, trying to find user in Auth by email patterns...`);
        const emailPatterns = [
          `${username}@mediforge.app`,
          `${username}@example.com`
        ];
        
        for (const emailPattern of emailPatterns) {
          try {
            // List users and search by email (Auth Admin API doesn't have direct email search)
            // We'll need to get all users and filter, but that's expensive
            // Instead, let's try to get user by attempting to find them
            console.log(`[SECURITY] Attempting to find user in Auth with email: ${emailPattern}`);
            // Note: Auth Admin API doesn't support email search directly
            // We'll proceed without auth_user_id and provide diagnostic info
          } catch (err) {
            console.warn(`[SECURITY] Could not search Auth by email ${emailPattern}: ${err.message}`);
          }
        }
      }

      // If we have userRecord but no authUserId, that's a problem but we can still provide some info
      if (userRecord && !authUserId) {
        console.warn(`[SECURITY] User found in users table but missing auth_user_id: ${username}`);
        const profEmail = userRecord.email && String(userRecord.email).trim();
        return res(200, {
          success: false,
          warning: 'User found in users table but missing auth_user_id',
          diagnosis: {
            usersTable: userRecord,
            authUser: null,
            expectedEmail: profEmail || (username ? `${username}@mediforge.app` : null),
            emailMatchesExpected: null,
            recommendations: [
              'User exists in users table but has no auth_user_id',
              'This user may not be properly registered in Supabase Auth',
              'Try resetting password to create/update Auth record'
            ]
          }
        });
      }

      // If we have neither userRecord nor authUserId, return error
      if (!authUserId && !userRecord) {
        return res(404, { 
          error: 'User not found in users table',
          searched: { username: p_username, user_id: p_user_id },
          suggestions: [
            'Verify the username is correct',
            'Check if user exists in the users table',
            'User may need to be registered in Supabase Auth'
          ]
        });
      }

      // Get user details from Supabase Auth
      try {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
          method: 'GET',
          headers: baseHeaders
        });

        if (!authResponse.ok) {
          const errorText = await authResponse.text().catch(() => 'Unknown error');
          return res(authResponse.status, {
            error: `Cannot retrieve user from Auth API: ${errorText}`,
            auth_user_id: authUserId
          });
        }

        const authUserData = await authResponse.json();
        const profileEmail = userRecord && userRecord.email ? String(userRecord.email).trim() : '';
        const fallbackExpected = username ? `${username}@mediforge.app` : null;
        const expectedForLogin = profileEmail || fallbackExpected;
        const emailsMatch =
          profileEmail
            ? authUserData.email === profileEmail
            : (username && authUserData.email === `${username}@mediforge.app`);

        const diagnosis = {
          usersTable: userRecord || null,
          authUser: {
            id: authUserData.id,
            email: authUserData.email,
            emailConfirmed: authUserData.email_confirmed_at !== null,
            createdAt: authUserData.created_at,
            lastSignIn: authUserData.last_sign_in_at,
            userMetadata: authUserData.user_metadata || {},
            appMetadata: authUserData.app_metadata || {}
          },
          profileEmail: profileEmail || null,
          expectedEmail: expectedForLogin,
          emailMatchesExpected: emailsMatch,
          recommendations: []
        };

        // Add recommendations (compare Auth to public.users email when available, not a fictional @mediforge.app)
        if (profileEmail && authUserData.email !== profileEmail) {
          diagnosis.recommendations.push(
            `Email mismatch: Supabase Auth has "${authUserData.email}" but public.users.email is "${profileEmail}" (login uses profile email).`
          );
        } else if (!profileEmail && username && authUserData.email !== `${username}@mediforge.app`) {
          diagnosis.recommendations.push(
            `Email mismatch: Auth has "${authUserData.email}" but legacy check expected "${username}@mediforge.app" (set public.users.email or align Auth email).`
          );
        }
        if (!authUserData.email_confirmed_at) {
          diagnosis.recommendations.push('Email not confirmed in Auth');
        }

        console.log(`[SECURITY] ✅ User diagnosis complete for ${authUserId}: email=${authUserData.email}`);
        return res(200, { success: true, diagnosis });
      } catch (err) {
        console.error(`[SECURITY] ❌ Exception during user diagnosis: ${err.message}`);
        return res(500, {
          error: `Failed to diagnose user: ${err.message}`,
          auth_user_id: authUserId
        });
      }
    }

    if (kind === 'rpc') {
      if (!ALLOWED_RPCS.has(identifier)) {
        console.warn(`[SECURITY] Unauthorized RPC attempt: ${identifier} from ${clientIP} (${userAgent})`);
        return res(403, { error: `RPC ${identifier} is not permitted` });
      }

      console.log(`[SECURITY] RPC call: ${identifier} from ${clientIP} at ${requestTime}`);

      if (identifier === 'approve_patient_intake_submission') {
        const { p_submission_id, p_prefix, p_reviewer_name, p_reviewer_id } = rpcPayload || {};
        if (!isUuid(p_submission_id)) {
          return res(400, { error: 'Invalid submission ID format' });
        }

        const submissionResponse = await fetch(
          `${supabaseUrl}/rest/v1/patient_intake_submissions?id=eq.${p_submission_id}&select=*`,
          { method: 'GET', headers: baseHeaders }
        );

        if (!submissionResponse.ok) {
          const errorText = await submissionResponse.text().catch(() => 'Unknown error');
          return res(submissionResponse.status, { error: errorText || 'Unable to fetch submission' });
        }

        const submissionRows = await submissionResponse.json();
        const submission = Array.isArray(submissionRows) ? submissionRows[0] : null;

        if (!submission) {
          return res(404, { error: 'Submission not found' });
        }

        if (submission.status === 'rejected') {
          return res(400, { error: 'Submission has already been rejected' });
        }

        if (submission.status === 'approved' && submission.created_patient_id) {
          return res(200, {
            data: [{ submission_id: submission.id, patient_identifier: submission.created_patient_id, patient_row_id: submission.created_patient_record }]
          });
        }

        const patientsResponse = await fetch(
          `${supabaseUrl}/rest/v1/patients?organization_id=eq.${submission.organization_id}&select=patient_id`,
          { method: 'GET', headers: baseHeaders }
        );

        if (!patientsResponse.ok) {
          const errorText = await patientsResponse.text().catch(() => 'Unknown error');
          return res(patientsResponse.status, { error: errorText || 'Unable to load patients for sequence' });
        }

        const patients = await patientsResponse.json();

        let prefix;
        let maxNumber;

        if (submission.organization_id === MFASC_ORGANIZATION_ID) {
          const orgResponse = await fetch(
            `${supabaseUrl}/rest/v1/organizations?id=eq.${MFASC_ORGANIZATION_ID}&select=settings`,
            { method: 'GET', headers: baseHeaders }
          );
          if (!orgResponse.ok) {
            const errorText = await orgResponse.text().catch(() => 'Unknown error');
            return res(orgResponse.status, { error: errorText || 'Unable to load organization settings' });
          }
          const orgRows = await orgResponse.json();
          const orgRow = Array.isArray(orgRows) ? orgRows[0] : null;
          if (!orgRow) {
            return res(404, { error: 'Organization not found for this submission' });
          }
          const settingsPrefix =
            orgRow.settings &&
            typeof orgRow.settings.patient_id_prefix === 'string' &&
            orgRow.settings.patient_id_prefix.trim()
              ? orgRow.settings.patient_id_prefix.trim().toUpperCase()
              : null;
          prefix = settingsPrefix || 'MFA-SC';
          if (p_prefix && String(p_prefix).trim().toUpperCase() !== prefix) {
            console.log(`[SECURITY] approve_patient_intake_submission (MFASC): using patient_id_prefix="${prefix}" (client p_prefix="${p_prefix}")`);
          }
          maxNumber = maxPatientSequenceNumber(patients);
        } else {
          prefix = normalizePrefix(p_prefix, 'MEC');
          const prefixRegex = new RegExp(`^${prefix}(\\d+)$`);
          maxNumber = 0;
          (patients || []).forEach((row) => {
            const match = typeof row.patient_id === 'string' ? row.patient_id.match(prefixRegex) : null;
            if (match && match[1]) {
              const value = parseInt(match[1], 10);
              if (!Number.isNaN(value) && value > maxNumber) {
                maxNumber = value;
              }
            }
          });
        }

        const nextNumber = (maxNumber + 1).toString().padStart(4, '0');
        const patientIdentifier = `${prefix}${nextNumber}`;

        const payload = normalizePatientRecord(submission.patient_payload || {});
        const emergencyAddress = buildEmergencyAddress(payload);
        const emergencyEmail = payload.emergencyEmail || null;
        const todayYmd = new Date().toISOString().slice(0, 10);
        const dateJoinedPractice = (payload.dateJoinedPractice && String(payload.dateJoinedPractice).slice(0, 10)) || todayYmd;

        const insertPayload = [{
          patient_id: patientIdentifier,
          organization_id: submission.organization_id,
          first_name: payload.firstName || null,
          last_name: payload.lastName || null,
          middle_name: payload.middleName || null,
          date_of_birth: payload.dob || null,
          gender: payload.gender || null,
          phone: payload.phone || null,
          email: payload.email || null,
          address_line1: payload.addressLine1 || null,
          address_line2: payload.addressLine2 || null,
          city: payload.city || null,
          state: payload.state || null,
          country: payload.country || null,
          postal_code: payload.postalCode || null,
          marital_status: payload.maritalStatus || null,
          race: payload.race || null,
          payment_source: payload.paymentSource || 'Self Pay',
          emergency_contact_name: [payload.emergencyFirstName, payload.emergencyLastName].filter(Boolean).join(' ') || null,
          emergency_contact_phone: payload.emergencyPhone || null,
          emergency_contact_relationship: payload.emergencyRelationship || null,
          emergency_contact_email: emergencyEmail,
          emergency_contact_address: emergencyAddress || null,
          medical_history: payload.medicalHistory || [],
          allergies: payload.allergies || [],
          medications: payload.medications || [],
          immunizations: payload.immunizations || [],
          date_joined_practice: dateJoinedPractice,
          created_by: p_reviewer_name || 'Intake Approval',
          created_at: new Date().toISOString()
        }];

        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/patients`, {
          method: 'POST',
          headers: { ...baseHeaders, Prefer: 'return=representation' },
          body: JSON.stringify(insertPayload)
        });

        if (!insertResponse.ok) {
          const errorText = await insertResponse.text().catch(() => 'Unknown error');
          return res(insertResponse.status, { error: errorText || 'Unable to create patient record' });
        }

        const inserted = await insertResponse.json();
        const patientRowId = Array.isArray(inserted) && inserted.length ? inserted[0].id : null;

        const reviewerNote = p_reviewer_name ? `Approved by ${p_reviewer_name}` : 'Approved via intake approvals';

        const updateResponse = await fetch(
          `${supabaseUrl}/rest/v1/patient_intake_submissions?id=eq.${submission.id}`,
          {
            method: 'PATCH',
            headers: { ...baseHeaders, Prefer: 'return=minimal' },
            body: JSON.stringify({
              status: 'approved',
              reviewed_at: new Date().toISOString(),
              reviewed_by: p_reviewer_id || null,
              decision_notes: reviewerNote,
              created_patient_id: patientIdentifier,
              created_patient_record: patientRowId
            })
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text().catch(() => 'Unknown error');
          return res(updateResponse.status, { error: errorText || 'Unable to update submission status' });
        }

        return res(200, {
          data: [{ submission_id: submission.id, patient_identifier: patientIdentifier, patient_row_id: patientRowId }]
        });
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${identifier}`, {
        method: 'POST',
        headers: {
          ...baseHeaders,
          Prefer: 'count=exact'
        },
        body: JSON.stringify(rpcPayload || {})
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error(`[SECURITY] RPC failure: ${identifier} from ${clientIP} - ${result?.message || 'Unknown error'}`);
        return res(response.status, {
          error: result?.message || `Supabase RPC ${identifier} failed`
        });
      }

      console.log(`[SECURITY] RPC success: ${identifier} from ${clientIP}`);
      return res(200, { data: result });
    }

    if (kind === 'select') {
      // Platform admin SELECT queries that bypass RLS
      if (!ALLOWED_TABLE_SELECTS.has(identifier)) {
        console.warn(`[SECURITY] Unauthorized select attempt: ${identifier} from ${clientIP} (${userAgent})`);
        return res(403, { error: `Select on ${identifier} is not permitted` });
      }

      // Parse query parameters from payload
      const { 
        select = '*', 
        filters = {}, 
        order = { column: 'timestamp', ascending: false },
        limit = 5000,
        offset = 0
      } = rpcPayload || {};

      // Build query URL
      let queryUrl = `${supabaseUrl}/rest/v1/${identifier}?select=${encodeURIComponent(select)}`;
      
      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            queryUrl += `&${key}=in.(${value.join(',')})`;
          } else if (typeof value === 'object' && value.operator) {
            // Support operators like { operator: 'gte', value: '2024-01-01' }
            const operator = value.operator; // gte, lte, eq, neq, etc.
            const filterValue = encodeURIComponent(value.value);
            queryUrl += `&${key}=${operator}.${filterValue}`;
          } else {
            const filterValue = encodeURIComponent(value);
            queryUrl += `&${key}=eq.${filterValue}`;
          }
        }
      });

      // Add ordering
      if (order && order.column) {
        queryUrl += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`;
      }

      // Add limit and offset
      if (limit) queryUrl += `&limit=${limit}`;
      if (offset) queryUrl += `&offset=${offset}`;

      console.log(`[SECURITY] Select call: ${identifier} from ${clientIP} at ${requestTime}`);
      console.log(`[SECURITY] Query URL: ${queryUrl}`);

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          ...baseHeaders,
          Prefer: 'count=exact'
        }
      });

      // Supabase PostgREST returns arrays directly for SELECT queries
      let result;
      try {
        const responseText = await response.text();
        if (responseText) {
          result = JSON.parse(responseText);
        } else {
          result = [];
        }
      } catch (parseError) {
        console.error(`[SECURITY] Failed to parse response:`, parseError);
        result = [];
      }

      // Handle error responses
      if (!response.ok) {
        const errorMessage = (typeof result === 'object' && result !== null && result.message) 
          ? result.message 
          : (typeof result === 'string' ? result : 'Unknown error');
        console.error(`[SECURITY] Select failure: ${identifier} from ${clientIP} - ${errorMessage}`);
        return res(response.status, {
          error: errorMessage || `Supabase select on ${identifier} failed`
        });
      }

      // Ensure result is an array
      if (!Array.isArray(result)) {
        console.warn(`[SECURITY] Unexpected result format, converting to array:`, typeof result);
        result = [];
      }

      // Get count from response headers
      const countHeader = response.headers.get('content-range');
      const totalCount = countHeader ? parseInt(countHeader.split('/')[1]) : result.length;

      console.log(`[SECURITY] Select success: ${identifier} from ${clientIP} - ${result.length} records`);
      return res(200, { 
        data: result,
        count: result.length,
        total: totalCount
      });
    }

    if (kind === 'insert') {
      if (!ALLOWED_TABLE_INSERTS.has(identifier)) {
        console.warn(`[SECURITY] Unauthorized insert attempt: ${identifier} from ${clientIP} (${userAgent})`);
        return res(403, { error: `Insert on ${identifier} is not permitted` });
      }

      const records = Array.isArray(rpcPayload) ? rpcPayload : [];
      if (!records.length) {
        return res(400, { error: 'Payload must be a non-empty array for inserts' });
      }

      // Validate and sanitize audit_logs payloads
      if (identifier === 'audit_logs' && records.length > 0) {
        const sanitizeStr = (v, max) => {
          if (v == null) return v;
          const s = String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').trim();
          return max && s.length > max ? s.slice(0, max) : s;
        };
        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          if (!r || typeof r !== 'object') {
            return res(400, { error: `audit_logs record ${i + 1}: must be an object` });
          }
          const username = r.username != null ? sanitizeStr(r.username, 255) : '';
          const action = r.action != null ? sanitizeStr(r.action, 255) : '';
          if (!username || !action) {
            return res(400, { error: `audit_logs record ${i + 1}: username and action are required` });
          }
          records[i] = { ...r, username, action };
        }
      }

      // Enhance audit log entries with IP address and user agent from request
      if (identifier === 'audit_logs' && records.length > 0) {
        records.forEach(record => {
          // Update ip_address from request headers (overwrite null or 'N/A')
          if (!record.ip_address || record.ip_address === 'N/A') {
            record.ip_address = clientIP !== 'unknown' ? clientIP : 'N/A';
          }
          // Update user_agent if not already set or is null
          if (!record.user_agent && userAgent && userAgent !== 'unknown') {
            record.user_agent = userAgent;
          }
        });
      }

      console.log(`[SECURITY] Insert call: ${identifier} (${records.length} records) from ${clientIP} at ${requestTime}`);

      const response = await fetch(`${supabaseUrl}/rest/v1/${identifier}`, {
        method: 'POST',
        headers: {
          ...baseHeaders,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(records)
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        console.error(`[SECURITY] Insert failure: ${identifier} from ${clientIP} - ${result?.message || 'Unknown error'}`);
        return res(response.status, {
          error: result?.message || `Supabase insertion into ${identifier} failed`
        });
      }

      console.log(`[SECURITY] Insert success: ${identifier} (${records.length} records) from ${clientIP}`);
      return res(200, { data: { inserted: records.length } });
    }

    return res(400, { error: `Unsupported operation kind: ${kind}` });
  } catch (error) {
    console.error(`[SECURITY] Proxy error from ${clientIP}:`, error.message, error.stack);
    return res(500, { error: 'Unexpected proxy error' });
  }
};

