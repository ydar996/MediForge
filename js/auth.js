// Purpose: Handles login, registration, and profile editing. Stores users in localStorage as an array of objects (e.g., {username, password (encoded), role, org}). Uses base64 encoding for passwords (basic, not secure).
// Also manages organization data separately to avoid duplication across users from the same organization.

// Organization Data Management Functions
function getOrganizations() {
  return JSON.parse(localStorage.getItem("organizations") || "{}");
}

function saveOrganizations(organizations) {
  localStorage.setItem("organizations", JSON.stringify(organizations));
}

function getOrganizationData(orgName) {
  const organizations = getOrganizations();
  return organizations[orgName] || null;
}

function saveOrganizationData(orgName, orgData) {
  const organizations = getOrganizations();
  organizations[orgName] = {
    name: orgName,
    addressLine1: orgData.addressLine1 || "",
    addressLine2: orgData.addressLine2 || "",
    city: orgData.city || "",
    state: orgData.state || "",
    country: orgData.country || "",
    phone: orgData.phone || "",
    afterHoursPhone: orgData.afterHoursPhone || "",
    lastUpdated: new Date().toISOString(),
    updatedBy: orgData.updatedBy || ""
  };
  saveOrganizations(organizations);
}

function updateOrganizationData(orgName, orgData, updatedBy) {
  const organizations = getOrganizations();
  if (organizations[orgName]) {
    organizations[orgName] = {
      ...organizations[orgName],
      addressLine1: orgData.addressLine1 || organizations[orgName].addressLine1,
      addressLine2: orgData.addressLine2 || organizations[orgName].addressLine2,
      city: orgData.city || organizations[orgName].city,
      state: orgData.state || organizations[orgName].state,
      country: orgData.country || organizations[orgName].country,
      phone: orgData.phone || organizations[orgName].phone,
      afterHoursPhone: orgData.afterHoursPhone || organizations[orgName].afterHoursPhone,
      lastUpdated: new Date().toISOString(),
      updatedBy: updatedBy
    };
    saveOrganizations(organizations);
  }
}

function migrateOrganizationData(users) {
  const organizations = getOrganizations();
  let needsMigration = false;
  
  // Check if we need to migrate (if organizations storage is empty but users have org data)
  const hasOrgData = users.some(user => 
    user.orgAddressLine1 || user.orgAddressLine2 || user.orgCity || 
    user.orgState || user.orgCountry || user.orgPhone || user.afterHoursPhone
  );
  
  if (hasOrgData && Object.keys(organizations).length === 0) {
    console.log("Migrating organization data from users to separate storage...");
    
    // Group users by organization and extract organization data
    const orgGroups = {};
    users.forEach(user => {
      if (!orgGroups[user.org]) {
        orgGroups[user.org] = [];
      }
      orgGroups[user.org].push(user);
    });
    
    // Create organization data from the first user with complete data in each org
    Object.keys(orgGroups).forEach(orgName => {
      const orgUsers = orgGroups[orgName];
      const userWithData = orgUsers.find(user => 
        user.orgAddressLine1 || user.orgAddressLine2 || user.orgCity || 
        user.orgState || user.orgCountry || user.orgPhone || user.afterHoursPhone
      );
      
      if (userWithData) {
        saveOrganizationData(orgName, {
          addressLine1: userWithData.orgAddressLine1 || "",
          addressLine2: userWithData.orgAddressLine2 || "",
          city: userWithData.orgCity || "",
          state: userWithData.orgState || "",
          country: userWithData.orgCountry || "",
          phone: userWithData.orgPhone || "",
          afterHoursPhone: userWithData.afterHoursPhone || "",
          updatedBy: userWithData.username
        });
        needsMigration = true;
      }
    });
    
    if (needsMigration) {
      console.log("Organization data migration completed.");
    }
  }
}

