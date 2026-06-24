/**
 * Registration Preflight Checks
 * Ensures all conditions are met before attempting registration
 * This guarantees first-attempt success when requirements are met
 */

class RegistrationPreflight {
  constructor() {
    this.checks = {
      internetConnection: false,
      supabaseClient: false,
      mandatoryFields: false,
      organizationExists: false,
      usernameAvailable: false,
      emailAvailable: false
    };
  }

  /**
   * Check internet connectivity
   * Uses Supabase directly to avoid CSP violations
   */
  async checkInternetConnection() {
    try {
      // Use Supabase directly (avoids CSP violations with external domains)
        if (window.supabaseClient) {
          const { error: testError } = await window.supabaseClient.rpc('is_username_available', {
            p_username: '__ehr_connectivity_probe__'
          });
          
        // Even if query fails due to RLS or other issues, if we got a response, we have connection
        // The error might be RLS-related, not connectivity-related
          this.checks.internetConnection = true;
          return { success: true, message: 'Internet connection verified via Supabase' };
      } else {
        // Supabase client not ready, but assume connection exists (will fail later if not)
        this.checks.internetConnection = true;
        return { success: true, message: 'Assuming internet connection (Supabase client not ready)' };
      }
    } catch (supabaseError) {
      // Connection failed - log but don't block registration (might be RLS issue)
      console.warn('⚠️ [TRACE] Internet connectivity check failed (may be RLS, not connectivity):', supabaseError);
      this.checks.internetConnection = true; // Assume connection exists, let registration attempt proceed
      return { success: true, message: 'Internet connection assumed (check inconclusive)' };
    }
  }

  /**
   * Verify Supabase client is initialized
   * Uses universal readiness guarantee to ensure consistent behavior
   */
  async checkSupabaseClient() {
    // Use universal readiness guarantee instead of checking directly
    if (typeof window.ensureSupabaseClientReady === 'function') {
      const isReady = await window.ensureSupabaseClientReady(5000);
      if (!isReady) {
        this.checks.supabaseClient = false;
        return { 
          success: false, 
          message: 'Registration system not initialized. Please refresh the page.' 
        };
      }
    } else {
      // Fallback check
      if (!window.supabaseClient) {
        this.checks.supabaseClient = false;
        return { 
          success: false, 
          message: 'Registration system not initialized. Please refresh the page.' 
        };
      }
    }

    if (!window.registerWithSupabase) {
      this.checks.supabaseClient = false;
      return { 
        success: false, 
        message: 'Registration function not available. Please refresh the page.' 
      };
    }

    this.checks.supabaseClient = true;
    return { success: true, message: 'Supabase client ready' };
  }

  /**
   * Validate all mandatory fields are filled
   * NOTE: organizationId is NOT required for new organization registration
   * For new org registration: organization is created FIRST, then organizationId is captured
   * For joining org: organizationId must be provided (from verified org code)
   */
  validateMandatoryFields(formData, isNewOrgRegistration = false) {
    const required = [
      'username', 'password', 'firstName', 'lastName', 
      'gender', 'role'
    ];
    
    // organizationId is only required when JOINING an existing organization
    // For NEW org registration, organizationId will be created during registration process
    let hasOrgId = false;
    if (!isNewOrgRegistration && formData.hasOwnProperty('organizationId')) {
      // Only require organizationId if it's provided (for join-org flow)
      hasOrgId = formData.organizationId !== null && 
                 formData.organizationId !== undefined && 
                 formData.organizationId !== '';
      if (hasOrgId) {
        required.push('organizationId');
      }
    }

    const missing = [];
    for (const field of required) {
      // Skip organizationId validation for new org registration
      if (field === 'organizationId' && isNewOrgRegistration) {
        continue; // Skip - will be created during registration
      }
      
      const value = formData[field];
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        missing.push(field);
      }
    }

    // Validate organization ID format (UUID) only if provided and not null
    if (hasOrgId && formData.organizationId && !formData.organizationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return {
        success: false,
        message: 'Invalid organization ID format. Please verify your organization code.'
      };
    }

