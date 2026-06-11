/**
 * Download Request Modal
 * Shows modal for requesting data downloads with password confirmation
 */

window.showDownloadRequestModal = function(requestType = 'backup', dataScope = 'Full organizational backup') {
  return new Promise((resolve, reject) => {
    // Create modal HTML
    const modalHTML = `
      <div id="download-request-modal" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        ">
          <div style="
            padding: 30px;
            border-bottom: 1px solid #e0e0e0;
          ">
            <h2 style="margin: 0 0 10px 0; color: #333; font-size: 24px;">
              🔐 Request Data Download
            </h2>
            <p style="margin: 0; color: #666; font-size: 14px;">
              You must enter your password twice and receive approval before downloading organizational data.
            </p>
          </div>
          
          <div style="padding: 30px;">
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
              <strong>⚠️ Approval Required</strong>
              <p style="margin: 10px 0 0 0; font-size: 13px;">
                Your download request requires approval from authorized personnel. 
                You will be notified once your request is approved.
              </p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Request Type:
              </label>
              <input type="text" id="request-type" value="${requestType}" readonly 
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; background: #f5f5f5;">
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Data Scope:
              </label>
              <input type="text" id="data-scope" value="${dataScope}" readonly 
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; background: #f5f5f5;">
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Reason for Download (Optional):
              </label>
              <textarea id="request-reason" rows="3" placeholder="e.g., Backup for compliance, Data migration, etc."
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-family: inherit; resize: vertical;"></textarea>
            </div>
            
            <div style="background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
              <strong>🔒 Password Confirmation</strong>
              <p style="margin: 10px 0 0 0; font-size: 13px;">
                Enter your password twice to confirm your identity. This password will be required when downloading the data.
              </p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Enter Password:
              </label>
              <input type="password" id="password-1" placeholder="Enter your password"
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 16px;">
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Confirm Password:
              </label>
              <input type="password" id="password-2" placeholder="Confirm your password"
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 16px;">
            </div>
            
            <div id="password-error" style="color: #dc3545; font-size: 14px; margin-bottom: 15px; display: none;"></div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button id="cancel-btn" style="
                background: #6c757d;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
              ">Cancel</button>
              <button id="submit-btn" style="
                background: #2196F3;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
              ">Submit Request</button>
            </div>
            
            <div id="request-status" style="margin-top: 20px; display: none;"></div>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('download-request-modal');
    
    // Get elements
    const password1 = document.getElementById('password-1');
    const password2 = document.getElementById('password-2');
    const requestReason = document.getElementById('request-reason');
    const dataScopeInput = document.getElementById('data-scope');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const passwordError = document.getElementById('password-error');
    const requestStatus = document.getElementById('request-status');
    
    // Close modal function
    const closeModal = () => {
      modal.remove();
      reject(new Error('Request cancelled'));
    };
    
    // Cancel button
    cancelBtn.addEventListener('click', closeModal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // Submit handler
    submitBtn.addEventListener('click', async () => {
      const pwd1 = password1.value.trim();
      const pwd2 = password2.value.trim();
      const reason = requestReason.value.trim();
      const scope = dataScopeInput.value.trim();
      
      // Validate passwords
      if (!pwd1 || !pwd2) {
        passwordError.textContent = 'Please enter your password in both fields';
        passwordError.style.display = 'block';
        return;
      }
      
      if (pwd1 !== pwd2) {
        passwordError.textContent = 'Passwords do not match. Please try again.';
        passwordError.style.display = 'block';
        password1.value = '';
        password2.value = '';
        password1.focus();
        return;
      }
      
      // Disable submit button
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      passwordError.style.display = 'none';
      
      try {
        console.log('🔍 Submitting download request...', { requestType, reason, scope });
        
        // Check if createDownloadRequest is available
        if (typeof window.createDownloadRequest === 'undefined') {
          throw new Error('createDownloadRequest function is not available. Please ensure js/data-download-manager.js is loaded.');
        }
        
        // Create download request
        console.log('✅ createDownloadRequest found, calling...');
        const result = await window.createDownloadRequest(
          requestType,
          pwd1,
          reason || null,
          scope || null
        );
        console.log('✅ Download request created successfully:', result);
        
        // Show success message
        requestStatus.innerHTML = `
          <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; border-radius: 4px;">
            <strong>✅ Request Submitted Successfully!</strong>
            <p style="margin: 10px 0 0 0; font-size: 13px;">
              Your download request has been submitted. 
              ${result.requires_admin_approval || result.requires_doctor_approval ? 
                'It requires approval from authorized personnel. You will be notified once approved.' : 
                'It is being processed.'}
            </p>
            <p style="margin: 10px 0 0 0; font-size: 13px;">
              <strong>Request ID:</strong> ${result.request_id}
            </p>
          </div>
        `;
        requestStatus.style.display = 'block';
        
        // Close modal after 3 seconds
        setTimeout(() => {
          modal.remove();
          resolve(result);
        }, 3000);
        
      } catch (error) {
        console.error('Error creating download request:', error);
        passwordError.textContent = 'Error: ' + error.message;
        passwordError.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
      }
    });
    
    // Focus first password field
    password1.focus();
  });
};