// Auto-create or restore users on load
(function initializeUsers() {
  const defaultAdmin = {
    firstName: "Admin",
    lastName: "User",
    username: "admin",
    password: btoa("pass123"),
    role: "Doctor",
    org: "Unknown Organization",
    medicalLicenseNumber: "",
    gender: "Male",
    orgAddressLine1: "",
    orgAddressLine2: "",
    orgCity: "",
    orgState: "",
    orgCountry: "",
    orgPhone: "",
    afterHoursPhone: ""
  };

  // If missing entirely, seed with default admin
  if (!localStorage.getItem("users")) {
    localStorage.setItem("users", JSON.stringify([defaultAdmin]));
    localStorage.setItem("users_backup", JSON.stringify([defaultAdmin]));
    return;
  }
  
  // Migrate existing users to add phone fields and gender field
  let users = JSON.parse(localStorage.getItem("users") || "[]");
  let needsUpdate = false;
  
  users.forEach(user => {
    if (user.orgPhone === undefined) {
      user.orgPhone = "";
      needsUpdate = true;
    }
    if (user.afterHoursPhone === undefined) {
      user.afterHoursPhone = "";
      needsUpdate = true;
    }
    // Force gender to Male if it's missing, null, empty, or anything other than Male/Female
    if (!user.gender || (user.gender !== "Male" && user.gender !== "Female")) {
      user.gender = "Male"; // Default to Male for all existing users
      needsUpdate = true;
      console.log(`Set gender to Male for user: ${user.username}`);
    }
  });
  
  if (needsUpdate) {
    localStorage.setItem("users", JSON.stringify(users));
    console.log("Migrated users to include gender field (defaulted to Male for existing users)");
  }
  
  // Migrate existing organization data from users to separate organization storage
  migrateOrganizationData(users);

  // If present but empty or invalid, try restore from backup
  try {
    users = JSON.parse(localStorage.getItem("users") || "[]");
    if (!Array.isArray(users)) users = [];
  } catch (_) {
    users = [];
  }

  if (users.length === 0) {
    try {
      const backup = JSON.parse(localStorage.getItem("users_backup") || "[]");
      if (Array.isArray(backup) && backup.length > 0) {
        localStorage.setItem("users", JSON.stringify(backup));
        return;
      }
    } catch (_) {
      // ignore
    }
    // Ensure default admin exists if nothing to restore
    localStorage.setItem("users", JSON.stringify([defaultAdmin]));
    localStorage.setItem("users_backup", JSON.stringify([defaultAdmin]));
  } else {
    // Keep a mirrored backup of current users
    localStorage.setItem("users_backup", JSON.stringify(users));
    
    // Migrate existing users to include firstName and lastName if missing
    let needsMigration = false;
    users.forEach(user => {
      if (!user.firstName || !user.lastName) {
        // Generate firstName and lastName from username if missing
        const usernameParts = user.username.split('.');
        if (usernameParts.length >= 2) {
          user.firstName = usernameParts[0].charAt(0).toUpperCase() + usernameParts[0].slice(1);
          user.lastName = usernameParts[1].charAt(0).toUpperCase() + usernameParts[1].slice(1);
        } else {
          user.firstName = user.username.charAt(0).toUpperCase() + user.username.slice(1);
          user.lastName = "User";
        }
        needsMigration = true;
      }
    });
    
    if (needsMigration) {
      persistUsers(users);
      console.log("Migrated existing users to include firstName and lastName");
    }
  }
})();

// Helper to persist users to both primary and backup keys
function persistUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
  localStorage.setItem("users_backup", JSON.stringify(users));
}

