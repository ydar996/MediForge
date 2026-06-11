// Purpose: Complete Supabase-based authentication system to replace localStorage auth
// Version: 1.0

// Initialize Supabase client
const SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
const SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');

let supabase = null;

// Initialize Supabase client
function initSupabase() {
  if (!supabase && typeof window.supabase !== 'undefined') {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ [SUPABASE-AUTH] Client initialized');
      return true;
    } catch (error) {
      console.error('❌ [SUPABASE-AUTH] Error initializing client:', error);
      return false;
    }
  }
  return supabase !== null;
}

// ===== USER AUTHENTICATION =====

// Login user with email and password
window.supabaseLogin = async function(email, password) {
  console.log('🔐 [SUPABASE-AUTH] Starting login for:', email);
  
  if (!initSupabase()) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) {
      console.error('❌ [SUPABASE-AUTH] Login error:', error.message);
      return { success: false, error: error.message };
    }
    
    if (data && data.user) {
      // Fetch user profile from public.users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .single();
      
      if (profileError) {
        console.error('❌ [SUPABASE-AUTH] Profile fetch error:', profileError.message);
        return { success: false, error: 'Failed to fetch user profile' };
      }
      
      // Store user session data in localStorage for backward compatibility
      const userSessionData = {
        username: profile.username,
        email: data.user.email,
        role: profile.role,
        org: profile.organization_id, // Store organization ID
        organizationId: profile.organization_id, // Also store as organizationId for consistency
        firstName: profile.first_name,
        lastName: profile.last_name,
        medicalLicenseNumber: profile.license_number || profile.medical_license_number || '',
        auth_user_id: data.user.id,
        gender: profile.gender
      };
      
      localStorage.setItem('user', JSON.stringify(userSessionData));
      localStorage.setItem('supabase_session', JSON.stringify(data.session));
      
      console.log('✅ [SUPABASE-AUTH] Login successful:', userSessionData.username);
      return { success: true, user: userSessionData };
    }
    
    return { success: false, error: 'Unknown login error' };
    
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] Login exception:', e.message);
    return { success: false, error: e.message };
  }
};

// Register new user
window.supabaseRegister = async function(email, password, username, role, organizationId, firstName, lastName, medicalLicenseNumber, gender) {
  console.log('🔐 [SUPABASE-AUTH] Starting registration for:', username);
  
  if (!initSupabase()) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    // First, sign up the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password
    });
    
    if (authError) {
      console.error('❌ [SUPABASE-AUTH] Registration error (Auth):', authError.message);
      return { success: false, error: authError.message };
    }
    
    if (authData && authData.user) {
      // Create user profile in the public.users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert([{
          auth_user_id: authData.user.id,
          username: username,
          email: email,
          role: role,
          organization_id: organizationId,
          first_name: firstName,
          last_name: lastName,
          license_number: medicalLicenseNumber,
          gender: gender
        }])
        .select()
        .single();
      
      if (profileError) {
        console.error('❌ [SUPABASE-AUTH] Registration error (Profile):', profileError.message);
        return { success: false, error: profileError.message };
      }
      
      console.log('✅ [SUPABASE-AUTH] Registration successful:', username);
      return { success: true, user: authData.user };
    }
    
    return { success: false, error: 'Unknown registration error' };
    
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] Registration exception:', e.message);
    return { success: false, error: e.message };
  }
};

// Logout user
window.supabaseLogout = async function() {
  console.log('🔐 [SUPABASE-AUTH] Starting logout');
  
  if (!initSupabase()) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ [SUPABASE-AUTH] Logout error:', error.message);
      return { success: false, error: error.message };
    }
    
    // Clear encryption key from memory (security)
    if (typeof window.encryptionService !== 'undefined' && window.encryptionService) {
      window.encryptionService.clearKey();
    }

    // Clear localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('supabase_session');
    
    console.log('✅ [SUPABASE-AUTH] Logout successful');
    return { success: true };
    
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] Logout exception:', e.message);
    return { success: false, error: e.message };
  }
};

// ===== ORGANIZATION MANAGEMENT =====

// Get organization data
window.getSupabaseOrganization = async function(organizationId) {
  console.log('🏥 [SUPABASE-AUTH] Getting organization:', organizationId);
  
  if (!initSupabase()) {
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();
    
    if (error) {
      console.error('❌ [SUPABASE-AUTH] Organization fetch error:', error.message);
      return null;
    }
    
    console.log('✅ [SUPABASE-AUTH] Organization found:', data.name);
    return data;
    
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] Organization fetch exception:', e.message);
    return null;
  }
};

