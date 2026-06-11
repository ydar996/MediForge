/**
 * Data Download Manager
 * Handles secure data download requests with approval workflow
 */

// Hash password using SHA-256 (same as login system)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Create a download request
window.createDownloadRequest = async function(requestType, password, requestReason = null, dataScope = null) {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user.username) {
      throw new Error('User not logged in');
    }
    
    // Hash the password
    const passwordHash = await hashPassword(password);
    
    console.log('🔍 Calling secureSupabaseRpc for create_download_request...');
    
    // Check if secureSupabaseRpc is available
    if (typeof window.secureSupabaseRpc === 'undefined') {
      console.error('❌ secureSupabaseRpc is not available');
      throw new Error('Secure Supabase RPC function is not available. Please ensure js/supabase-client.js is loaded.');
    }
    
    // Call RPC to create request
    const response = await window.secureSupabaseRpc('create_download_request', {
      p_request_type: requestType,
      p_password_hash: passwordHash,
      p_request_reason: requestReason,
      p_requested_data_scope: dataScope
    });
    
    console.log('📥 RPC response received:', response);
    
    // Handle response format from secure-supabase.js (wrapped in {data: ...})
    // The secure-supabase.js function returns {data: result} where result is the JSON from Supabase
    const result = response.data || response;
    
    console.log('📦 Unwrapped result:', result);
    
    if (!result || (!result.success && !result.request_id)) {
      const errorMsg = result?.error || response?.error || 'Failed to create download request';
      console.error('❌ Request creation failed:', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Return the result (unwrap if needed)
    const finalResult = result.success !== undefined ? result : { success: true, ...result };
    
    console.log('✅ Request created successfully:', finalResult);
    
    // Log audit event
    if (typeof logAuditEvent !== 'undefined') {
      await logAuditEvent('data_download_requested', {
        request_id: finalResult.request_id,
        request_type: requestType,
        requires_admin_approval: finalResult.requires_admin_approval,
        requires_doctor_approval: finalResult.requires_doctor_approval,
        required_approval_count: finalResult.required_approval_count
      });
    }
    
    return finalResult;
  } catch (error) {
    console.error('Error creating download request:', error);
    throw error;
  }
};

// Get pending download requests for approval
window.getPendingDownloadRequests = async function() {
  try {
    const response = await window.secureSupabaseRpc('get_pending_download_requests', {});
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch pending requests');
    }
    
    return response.requests || [];
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    throw error;
  }
};

// Approve a download request
window.approveDownloadRequest = async function(requestId) {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const response = await window.secureSupabaseRpc('approve_download_request', {
      p_request_id: requestId
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to approve request');
    }
    
    // Log audit event
    if (typeof logAuditEvent !== 'undefined') {
      await logAuditEvent('data_download_approved', {
        request_id: requestId,
        approved: response.approved,
        admin_approvals: response.admin_approvals,
        doctor_approvals: response.doctor_approvals
      });
    }
    
    return response;
  } catch (error) {
    console.error('Error approving download request:', error);
    throw error;
  }
};

// Mark download as completed
window.markDownloadCompleted = async function(requestId) {
  try {
    const response = await window.secureSupabaseRpc('mark_download_completed', {
      p_request_id: requestId
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to mark download as completed');
    }
    
    // Log audit event
    if (typeof logAuditEvent !== 'undefined') {
      await logAuditEvent('data_download_completed', {
        request_id: requestId
      });
    }
    
    return response;
  } catch (error) {
    console.error('Error marking download as completed:', error);
    throw error;
  }
};

// Check if user has an approved request for download
window.checkApprovedDownloadRequest = async function(requestId) {
  try {
    // Use window.supabaseClient directly (set by supabase-client.js)
    if (!window.supabaseClient) {
      throw new Error('Supabase client not available. Please ensure supabase-client.js is loaded.');
    }
    const supabaseClient = window.supabaseClient;
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user.user_id;
    
    if (!userId) {
      throw new Error('User ID not found');
    }
    
    const { data, error } = await supabaseClient
      .from('data_download_requests')
      .select('*')
      .eq('id', requestId)
      .eq('requested_by_user_id', userId)
      .eq('status', 'approved')
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    // Check if expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error checking approved request:', error);
    return null;
  }
};

// Verify password matches the request
window.verifyDownloadPassword = async function(requestId, password) {
  try {
    const approvedRequest = await window.checkApprovedDownloadRequest(requestId);
    
    if (!approvedRequest) {
      throw new Error('No approved request found or request not approved');
    }
    
    // Hash the provided password
    const passwordHash = await hashPassword(password);
    
    // Compare with stored hash
    if (passwordHash !== approvedRequest.password_hash) {
      throw new Error('Password does not match');
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying password:', error);
    throw error;
  }
};

// Get user's own download requests (all statuses)
window.getMyDownloadRequests = async function() {
  try {
    // Use window.supabaseClient directly (set by supabase-client.js)
    if (!window.supabaseClient) {
      throw new Error('Supabase client not available. Please ensure supabase-client.js is loaded.');
    }
    const supabaseClient = window.supabaseClient;
    
    // Get user info - try multiple possible locations
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user.user_id || user.uuid;
    
    if (!userId) {
      // Try to get from Supabase auth session
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user?.id) {
        // Look up user in users table by auth_user_id
        const { data: userRecord } = await supabaseClient
          .from('users')
          .select('id')
          .eq('auth_user_id', session.user.id)
          .single();
        
        if (userRecord?.id) {
          const finalUserId = userRecord.id;
          const { data, error } = await supabaseClient
            .from('data_download_requests')
            .select('*')
            .eq('requested_by_user_id', finalUserId)
            .order('requested_at', { ascending: false });
          
          if (error) throw error;
          return data || [];
        }
      }
      throw new Error('User ID not found. Please ensure you are logged in.');
    }
    
    const { data, error } = await supabaseClient
      .from('data_download_requests')
      .select('*')
      .eq('requested_by_user_id', userId)
      .order('requested_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching my download requests:', error);
    throw error;
  }
};