// Registration logic (for register.html)
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async function(e) {
    e.preventDefault();  // Stops page refresh
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;
    const org = document.getElementById("org").value;
    const medicalLicenseNumber = document.getElementById("medicalLicenseNumber").value;
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      alert('Password does not meet requirements:\n\n' + passwordValidation.errors.join('\n'));
      return;
    }
    const orgAddressLine1 = document.getElementById("orgAddressLine1").value;
    const orgAddressLine2 = document.getElementById("orgAddressLine2").value;
    const orgCity = document.getElementById("orgCity").value;
    const orgState = document.getElementById("orgState").value;
    const orgCountry = document.getElementById("orgCountry").value;
    const orgPhone = document.getElementById("orgPhone").value;
    const afterHoursPhone = document.getElementById("afterHoursPhone").value;

    // Handle "Other" role specification
    let finalRole = role;
    if (role === "Other") {
      const otherRoleSpec = document.getElementById("new-org-other-role").value.trim();
      if (!otherRoleSpec) {
        alert("Please specify your exact role when selecting 'Other'.");
        return;
      }
      finalRole = `Other (${otherRoleSpec})`;
    }

    // Validate Medical License Number for roles that require it
    const rolesRequiringLicense = ["Doctor", "Nurse", "Physician Assistant", "Pharmacist", "Optometrist", "Medical Lab Scientist"];
    if (rolesRequiringLicense.includes(role) && !medicalLicenseNumber) {
      if (role === "Doctor") {
        alert("Medical License Number is required for Doctors.");
      } else if (role === "Nurse") {
        alert("Medical License Number is required for Nurses.");
      } else if (role === "Physician Assistant") {
        alert("Medical License Number is required for Physician Assistants.");
      } else if (role === "Pharmacist") {
        alert("Medical License Number is required for Pharmacists.");
      } else if (role === "Optometrist") {
        alert("Medical License Number is required for Optometrists.");
      } else if (role === "Medical Lab Scientist") {
        alert("Medical License Number is required for Medical Lab Scientists.");
      }
      return;
    }

    const users = JSON.parse(localStorage.getItem("users") || "[]");  // Get existing users

    // Check if username already exists
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      alert("Username already taken. Choose another.");
      return;
    }

    // Check if organization data already exists
    const existingOrgData = getOrganizationData(org);
    
    // If organization data exists, use it; otherwise save the new organization data
    if (existingOrgData) {
      // Use existing organization data, but allow updates if user provided new data
      if (orgAddressLine1 || orgAddressLine2 || orgCity || orgState || orgCountry || orgPhone || afterHoursPhone) {
        // User provided some organization data, update it
        updateOrganizationData(org, {
          addressLine1: orgAddressLine1,
          addressLine2: orgAddressLine2,
          city: orgCity,
          state: orgState,
          country: orgCountry,
          phone: orgPhone,
          afterHoursPhone: afterHoursPhone
        }, username);
        console.log("Updated existing organization data for:", org);
      } else {
        console.log("Using existing organization data for:", org);
      }
    } else {
      // Save new organization data (only if required fields are provided)
      if (orgAddressLine1 && orgCity && orgState && orgCountry) {
        saveOrganizationData(org, {
          addressLine1: orgAddressLine1,
          addressLine2: orgAddressLine2,
          city: orgCity,
          state: orgState,
          country: orgCountry,
          phone: orgPhone,
          afterHoursPhone: afterHoursPhone,
          updatedBy: username
        });
        console.log("Created new organization data for:", org);
      } else {
        // Create minimal organization data for new org
        saveOrganizationData(org, {
          addressLine1: orgAddressLine1 || "",
          addressLine2: orgAddressLine2 || "",
          city: orgCity || "",
          state: orgState || "",
          country: orgCountry || "",
          phone: orgPhone || "",
          afterHoursPhone: afterHoursPhone || "",
          updatedBy: username
        });
        console.log("Created minimal organization data for:", org);
      }
    }

    // HYBRID ARCHITECTURE: SUPABASE-FIRST
    // Step 1: Try to save to Supabase FIRST
    let supabaseSuccess = false;
    let supabaseError = null;
    
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient && typeof window.registerWithSupabase === 'function') {
      try {
        // Get organization ID from organization name
        let orgId = null;
        const { data: orgData, error: orgError } = await window.supabaseClient
          .from('organizations')
          .select('id')
          .eq('name', org)
          .maybeSingle();
        
        if (orgError) {
          console.warn('⚠️ Could not find organization in Supabase:', orgError);
        } else if (orgData && orgData.id) {
          orgId = orgData.id;
        }
        
        if (!orgId) {
          throw new Error(`Organization "${org}" not found in Supabase. Please ensure the organization exists.`);
        }
        
        // Register user in Supabase
        const registrationResult = await window.registerWithSupabase({
          username: username,
          password: password,  // Plain password - registerWithSupabase will handle it
          firstName: firstName,
          lastName: lastName,
          gender: gender || 'Male',
          role: finalRole,
          organizationId: orgId,
          medicalLicenseNumber: medicalLicenseNumber || ''
        });
        
        if (registrationResult.success) {
          supabaseSuccess = true;
          console.log('✅ User registered successfully in Supabase');
        } else {
          supabaseError = registrationResult.error;
          console.error('❌ Supabase registration failed:', supabaseError);
          throw new Error(supabaseError);
        }
      } catch (err) {
        console.error('❌ CRITICAL: Supabase registration exception:', err);
        supabaseError = err.message || err;
        // Continue to localStorage fallback
      }
    } else {
      console.warn('⚠️ Supabase client or registerWithSupabase not available - saving to localStorage only');
    }
    
    // Hash the password using SHA-256 for localStorage
    const hashedPassword = await hashPassword(password);
    
    // Step 2: Save to localStorage (as cache if Supabase succeeded, or as fallback if it failed)
    users.push({
      firstName: firstName,
      lastName: lastName,
      username: username,
      password: hashedPassword,  // SHA-256 hashed password
      passwordType: 'sha256',  // Mark as using new hashing
      role: finalRole,
      org: org,
      medicalLicenseNumber: medicalLicenseNumber || "",
      syncedToSupabase: supabaseSuccess  // Track sync status
    });

    persistUsers(users);  // Save updated users
    
    // Log the registration
    logAuditEvent('user_registered', { 
      user: username, 
      role: role, 
      org: org,
      supabase_success: supabaseSuccess,
      supabase_error: supabaseError
    });
    
    if (supabaseSuccess) {
      alert("✅ Registration successful! User account created and synced to cloud. You can now login from any device.");
    } else {
      alert(`⚠️ Registration saved locally, but cloud sync failed.\n\nError: ${supabaseError || 'Unknown error'}\n\nYou can login on this device, but the account may not be available on other devices. Please contact support.`);
    }
    
    window.location.href = "/login";  // Redirect to login
  });
}


