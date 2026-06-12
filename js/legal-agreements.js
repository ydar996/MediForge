/**
 * Legal Agreements Management
 * Handles storage and retrieval of signed legal agreements (BAA, Service Agreement)
 */

/**
 * Save a signed legal agreement to the database
 * @param {object} agreementData - Agreement data
 * @param {string} agreementData.userId - User ID who signed
 * @param {string} agreementData.organizationId - Organization ID
 * @param {string} agreementData.agreementType - 'service_agreement', 'baa', 'canadian_addendum', or legacy 'dpa'
 * @param {string} agreementData.userName - Full name of signer
 * @param {string} agreementData.userRole - Role at time of signing
 * @param {string} agreementData.userEmail - Email at time of signing
 * @param {string} agreementData.agreementText - Full text of agreement
 * @returns {Promise<{success: boolean, error?: string, agreementId?: string}>}
 */
async function saveLegalAgreement(agreementData) {
  try {
    if (!window.supabaseClient) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    const {
      userId,
      organizationId,
      agreementType,
      userName,
      userRole,
      userEmail,
      agreementText
    } = agreementData;

    // Validate required fields
    if (!userId || !agreementType || !userName || !userRole || !userEmail) {
      return { 
        success: false, 
        error: 'Missing required fields: userId, agreementType, userName, userRole, and userEmail are required' 
      };
    }

    // Get IP address and user agent
    let ipAddress = 'Unknown';
    let userAgent = navigator.userAgent || 'Unknown';
    
    // Try to get IP (may not be available client-side)
    try {
      // Note: Real IP detection requires server-side, but we can try
      ipAddress = 'Client-side registration';
    } catch (e) {
      // Ignore
    }

    const agreementVersion = '2026-06-12'; // Canada-first legal framework

    console.log('💼 Saving legal agreement:', {
      userId,
      agreementType,
      userName,
      userRole,
      agreementVersion
    });

    // Insert agreement into database
    const { data, error } = await window.supabaseClient
      .from('legal_agreements')
      .insert({
        user_id: userId,
        organization_id: organizationId || null,
        agreement_type: agreementType,
        agreement_version: agreementVersion,
        user_name: userName,
        user_role: userRole,
        user_email: userEmail,
        ip_address: ipAddress,
        user_agent: userAgent,
        agreement_text: agreementText || null
      })
      .select('id')
      .single();

    if (error) {
      // Handle table not found error gracefully
      if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
        console.error('❌ Legal agreements table not found. Please run the migration: 20250118000004_create_legal_agreements_table.sql');
        return { 
          success: false, 
          error: 'Legal agreements table not found. Please contact administrator to run the database migration.' 
        };
      }
      
      console.error('❌ Error saving legal agreement:', error);
      
      // If it's a duplicate (user already signed this version), that's okay
      if (error.code === '23505') {
        console.log('✅ Agreement already exists for this user and version');
        return { 
          success: true, 
          message: 'Agreement already recorded',
          agreementId: null
        };
      }
      
      return { success: false, error: error.message };
    }

    console.log('✅ Legal agreement saved successfully:', data.id);

    // Update user's legal_agreements_accepted flag
    try {
      const { error: updateError } = await window.supabaseClient
        .from('users')
        .update({
          legal_agreements_accepted: true,
          legal_agreements_accepted_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.warn('⚠️ Could not update user legal_agreements_accepted flag:', updateError);
        // Don't fail - agreement is saved
      } else {
        console.log('✅ User legal_agreements_accepted flag updated');
      }
    } catch (updateException) {
      console.warn('⚠️ Exception updating user flag:', updateException);
      // Don't fail - agreement is saved
    }

    return { 
      success: true, 
      agreementId: data.id 
    };

  } catch (error) {
    console.error('❌ Exception saving legal agreement:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error saving legal agreement' 
    };
  }
}

/**
 * Get all legal agreements for a user
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, agreements?: array, error?: string}>}
 */