// Create organization
window.createSupabaseOrganization = async function(orgData) {
  console.log('🏥 [SUPABASE-AUTH] Creating organization:', orgData.name);
  
  if (!initSupabase()) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const { data, error } = await supabase
      .from('organizations')
      .insert([orgData])
      .select()
      .single();
    
    if (error) {
      console.error('❌ [SUPABASE-AUTH] Organization creation error:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ [SUPABASE-AUTH] Organization created:', data.name);
    return { success: true, organization: data };
    
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] Organization creation exception:', e.message);
    return { success: false, error: e.message };
  }
};

// ===== USER MANAGEMENT =====

// Get user profile
window.getSupabaseUserProfile = async function(userId) {
  console.log('👤 [SUPABASE-AUTH] Getting user profile:', userId);
  
  if (!initSupabase()) {
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', userId)
      .single();
    
    if (error) {
      console.error('❌ [SUPABASE-AUTH] User profile fetch error:', error.message);
      return null;
    }
    
    console.log('✅ [SUPABASE-AUTH] User profile found:', data.username);
    return data;
    
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] User profile fetch exception:', e.message);
    return null;
  }
};

// Update user profile
window.updateSupabaseUserProfile = async function(userId, updates) {
  console.log('👤 [SUPABASE-AUTH] Updating user profile:', userId);
  
  if (!initSupabase()) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('auth_user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [SUPABASE-AUTH] User profile update error:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ [SUPABASE-AUTH] User profile updated:', data.username);
    return { success: true, user: data };
    
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] User profile update exception:', e.message);
    return { success: false, error: e.message };
  }
};

// ===== SESSION MANAGEMENT =====

// Check if user is authenticated
window.supabaseCheckAuth = async function() {
  console.log('🔍 [SUPABASE-AUTH] Checking authentication status');
  
  if (!initSupabase()) {
    return { authenticated: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ [SUPABASE-AUTH] Auth check error:', error.message);
      return { authenticated: false, error: error.message };
    }
    
    if (user) {
      // Get user profile
      const profile = await getSupabaseUserProfile(user.id);
      if (profile) {
        console.log('✅ [SUPABASE-AUTH] User authenticated:', profile.username);
        return { authenticated: true, user: profile };
      }
    }
    
    console.log('❌ [SUPABASE-AUTH] User not authenticated');
    return { authenticated: false };
    
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] Auth check exception:', e.message);
    return { authenticated: false, error: e.message };
  }
};

// Get current session
window.getSupabaseSession = async function() {
  if (!initSupabase()) {
    return null;
  }
  
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('❌ [SUPABASE-AUTH] Session fetch error:', error.message);
      return null;
    }
    return data.session;
  } catch (e) {
    console.error('❌ [SUPABASE-AUTH] Session fetch exception:', e.message);
    return null;
  }
};

// ===== DATA ISOLATION =====

// Get current user's organization ID
window.getCurrentUserOrganizationId = async function() {
  console.log('🏥 [SUPABASE-AUTH] Getting current user organization ID');
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.org) {
    return user.org;
  }
  
  // Fallback: get from Supabase
  if (initSupabase()) {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const profile = await getSupabaseUserProfile(authUser.id);
        return profile ? profile.organization_id : null;
      }
    } catch (e) {
      console.error('❌ [SUPABASE-AUTH] Error getting organization ID:', e.message);
    }
  }
  
  return null;
};

// ===== BACKWARD COMPATIBILITY =====

// Legacy function for backward compatibility
window.validateLoginCredentials = async function(username, password) {
  console.log('🔄 [SUPABASE-AUTH] Legacy login attempt for:', username);
  
  // Try to find user by username in Supabase
  if (initSupabase()) {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username);
      
      if (error || !users || users.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      const user = users[0];
      
      // Try to login with the user's email
      const loginResult = await supabaseLogin(user.email, password);
      
      if (loginResult.success) {
        console.log('✅ [SUPABASE-AUTH] Legacy login successful:', username);
        return loginResult;
      } else {
        return { success: false, error: 'Invalid password' };
      }
      
    } catch (e) {
      console.error('❌ [SUPABASE-AUTH] Legacy login exception:', e.message);
      return { success: false, error: e.message };
    }
  }
  
  return { success: false, error: 'Supabase not available' };
};

console.log('✅ [SUPABASE-AUTH] Complete authentication system loaded');