const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async function(e) {
    e.preventDefault();  // Stops page refresh
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    console.log('Login attempt for user:', username);
    
    // Check if validateLoginCredentials exists
    if (typeof validateLoginCredentials === 'undefined') {
      console.error('ERROR: validateLoginCredentials function not found! security.js may not be loaded.');
      alert('System error: Security module not loaded. Please refresh the page.');
      return;
    }

    // Use enhanced validation (supports both SHA-256 and legacy Base64)
    const result = await validateLoginCredentials(username, password);
    
    console.log('Login result:', result);
    
    if (result.success) {
      const user = result.user;
      
      // Get organization data for the logged-in user
      let orgData = getOrganizationData(user.org);
      
      // CRITICAL FIX: If organization data doesn't have address, load from Supabase
      if (user.org && (!orgData || !orgData.addressLine1)) {
        try {
          // Wait for Supabase client to be available
          let supabase = window.supabaseClient;
          let attempts = 0;
          while (!supabase && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            supabase = window.supabaseClient;
            attempts++;
          }
          
          if (supabase) {
              const { data: supabaseOrg, error: orgError } = await supabase
                .from('organizations')
                .select('address_line1, address_line2, city, state, country, phone, after_hours_phone')
                .eq('name', user.org)
                .single();
              
              if (!orgError && supabaseOrg) {
                // Map Supabase snake_case to camelCase
                const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
                organizations[user.org] = {
                  ...organizations[user.org],
                  addressLine1: supabaseOrg.address_line1 || '',
                  addressLine2: supabaseOrg.address_line2 || '',
                  city: supabaseOrg.city || '',
                  state: supabaseOrg.state || '',
                  country: supabaseOrg.country || '',
                  phone: supabaseOrg.phone || '',
                  afterHoursPhone: supabaseOrg.after_hours_phone || ''
                };
                localStorage.setItem('organizations', JSON.stringify(organizations));
                orgData = organizations[user.org];
                console.log('✅ Loaded organization address from Supabase during login');
              }
            }
          }
        } catch (error) {
          console.warn('Could not load organization address during login:', error);
        }
      }
      
      // Save logged-in user with organization data
      localStorage.setItem("user", JSON.stringify({ 
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        gender: user.gender || "Male",
        role: user.role, 
        org: user.org,
        medicalLicenseNumber: user.medicalLicenseNumber,
        // Include organization data from shared storage
        orgAddressLine1: orgData?.addressLine1 || "",
        orgAddressLine2: orgData?.addressLine2 || "",
        orgCity: orgData?.city || "",
        orgState: orgData?.state || "",
        orgCountry: orgData?.country || "",
        orgPhone: orgData?.phone || "",
        afterHoursPhone: orgData?.afterHoursPhone || ""
      }));
      
      // Update activity timestamp for session management
      localStorage.setItem('lastActivity', Date.now().toString());
      
      // Ensure login is logged (backup in case validateLoginCredentials didn't log it)
      if (typeof logAuditEvent !== 'undefined') {
        console.log('Logging login event for:', username);
        logAuditEvent('user_login', { 
          username: username, 
          role: user.role,
          org: user.org,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn('WARNING: logAuditEvent function not available');
      }
      
      if (result.migrated) {
        alert('Login successful! Your password has been upgraded to enhanced security.');
      }
      
      window.location.href = "/dashboard";  // Go to dashboard
    } else {
      alert(result.error || "Wrong username or password. Try again or register.");
    }
  });
}