async function getUserLegalAgreements(userId) {
  try {
    if (!window.supabaseClient) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    const { data, error } = await window.supabaseClient
      .from('legal_agreements')
      .select('*')
      .eq('user_id', userId)
      .order('signed_at', { ascending: false });

    if (error) {
      // Handle table not found error gracefully
      if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
        console.warn('⚠️ Legal agreements table not found. Migration may not have been run.');
        return { success: true, agreements: [], error: 'Table not found - migration required' };
      }
      console.error('❌ Error fetching user legal agreements:', error);
      return { success: false, error: error.message };
    }

    return { success: true, agreements: data || [] };

  } catch (error) {
    console.error('❌ Exception fetching user legal agreements:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error fetching legal agreements' 
    };
  }
}

/**
 * Get all legal agreements (platform admin view)
 * @param {string} organizationId - Optional organization ID filter
 * @returns {Promise<{success: boolean, agreements?: array, error?: string}>}
 */
async function getAllLegalAgreements(organizationId = null) {
  try {
    if (!window.supabaseClient) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    // Debug: Check current user and role
    // Try to restore session from localStorage if available
    let authUser = null;
    let authError = null;
    
    try {
      // Check if there's a stored Supabase session
      const storedSession = localStorage.getItem('supabase_session');
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          // Restore session if it exists
          if (session && session.access_token) {
            console.log('🔍 Attempting to restore Supabase session from localStorage...');
            const { data, error } = await window.supabaseClient.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token
            });
            if (!error && data?.user) {
              authUser = data.user;
              console.log('✅ Successfully restored Supabase session for user:', authUser.id);
            } else if (error) {
              console.warn('⚠️ Could not restore session:', error.message);
              // Session might be expired - try to refresh
              if (session.refresh_token) {
                console.log('🔍 Attempting to refresh session...');
                const { data: refreshData, error: refreshError } = await window.supabaseClient.auth.refreshSession({
                  refresh_token: session.refresh_token
                });
                if (!refreshError && refreshData?.user) {
                  authUser = refreshData.user;
                  console.log('✅ Successfully refreshed Supabase session');
                } else {
                  console.warn('⚠️ Could not refresh session:', refreshError?.message);
                }
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ Could not restore session from localStorage:', e);
        }
      }
      
      // If no session restored, try to get current user
      if (!authUser) {
        const result = await window.supabaseClient.auth.getUser();
        authUser = result.data?.user;
        authError = result.error;
        if (authUser) {
          console.log('✅ Found existing Supabase session for user:', authUser.id);
        }
      }
    } catch (e) {
      console.warn('⚠️ Error checking auth:', e);
      authError = e;
    }
    
    // If no Supabase auth but platform admin is logged in via localStorage, try to find and authenticate them
    const platformAdmin = JSON.parse(localStorage.getItem('platformAdmin') || 'null');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Base platform admin roles - will be expanded with database query results
    let platformAdminRoles = ['PlatformAdmin', 'PlatformOwner', 'Platform Admin', 'Platform Owner', 'Platform administrator', 'Platform owner'];
    const isPlatformAdminRole = platformAdmin || platformAdminRoles.includes(user.role);
    
    if (!authUser && isPlatformAdminRole) {
      console.warn('⚠️ No Supabase auth session found for platform admin');
      console.warn('⚠️ Platform admin from localStorage:', platformAdmin);
      console.warn('⚠️ User from localStorage:', user);
      
      // Try to find the platform admin user in the database by email or username
      const adminEmail = platformAdmin?.email || user.email || platformAdmin?.username;
      const adminUsername = platformAdmin?.username || user.username;
      
      console.log('🔍 Attempting to find platform admin user in database...');
      console.log('🔍 Searching by email:', adminEmail);
      console.log('🔍 Searching by username:', adminUsername);
      
      // First, let's check what platform admin roles actually exist in the database
      console.log('🔍 Checking what platform admin roles exist in database...');
      const { data: allPlatformAdmins, error: roleCheckError } = await window.supabaseClient
        .from('users')
        .select('role')
        .or('role.ilike.Platform%')
        .limit(10);
      
      if (!roleCheckError && allPlatformAdmins && allPlatformAdmins.length > 0) {
        const uniqueRoles = [...new Set(allPlatformAdmins.map(u => u.role))];
        console.log('✅ Found platform admin roles in database:', uniqueRoles);
        // Update platformAdminRoles array to include any found roles
        const foundRoles = uniqueRoles.filter(r => r && r.toLowerCase().includes('platform'));
        if (foundRoles.length > 0) {
          // Add any new roles that aren't already in the array
          foundRoles.forEach(role => {
            if (!platformAdminRoles.includes(role)) {
              platformAdminRoles.push(role);
            }
          });
          console.log('✅ Updated platformAdminRoles to include:', platformAdminRoles);
        }
      } else {
        console.warn('⚠️ Could not check platform admin roles:', roleCheckError?.message);
      }
      
      // Try to find user by email first
      let foundUser = null;
      if (adminEmail) {
        const { data: emailUser, error: emailError } = await window.supabaseClient
          .from('users')
          .select('id, username, role, auth_user_id, email')
          .or(`email.eq.${adminEmail},username.eq.${adminEmail}`)
          .maybeSingle();
        
        if (!emailError && emailUser) {
          foundUser = emailUser;
          console.log('✅ Found user by email:', foundUser);
          console.log('🔍 User role:', foundUser.role);
        } else if (emailError) {
          console.warn('⚠️ Error finding user by email:', emailError.message);
        }
      }
      
      // If not found by email, try username
      if (!foundUser && adminUsername) {
        const { data: usernameUser, error: usernameError } = await window.supabaseClient
          .from('users')
          .select('id, username, role, auth_user_id, email')
          .eq('username', adminUsername)
          .maybeSingle();
        
        if (!usernameError && usernameUser) {
          foundUser = usernameUser;
          console.log('✅ Found user by username:', foundUser);
          console.log('🔍 User role:', foundUser.role);
        } else if (usernameError) {
          console.warn('⚠️ Error finding user by username:', usernameError.message);
        }
      }
      
      // Use the platformAdminRoles variable declared at the top of the function
      if (foundUser && platformAdminRoles.includes(foundUser.role)) {
        console.log('✅ Platform admin user found in database:', foundUser);
        console.log('⚠️ However, RLS policy still requires auth.uid() to match auth_user_id');
        console.log('⚠️ Without a Supabase auth session, RLS will block the query');
        console.log('💡 SOLUTION: Platform admin needs to authenticate with Supabase');
        console.log('💡 The user record exists, but auth session is missing');
        
        // Check if there's a stored session we can restore
        const storedSession = localStorage.getItem('supabase_session');
        if (storedSession) {
          try {
            const session = JSON.parse(storedSession);
            if (session?.access_token) {
              console.log('🔍 Found stored session, attempting to restore...');
              const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token
              });
              
              if (!sessionError && sessionData?.user) {
                authUser = sessionData.user;
                console.log('✅ Successfully restored session from stored session');
              } else {
                console.warn('⚠️ Could not restore stored session:', sessionError?.message);
                // Try refreshing the session
                if (session.refresh_token) {
                  console.log('🔍 Attempting to refresh expired session...');
                  const { data: refreshData, error: refreshError } = await window.supabaseClient.auth.refreshSession({
                    refresh_token: session.refresh_token
                  });
                  if (!refreshError && refreshData?.user) {
                    authUser = refreshData.user;
                    console.log('✅ Successfully refreshed session');
                    // Update stored session
                    localStorage.setItem('supabase_session', JSON.stringify({
                      access_token: refreshData.session.access_token,
                      refresh_token: refreshData.session.refresh_token
                    }));
                  }
                }
              }
            }
          } catch (e) {
            console.warn('⚠️ Error parsing stored session:', e);
          }
        }
        
        // If still no session, try to get current session (might be set by Supabase client automatically)
        if (!authUser) {
          const { data: { user }, error: getUserError } = await window.supabaseClient.auth.getUser();
          if (!getUserError && user) {
            authUser = user;
            console.log('✅ Found existing Supabase session:', user.id);
          }
        }
        
        if (!authUser) {
          console.warn('⚠️ No Supabase auth session, but platform admin user found');
          console.log('💡 Attempting to fetch agreements via serverless function (bypasses RLS)...');
          
          // Use serverless function to bypass RLS for platform admins
          try {
            const functionResponse = await fetch('/.netlify/functions/get-platform-legal-agreements', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: foundUser.email || adminEmail,
                username: foundUser.username || adminUsername
              })
            });

            if (functionResponse.ok) {
              const functionData = await functionResponse.json();
              if (functionData.success && functionData.agreements) {
                console.log('✅ Successfully fetched agreements via serverless function:', functionData.agreements.length);
                return { success: true, agreements: functionData.agreements };
              } else {
                console.error('❌ Serverless function returned error:', functionData.error);
                return { 
                  success: false, 
                  error: functionData.error || 'Failed to fetch agreements via serverless function'
                };
              }
            } else {
              const errorData = await functionResponse.json().catch(() => ({ error: 'Unknown error' }));
              console.error('❌ Serverless function error:', errorData);
              return { 
                success: false, 
                error: errorData.error || 'Serverless function request failed'
              };
            }
          } catch (functionError) {
            console.error('❌ Error calling serverless function:', functionError);
            return { 
              success: false, 
              error: 'Failed to fetch agreements. Please log out and log back in via platform-login.html to authenticate with Supabase.',
              requiresReauth: true
            };
          }
        }
      } else {
        console.error('❌ Platform admin user not found in database');
        console.error('❌ Email searched:', adminEmail);
        console.error('❌ Username searched:', adminUsername);
        console.error('💡 SOLUTION: Platform admin needs to be created in the users table with role PlatformAdmin or PlatformOwner');
        
        return { 
          success: false, 
          error: 'Platform admin user not found in database. Please ensure your platform admin account exists in the users table with role PlatformAdmin or PlatformOwner.',
          requiresReauth: false
        };
      }
    } else if (authError) {
      console.error('❌ Error getting auth user:', authError);
      return { success: false, error: 'Authentication error: ' + authError.message };
    } else if (!authUser) {
      console.error('❌ No authenticated user found');
      return { success: false, error: 'User not authenticated. Please log in to view legal agreements.' };
    }
    
    if (authUser) {
      console.log('🔍 getAllLegalAgreements - Auth user:', authUser.id);
    } else {
      console.log('⚠️ getAllLegalAgreements - No auth user, but continuing for platform admin');
    }
    
    // Check what role the current user has in the users table
    let userData = null;
    let userError = null;
    
    if (authUser) {
      const result = await window.supabaseClient
        .from('users')
        .select('id, username, role, auth_user_id')
        .eq('auth_user_id', authUser.id)
        .single();
      
      userData = result.data;
      userError = result.error;
    } else {
      // No auth user - try to find user by username from localStorage
      const platformAdmin = JSON.parse(localStorage.getItem('platformAdmin') || 'null');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (platformAdmin?.username || user.username) {
        const username = platformAdmin?.username || user.username;
        console.log('🔍 Trying to find user by username:', username);
        
        const result = await window.supabaseClient
          .from('users')
          .select('id, username, role, auth_user_id')
          .eq('username', username)
          .maybeSingle();
        
        userData = result.data;
        userError = result.error;
        
        if (userData && userData.auth_user_id) {
          // Try to restore session using the auth_user_id
          console.log('🔍 Found user, attempting to restore session with auth_user_id:', userData.auth_user_id);
          // Note: We can't directly create a session, but we can try the query
        }
      }
    }
    
    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      // Don't fail completely - RLS policy will handle permissions
    }
    
    if (userData) {
      console.log('🔍 getAllLegalAgreements - User data:', {
        id: userData.id,
        username: userData.username,
        role: userData.role,
        auth_user_id: userData.auth_user_id
      });
      
      // Use the platformAdminRoles variable declared at the top of the function
      const isPlatformAdmin = platformAdminRoles.includes(userData.role);
      console.log('🔍 getAllLegalAgreements - Is PlatformAdmin?', isPlatformAdmin);
      console.log('🔍 User role:', userData.role);
      
      if (!isPlatformAdmin) {
        console.warn('⚠️ User is not a platform admin. Role:', userData.role);
        console.warn('⚠️ Expected one of:', platformAdminRoles);
        // Still try the query - RLS policy will filter results
      }
    } else {
      console.warn('⚠️ User data not found in users table.');
      const platformAdmin = JSON.parse(localStorage.getItem('platformAdmin') || 'null');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      console.warn('⚠️ Platform admin from localStorage:', platformAdmin);
      console.warn('⚠️ User from localStorage:', user);
      console.warn('⚠️ RLS policy may not work correctly without auth.uid().');
      console.warn('⚠️ Attempting query anyway - if it fails, user may need to re-authenticate.');
    }

    // Build query with proper error handling
    let query = window.supabaseClient
      .from('legal_agreements')
      .select(`
        *,
        users:user_id (
          username,
          first_name,
          last_name,
          role
        ),
        organizations:organization_id (
          name
        )
      `)
      .order('signed_at', { ascending: false });

    if (organizationId) {
      // Handle 'no-org' case - filter for null organization_id
      if (organizationId === 'no-org') {
        query = query.is('organization_id', null);
      } else {
      query = query.eq('organization_id', organizationId);
      }
    }

    const { data, error } = await query;

    if (error) {
      // Handle table not found error gracefully
      if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
        console.warn('⚠️ Legal agreements table not found. Migration may not have been run.');
        return { success: true, agreements: [], error: 'Table not found - migration required' };
      }
      
      // Handle RLS policy errors
      if (error.code === '42501' || error.message.includes('permission denied') || error.message.includes('policy')) {
        console.error('❌ RLS Policy Error - User may not have permission to view all agreements');
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return { 
          success: false, 
          error: 'Permission denied. Please verify your user role is one of: PlatformAdmin, PlatformOwner, Platform Admin, Platform Owner, Platform administrator, or Platform owner in the database.' 
        };
      }
      
      console.error('❌ Error fetching all legal agreements:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error hint:', error.hint);
      console.error('❌ Full error:', JSON.stringify(error, null, 2));
      
      return { success: false, error: error.message || 'Unknown error fetching legal agreements' };
    }

    console.log('✅ getAllLegalAgreements - Successfully fetched agreements:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('✅ getAllLegalAgreements - Sample agreement:', {
        id: data[0].id,
        agreement_type: data[0].agreement_type,
        user_name: data[0].user_name,
        organization_id: data[0].organization_id
      });
    } else {
      console.warn('⚠️ No agreements returned. This could mean:');
      console.warn('  1. No agreements exist in the database');
      console.warn('  2. RLS policy is filtering out all results');
        console.warn('  3. User role does not match platform admin roles (PlatformAdmin, PlatformOwner, Platform Admin, Platform Owner, Platform administrator, Platform owner)');
    }

    return { success: true, agreements: data || [] };

  } catch (error) {
    console.error('❌ Exception fetching all legal agreements:', error);
    console.error('❌ Exception stack:', error.stack);
    return { 
      success: false, 
      error: error.message || 'Unknown error fetching legal agreements' 
    };
  }
}

// Export functions
if (typeof window !== 'undefined') {
  window.saveLegalAgreement = saveLegalAgreement;
  window.getUserLegalAgreements = getUserLegalAgreements;
  window.getAllLegalAgreements = getAllLegalAgreements;
}

console.log('✅ Legal agreements module loaded');

