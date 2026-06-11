/**
 * Netlify Function: get-platform-legal-agreements
 * Fetches legal agreements for platform admins, bypassing RLS using service role key
 */

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: RESPONSE_HEADERS,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const { email, username } = JSON.parse(event.body || '{}');

    if (!email && !username) {
      return jsonResponse(400, { error: 'Email or username required' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseServiceKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured');
      return jsonResponse(500, { error: 'Server configuration error' });
    }

    const searchEmail = email || username;

    // First, verify the user is a platform admin using REST API
    const userCheckUrl = `${supabaseUrl}/rest/v1/users?select=id,username,role,auth_user_id,email&or=(email.eq.${encodeURIComponent(searchEmail)},username.eq.${encodeURIComponent(searchEmail)})&limit=1`;
    const userResponse = await fetch(userCheckUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    if (!userResponse.ok) {
      return jsonResponse(500, { error: 'Failed to verify user' });
    }

    const userDataArray = await userResponse.json();
    const userData = userDataArray && userDataArray.length > 0 ? userDataArray[0] : null;

    if (!userData) {
      return jsonResponse(404, { error: 'User not found' });
    }

    const platformAdminRoles = ['PlatformAdmin', 'PlatformOwner', 'Platform Admin', 'Platform Owner', 'Platform administrator', 'Platform owner'];
    if (!platformAdminRoles.includes(userData.role)) {
      return jsonResponse(403, { error: 'User is not a platform admin' });
    }

    // Fetch all legal agreements using REST API (service role bypasses RLS)
    const agreementsUrl = `${supabaseUrl}/rest/v1/legal_agreements?select=*,users:user_id(username,first_name,last_name,role),organizations:organization_id(name)&order=signed_at.desc`;
    const agreementsResponse = await fetch(agreementsUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    if (!agreementsResponse.ok) {
      const errorText = await agreementsResponse.text();
      console.error('❌ Error fetching agreements:', errorText);
      return jsonResponse(500, { error: 'Failed to fetch agreements' });
    }

    const agreements = await agreementsResponse.json();

    return jsonResponse(200, {
      success: true,
      agreements: agreements || []
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

