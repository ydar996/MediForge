// Purpose: Robust login handler that works without cache dependencies
// Version: 1.0

// Inline Supabase configuration to avoid cache issues
const SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
const SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔐 Robust login handler loaded');
  
  const loginForm = document.getElementById('login-form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const loginField = document.getElementById('login-field').value.trim();
      const password = document.getElementById('password').value;
      
      console.log('🔐 Login attempt for:', loginField);
      
      // Show loading state
      const submitButton = loginForm.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Logging in...';
      submitButton.disabled = true;
      
      try {
        // Use Supabase for all logins now
        console.log('🔐 Attempting Supabase login for:', loginField);
        
        // First, try to find the user by username in Supabase
        const supabase = window.supabase.createClient(
          ((window.__SUPABASE_CONFIG__||{}).url||''),
          ((window.__SUPABASE_CONFIG__||{}).anonKey||'')
        );
        
        let userData = null;
        let userError = null;
        if (typeof window.lookupUserPublicLogin === 'function') {
          const r = await window.lookupUserPublicLogin(supabase, loginField, 'username', null);
          userData = r.data;
          userError = r.error;
        } else {
          const res = await supabase.rpc('lookup_user_public_login', {
            p_identifier: loginField,
            p_type: 'username',
            p_role: null
          });
          userError = res.error;
          userData = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
        }
        
        if (userError || !userData) {
          // If username not found, try as email
          console.log('🔐 Username not found, trying as email:', loginField);
          const result = await directSupabaseLogin(loginField, password);
          
          if (result.success) {
            console.log('✅ Supabase login successful:', result.user.username);
            alert(`Welcome back, ${result.user.firstName} ${result.user.lastName}!`);
            window.location.href = 'dashboard';
          } else {
            console.error('❌ Supabase login failed:', result.error);
            alert(`Login failed: User not found or incorrect password. Please check your username/email and password.`);
          }
        } else {
          // User found by username, use their actual email from database
          // This handles the new org-scoped email format (username-{orgId}@mediforge.app)
          const email = userData.email || `${userData.username}@mediforge.app`;
          console.log('🔐 User found by username, using email from database:', email);
          
          const result = await directSupabaseLogin(email, password);
          
          if (result.success) {
            console.log('✅ Supabase login successful:', result.user.username);
            alert(`Welcome back, ${result.user.firstName} ${result.user.lastName}!`);
            window.location.href = 'dashboard';
          } else {
            console.error('❌ Supabase login failed:', result.error);
            alert(`Login failed: User not found or incorrect password. Please check your username and password.`);
          }
        }
        
      } catch (error) {
        console.error('❌ Login exception:', error);
        alert(`Login error: ${error.message}`);
      } finally {
        // Restore button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    });
  } else {
    console.error('❌ Login form not found');
  }
});

// Direct Supabase login function (no cache dependencies)
async function directSupabaseLogin(email, password) {
  try {
    console.log('🔐 Creating Supabase client for login...');
    
    // Create Supabase client directly
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    console.log('🔐 Attempting Supabase login for:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) {
      console.error('❌ Supabase login error:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Supabase login successful');
    
    // Get user profile directly
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();
    
    if (profileError) {
      console.error('❌ User profile not found:', profileError.message);
      return { success: false, error: 'User profile not found' };
    }
    
    // Store session data in localStorage for backward compatibility
    const sessionData = {
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile.username,
        role: profile.role,
        org: profile.organization_id,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        medicalLicenseNumber: profile.license_number || profile.medical_license_number || '',
        gender: profile.gender || 'Male'
      },
      session: data.session,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('user', JSON.stringify(sessionData.user));
    localStorage.setItem('supabase_session', JSON.stringify(data.session));
    
    console.log('✅ User session stored:', sessionData.user.username);
    
    return { success: true, user: sessionData.user };
    
  } catch (e) {
    console.error('❌ Supabase login exception:', e.message);
    return { success: false, error: e.message };
  }
}

// Direct localStorage login function (no cache dependencies)
async function directLocalStorageLogin(username, password) {
  try {
    console.log('🔐 Attempting localStorage login for:', username);
    
    // Get users from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    
    // Find user
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Validate password
    const hashedPassword = btoa(password); // Simple base64 encoding
    
    if (user.password !== hashedPassword) {
      return { success: false, error: 'Invalid password' };
    }
    
    // Get organization data
    const orgData = organizations[user.org] || {};
    
    // Create user session data
    const userSessionData = {
      username: user.username,
      role: user.role,
      org: user.org,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      medicalLicenseNumber: user.medicalLicenseNumber || '',
      orgAddressLine1: orgData.addressLine1 || '',
      orgAddressLine2: orgData.addressLine2 || '',
      orgCity: orgData.city || '',
      orgState: orgData.state || '',
      orgCountry: orgData.country || '',
      orgPhone: orgData.phone || '',
      afterHoursPhone: orgData.afterHoursPhone || '',
      gender: user.gender || 'Male'
    };
    
    console.log('✅ localStorage login successful:', userSessionData.username);
    
    return { success: true, user: userSessionData };
    
  } catch (e) {
    console.error('❌ localStorage login exception:', e.message);
    return { success: false, error: e.message };
  }
}

console.log('✅ Robust login module loaded');