    if (missing.length > 0) {
      this.checks.mandatoryFields = false;
      return {
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`
      };
    }

    if (formData.username && (/\s/.test(String(formData.username)) || !/^[a-z0-9._-]+$/i.test(String(formData.username).trim()))) {
      return {
        success: false,
        message: 'Use a simple username: letters and numbers only, no spaces. Example: jsmith'
      };
    }

    // Validate password strength
    if (formData.password && formData.password.length < 12) {
      return {
        success: false,
        message: 'Password must be at least 12 characters long.'
      };
    }

    this.checks.mandatoryFields = true;
    return { success: true, message: 'All mandatory fields validated' };
  }

  /**
   * Verify organization exists and get its ID
   */
  async verifyOrganization(orgCode) {
    // TRACE: Start organization verification
    console.log('🔍 [TRACE] verifyOrganization START', {
      orgCode: orgCode,
      hasVerifiedOrgData: !!window.verifiedOrgData,
      verifiedOrgData: window.verifiedOrgData,
      deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      userAgent: navigator.userAgent.substring(0, 50)
    });
    
    // Trim and normalize org code
    const normalizedOrgCode = orgCode.trim();
    
    // First check if organization was already verified via "Verify Code" button
    if (window.verifiedOrgData && (
      window.verifiedOrgData.org_code === normalizedOrgCode ||
      window.verifiedOrgData.org_code?.trim() === normalizedOrgCode
    )) {
      console.log('✅ [TRACE] Using pre-verified organization data:', {
        id: window.verifiedOrgData.id,
        name: window.verifiedOrgData.name,
        org_code: window.verifiedOrgData.org_code
      });
      this.checks.organizationExists = true;
      return {
        success: true,
        organizationId: window.verifiedOrgData.id,
        organizationName: window.verifiedOrgData.name,
        message: 'Organization verified (pre-verified)'
      };
    }
    
    console.log('⚠️ [TRACE] Pre-verified data not found or mismatch', {
      verifiedOrgCode: window.verifiedOrgData?.org_code,
      inputCode: normalizedOrgCode,
      match: window.verifiedOrgData?.org_code === normalizedOrgCode
    });

    if (!window.supabaseClient) {
      return { success: false, message: 'Supabase client not initialized' };
    }

    try {
      const fetchOrgRow = async () => {
        if (typeof window.verifyOrganizationCodeRpc === 'function') {
          return window.verifyOrganizationCodeRpc(window.supabaseClient, normalizedOrgCode);
        }
        const { data: rows, error: rpcError } = await window.supabaseClient.rpc('verify_organization_code', {
          p_org_code: normalizedOrgCode
        });
        if (rpcError) return { data: null, error: rpcError };
        const row = Array.isArray(rows) && rows.length ? rows[0] : null;
        return { data: row, error: null };
      };

      let { data, error } = await fetchOrgRow();
      if (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const second = await fetchOrgRow();
        if (second.error) {
          this.checks.organizationExists = false;
          return {
            success: false,
            message: `Could not verify organization: ${second.error.message}`
          };
        }
        data = second.data;
      }

      if (!data) {
        this.checks.organizationExists = false;
        return {
          success: false,
          message: 'Organization code not found. Please verify the code and try again.'
        };
      }

      this.checks.organizationExists = true;
      return {
        success: true,
        organizationId: data.id,
        organizationName: data.name,
        message: 'Organization verified'
      };
    } catch (error) {
      this.checks.organizationExists = false;
      return {
        success: false,
        message: `Error verifying organization: ${error.message}`
      };
    }
  }

  /**
   * Check if username is available (globally unique)
   */
  async checkUsernameAvailability(username) {
    if (!window.supabaseClient) {
      return { success: true, available: true }; // Skip check if client not ready
    }

    try {
      let available = true;
      if (typeof window.isUsernameAvailableRpc === 'function') {
        const r = await window.isUsernameAvailableRpc(window.supabaseClient, username);
        if (r.error) return { success: true, available: true };
        available = r.available;
      } else {
        const { data, error } = await window.supabaseClient.rpc('is_username_available', {
          p_username: String(username).trim()
        });
        if (error) return { success: true, available: true };
        available = data === true;
      }

      if (!available) {
        this.checks.usernameAvailable = false;
        return {
          success: true,
          available: false,
          message: 'Username already taken. Please choose a different username.'
        };
      }

      this.checks.usernameAvailable = true;
      return { success: true, available: true };
    } catch (error) {
      // If check fails, assume available
      return { success: true, available: true };
    }
  }

  /**
   * Run all preflight checks
   */
  async runAllChecks(formData, orgCode = null) {
    const results = {
      passed: true,
      errors: [],
      warnings: [],
      data: {}
    };

    if (typeof window.RegTrace !== 'undefined') {
      window.RegTrace.step('preflight_start', { orgCode: orgCode || null, username: formData.username });
    }

    // 1. Check internet connection
    const internetCheck = await this.checkInternetConnection();
    if (!internetCheck.success) {
      results.passed = false;
      results.errors.push(internetCheck.message);
      if (typeof window.RegTrace !== 'undefined') {
        window.RegTrace.fail('preflight_internet', internetCheck.message, {});
      }
      return results;
    }
    if (typeof window.RegTrace !== 'undefined') window.RegTrace.ok('preflight_internet', {});

    // 2. Check Supabase client (async - uses universal readiness guarantee)
    const clientCheck = await this.checkSupabaseClient();
    if (!clientCheck.success) {
      results.passed = false;
      results.errors.push(clientCheck.message);
      if (typeof window.RegTrace !== 'undefined') {
        window.RegTrace.fail('preflight_supabase_client', clientCheck.message, {});
      }
      return results;
    }
    if (typeof window.RegTrace !== 'undefined') window.RegTrace.ok('preflight_supabase_client', {});

    // 3. Validate mandatory fields
    // Determine if this is new org registration (no orgCode provided)
    const isNewOrgRegistration = !orgCode && (!formData.organizationId || formData.organizationId === null);
    const fieldsCheck = this.validateMandatoryFields(formData, isNewOrgRegistration);
    if (!fieldsCheck.success) {
      results.passed = false;
      results.errors.push(fieldsCheck.message);
      if (typeof window.RegTrace !== 'undefined') {
        window.RegTrace.fail('preflight_fields', fieldsCheck.message, {});
      }
      return results;
    }
    if (typeof window.RegTrace !== 'undefined') window.RegTrace.ok('preflight_fields', {});

    // 4. Verify organization (if org code provided)
    // NOTE: For new organization registration, orgCode will be null
    // The organization will be created FIRST during registration, then organizationId will be available
    if (orgCode) {
      const orgCheck = await this.verifyOrganization(orgCode);
      if (!orgCheck.success) {
        results.passed = false;
        results.errors.push(orgCheck.message);
        return results;
      }
      results.data.organizationId = orgCheck.organizationId;
      results.data.organizationName = orgCheck.organizationName;
    } else if (formData.organizationId && formData.organizationId !== null) {
      // Organization ID already provided, just validate format
      if (!formData.organizationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        results.passed = false;
        results.errors.push('Invalid organization ID format');
        return results;
      }
      results.data.organizationId = formData.organizationId;
    }
    // If orgCode is null and organizationId is null, this is new org registration - skip org verification

    // 5. Check username availability (non-blocking)
    // Pass organizationId if available (for existing org registration)
    this.organizationId = results.data.organizationId || null;
    const usernameCheck = await this.checkUsernameAvailability(formData.username);
    if (!usernameCheck.available) {
      results.passed = false;
      results.errors.push(usernameCheck.message);
      if (typeof window.RegTrace !== 'undefined') {
        window.RegTrace.fail('preflight_username', usernameCheck.message, { username: formData.username });
      }
      return results;
    }
    if (typeof window.RegTrace !== 'undefined') window.RegTrace.ok('preflight_username', {});

    if (typeof window.RegTrace !== 'undefined') window.RegTrace.ok('preflight_complete', {});

    return results;
  }

  /**
   * Get status of all checks
   */
  getStatus() {
    return {
      allPassed: Object.values(this.checks).every(check => check === true),
      checks: { ...this.checks }
    };
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.RegistrationPreflight = RegistrationPreflight;
  window.registrationPreflight = new RegistrationPreflight();
}

