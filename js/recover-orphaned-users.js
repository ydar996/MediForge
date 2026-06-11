/**
 * Recovery Tool for Orphaned Auth Users
 * This script helps recover users who have Auth accounts but no profiles
 */

/**
 * Recover an orphaned user by creating their profile
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {object} userData - User registration data
 * @returns {Promise<{success: boolean, error?: string, recovered?: boolean}>}
 */
async function recoverOrphanedUser(email, password, userData) {
  try {
    if (!window.supabaseClient) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    console.log('🔧 Attempting to recover orphaned user:', email);

    // Step 1: Sign in to get Auth user ID
    const { data: signInData, error: signInError } = await window.supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (signInError || !signInData?.user) {
      console.error('❌ Cannot sign in:', signInError);
      return { 
        success: false, 
        error: `Cannot sign in: ${signInError?.message || 'Unknown error'}. Please verify credentials or contact support.` 
      };
    }

    const authUserId = signInData.user.id;
    console.log('✅ Signed in successfully. Auth User ID:', authUserId);

    // Step 2: Wait a moment for session to be fully established
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Verify session is active
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
      return { 
        success: false, 
        error: 'Session not established. Please try again.' 
      };
    }
    console.log('✅ Session verified');

    // Step 4: Check if profile already exists (with better error handling)
    let existingProfile = null;
    try {
      const { data, error } = await window.supabaseClient
        .from('users')
        .select('id, username, email')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (expected)
        console.warn('⚠️ Error checking profile (may be RLS):', error);
        // Continue anyway - might be RLS preventing SELECT
      } else if (data) {
        existingProfile = data;
        console.log('✅ Profile already exists:', data);
        return { 
          success: false, 
          error: 'User profile already exists. Please log in instead.' 
        };
      }
    } catch (checkError) {
      console.warn('⚠️ Exception checking profile:', checkError);
      // Continue - might be able to create profile even if SELECT is blocked
    }

    // Step 5: Create the missing profile
    console.log('📝 Creating missing profile...');
    
    const insertData = {
      auth_user_id: authUserId,
      username: userData.username,
      first_name: userData.firstName,
      last_name: userData.lastName,
      gender: userData.gender || 'Male',
      role: userData.role,
      organization_id: userData.organizationId
    };

    // Add email if column exists
    if (email) {
      insertData.email = email;
    }

    // Add license number if provided
    if (userData.medicalLicenseNumber) {
      insertData.license_number = userData.medicalLicenseNumber;
    }

    // Try with email first, retry without if needed
    let includeEmail = true;
    let profileData = null;
    let profileError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const insertPayload = includeEmail ? insertData : { ...insertData };
        if (!includeEmail) {
          delete insertPayload.email;
        }

        const { data, error } = await window.supabaseClient
          .from('users')
          .insert(insertPayload)
          .select()
          .single();

        if (!error && data) {
          profileData = data;
          profileError = null;
          console.log('✅ Profile created successfully on attempt', attempt);
          break;
        } else {
          profileError = error;
          console.warn(`⚠️ Profile creation attempt ${attempt} failed:`, error);

          // If error is about missing email column, retry without email
          if (error.message && includeEmail && (
            error.message.includes("email") && (
              error.message.includes("schema cache") || 
              error.message.includes("column") ||
              error.message.includes("Could not find")
            )
          )) {
            console.log('⚠️ Email column issue detected, retrying without email...');
            includeEmail = false;
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue;
            }
          }

          // If it's a duplicate/unique constraint error
          if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
            // Check if it's username or email conflict
            if (error.message?.includes('username')) {
              return { 
                success: false, 
                error: `Username "${userData.username}" is already taken by another user. Please choose a different username.` 
              };
            } else if (error.message?.includes('email')) {
              return { 
                success: false, 
                error: `Email "${email}" is already registered to another user. Please use a different email or contact support.` 
              };
            }
            return { 
              success: false, 
              error: 'A user with these details already exists. Please contact support.' 
            };
          }

          // If it's a foreign key error (organization not found)
          if (error.code === '23503' || error.message?.includes('foreign key')) {
            return { 
              success: false, 
              error: 'Organization not found. Please verify your organization code and try again.' 
            };
          }

          // If it's an RLS error
          if (error.message?.includes('violates row-level security') || error.message?.includes('RLS')) {
            return { 
              success: false, 
              error: 'Permission denied. The RLS policy may be blocking profile creation. Please contact support.' 
            };
          }

          // Network errors - retry
          if (attempt < maxRetries && (
            error.message?.includes('network') || 
            error.message?.includes('timeout') ||
            error.message?.includes('fetch') ||
            error.code === 'PGRST301' ||
            error.code === 'PGRST204'
          )) {
            console.log(`Retrying in ${1000 * attempt}ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          // Non-retryable error
          break;
        }
      } catch (insertException) {
        profileError = insertException;
        console.error(`Exception on attempt ${attempt}:`, insertException);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        break;
      }
    }

    if (profileError || !profileData) {
      console.error('❌ Failed to create profile after retries:', profileError);
      return { 
        success: false, 
        error: `Failed to create profile: ${profileError?.message || 'Unknown error'}. Please contact support with this error message.` 
      };
    }

    console.log('✅ User profile recovered successfully!');
    return { 
      success: true, 
      recovered: true,
      user: profileData 
    };

  } catch (error) {
    console.error('❌ Recovery error:', error);
    return { 
      success: false, 
      error: `Recovery failed: ${error.message || 'Unknown error'}. Please contact support.` 
    };
  }
}

// Export for use in registration flow
if (typeof window !== 'undefined') {
  window.recoverOrphanedUser = recoverOrphanedUser;
}