// Edit profile logic (for edit-profile.html)
const editProfileForm = document.getElementById("edit-profile-form");
if (editProfileForm) {
  const currentUser = JSON.parse(localStorage.getItem("user"));
  if (currentUser) {
    document.getElementById("firstName").value = currentUser.firstName || '';
    document.getElementById("lastName").value = currentUser.lastName || '';
    document.getElementById("username").value = currentUser.username;
    document.getElementById("gender").value = currentUser.gender || 'Male';  // Default to Male if not set
    document.getElementById("org").value = currentUser.org || '';
    document.getElementById("role").value = currentUser.role || 'Doctor';  // Default to first option if not set
    document.getElementById("medicalLicenseNumber").value = currentUser.medicalLicenseNumber || '';
    document.getElementById("orgAddressLine1").value = currentUser.orgAddressLine1 || '';
    document.getElementById("orgAddressLine2").value = currentUser.orgAddressLine2 || '';
    document.getElementById("orgCity").value = currentUser.orgCity || '';
    document.getElementById("orgState").value = currentUser.orgState || '';
    document.getElementById("orgCountry").value = currentUser.orgCountry || '';
    document.getElementById("orgPhone").value = currentUser.orgPhone || '';
    document.getElementById("afterHoursPhone").value = currentUser.afterHoursPhone || '';

    // Trigger toggle for Medical License based on current role
    toggleMedicalLicense(currentUser.role);
  } else {
    alert("No logged-in user found. Redirecting to login.");
    window.location.href = "/login";
  }

  editProfileForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const newFirstName = document.getElementById("firstName").value.trim();
    const newLastName = document.getElementById("lastName").value.trim();
    const newUsername = document.getElementById("username").value;
    const gender = document.getElementById("gender").value;
    const oldPassword = document.getElementById("old-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const org = document.getElementById("org").value;
    const role = document.getElementById("role").value;
    const medicalLicenseNumber = document.getElementById("medicalLicenseNumber").value;
    const orgAddressLine1 = document.getElementById("orgAddressLine1").value;
    const orgAddressLine2 = document.getElementById("orgAddressLine2").value;
    const orgCity = document.getElementById("orgCity").value;
    const orgState = document.getElementById("orgState").value;
    const orgCountry = document.getElementById("orgCountry").value;
    const orgPhone = document.getElementById("orgPhone").value;
    const afterHoursPhone = document.getElementById("afterHoursPhone").value;

    // Handle "Other" role specification
    let finalRole = role;
    if (role === "Other") {
      const otherRoleSpec = document.getElementById("other-role").value.trim();
      if (!otherRoleSpec) {
        alert("Please specify your exact role when selecting 'Other'.");
        return;
      }
      finalRole = `Other (${otherRoleSpec})`;
    }

    // Validate Medical License Number for roles that require it
    const rolesRequiringLicense = ["Doctor", "Nurse", "Physician Assistant", "Pharmacist", "Optometrist", "Medical Lab Scientist"];
    if (rolesRequiringLicense.includes(role) && !medicalLicenseNumber) {
      if (role === "Doctor") {
        alert("Medical License Number is required for Doctors.");
      } else if (role === "Nurse") {
        alert("Medical License Number is required for Nurses.");
      } else if (role === "Physician Assistant") {
        alert("Medical License Number is required for Physician Assistants.");
      } else if (role === "Pharmacist") {
        alert("Medical License Number is required for Pharmacists.");
      } else if (role === "Optometrist") {
        alert("Medical License Number is required for Optometrists.");
      } else if (role === "Medical Lab Scientist") {
        alert("Medical License Number is required for Medical Lab Scientists.");
      }
      return;
    }

    // Handle both localStorage users and Supabase users
    let userIndex = -1;
    let users = JSON.parse(localStorage.getItem("users") || "[]");
    
    // First, try to find user in localStorage users array
    userIndex = users.findIndex(u => u.username === currentUser.username);
    
    // If not found and this is a Supabase user, create a local entry for editing
    if (userIndex === -1 && currentUser.authUserId) {
      console.log("Supabase user detected, creating local entry for profile editing");
      
      // Create a local user entry from the Supabase user data
      const newUser = {
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        username: currentUser.username,
        password: '', // Supabase users don't have local passwords
        passwordType: 'supabase', // Mark as Supabase user
        role: currentUser.role || 'Nurse',
        org: currentUser.org || currentUser.organization || '',
        medicalLicenseNumber: currentUser.medicalLicenseNumber || '',
        gender: currentUser.gender || 'Male',
        authUserId: currentUser.authUserId,
        email: currentUser.email || '',
        orgAddressLine1: currentUser.orgAddressLine1 || '',
        orgAddressLine2: currentUser.orgAddressLine2 || '',
        orgCity: currentUser.orgCity || '',
        orgState: currentUser.orgState || '',
        orgCountry: currentUser.orgCountry || '',
        orgPhone: currentUser.orgPhone || '',
        afterHoursPhone: currentUser.afterHoursPhone || ''
      };
      
      users.push(newUser);
      userIndex = users.length - 1;
      persistUsers(users); // Save the new user entry
      console.log("Created local user entry for Supabase user:", currentUser.username);
    }
    
    if (userIndex === -1) {
      alert("User not found in local storage. Please try logging out and back in.");
      return;
    }

    const user = users[userIndex];

    // Only validate old password if user is changing password
    if (newPassword && newPassword.trim() !== '') {
      // For Supabase users, we can't validate old passwords locally
      if (user.passwordType === 'supabase') {
        alert("Password changes for online data repository-authenticated users need to be done through the login system. Please contact your administrator.");
        return;
      }
      
      if (!oldPassword || oldPassword.trim() === '') {
        alert("Current password is required when changing to a new password.");
        return;
      }
      
      // Validate old password (support both SHA-256 and legacy Base64)
      let oldPasswordValid = false;
      if (user.passwordType === 'sha256') {
        const hashedOldPassword = await hashPassword(oldPassword);
        oldPasswordValid = hashedOldPassword === user.password;
      } else {
        oldPasswordValid = btoa(oldPassword) === user.password || oldPassword === user.password;
      }
      
      if (!oldPasswordValid) {
        alert("Current password is incorrect.");
        logAuditEvent('password_change_failed', { user: user.username, reason: 'incorrect_old_password' });
        return;
      }
    }

    // Validate new password if provided
    if (newPassword && newPassword.trim() !== '') {
      if (newPassword !== confirmPassword) {
        alert("New passwords do not match.");
        return;
      }
      
      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        alert('New password does not meet requirements:\n\n' + passwordValidation.errors.join('\n'));
        return;
      }
      
      // Hash the new password with SHA-256
      user.password = await hashPassword(newPassword);
      user.passwordType = 'sha256';
      
      logAuditEvent('password_changed', { user: user.username });
    }

    // Update username if changed (check uniqueness)
    if (newUsername !== user.username) {
      const existingUser = users.find(u => u.username === newUsername);
      if (existingUser) {
        alert("Username already taken. Choose another.");
        return;
      }
      user.username = newUsername;
    }

    // Update user fields
    console.log('🔧 Updating user fields:', {
      firstName: newFirstName,
      lastName: newLastName,
      gender: gender,
      org: org,
      role: finalRole,
      medicalLicenseNumber: medicalLicenseNumber || ""
    });
    
    user.firstName = newFirstName;
    user.lastName = newLastName;
    user.gender = gender;
    user.org = org;
    user.role = finalRole;
    user.medicalLicenseNumber = medicalLicenseNumber || "";
    
    // Update organization data (shared across all users in the organization)
    updateOrganizationData(org, {
      addressLine1: orgAddressLine1,
      addressLine2: orgAddressLine2,
      city: orgCity,
      state: orgState,
      country: orgCountry,
      phone: orgPhone,
      afterHoursPhone: afterHoursPhone
    }, newUsername);

    // Save updated users
    persistUsers(users);
    console.log('✅ Users array updated and persisted');

    // Get updated organization data and update logged-in user in localStorage
    const updatedOrgData = getOrganizationData(org);
    console.log('🔧 Updated organization data:', updatedOrgData);
    
    const updatedUserObject = {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      gender: user.gender,
      role: user.role, 
      org: user.org,
      medicalLicenseNumber: user.medicalLicenseNumber,
      // Include updated organization data from shared storage
      orgAddressLine1: updatedOrgData?.addressLine1 || "",
      orgAddressLine2: updatedOrgData?.addressLine2 || "",
      orgCity: updatedOrgData?.city || "",
      orgState: updatedOrgData?.state || "",
      orgCountry: updatedOrgData?.country || "",
      orgPhone: updatedOrgData?.phone || "",
      afterHoursPhone: updatedOrgData?.afterHoursPhone || ""
    };
    
    // Preserve Supabase-specific fields if they exist
    if (user.authUserId) {
      updatedUserObject.authUserId = user.authUserId;
      updatedUserObject.email = user.email;
    }
    
    console.log('🔧 Saving updated user object to localStorage:', updatedUserObject);
    localStorage.setItem("user", JSON.stringify(updatedUserObject));
    console.log('✅ User object saved to localStorage');

    // Refresh session token after profile update to prevent session expiry
    if (typeof SessionSecurity !== 'undefined' && SessionSecurity.refreshSession) {
      SessionSecurity.refreshSession();
      console.log('✅ Session token refreshed after profile update');
    }

    // Audit log: User profile updated
    if (typeof logAuditEvent !== 'undefined') {
      logAuditEvent('user_profile_updated', {
        username: user.username,
        role: user.role,
        org: user.org,
        passwordChanged: !!newPassword
      });
    }

    alert("Profile updated successfully!");
    window.location.href = "/dashboard";
  });
}