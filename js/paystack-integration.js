// Paystack Payment Integration
// Purpose: Handle Paystack payments for subscription billing

(function() {
  'use strict';
  
  /**
   * Initialize Paystack payment
   * @param {Object} options - Payment options
   */
  window.initializePaystackPayment = function(options) {
    const {
      amount,           // Amount in kobo (multiply by 100)
      currency,         // NGN, GHS, ZAR, KES
      email,            // Customer email
      organizationName, // Organization name
      planName,         // Plan name
      billingCycle,     // monthly/annual
      onSuccess,        // Success callback
      onCancel          // Cancel callback
    } = options;
    
    // Check if Paystack script is loaded
    if (typeof PaystackPop === 'undefined') {
      console.warn('Paystack library not loaded, using simulation');
      showPaystackSimulation(options);
      return;
    }
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userEmail = email || user.email || 'clinic@mediforge.com';
    
    // Initialize Paystack
    const handler = PaystackPop.setup({
      key: getProviderConfig('paystack')?.publicKey || 'pk_test_xxx', // Use actual public key
      email: userEmail,
      amount: amount * 100, // Convert to kobo
      currency: currency,
      ref: generatePaymentReference(organizationName),
      metadata: {
        custom_fields: [
          {
            display_name: "Organization",
            variable_name: "organization",
            value: organizationName
          },
          {
            display_name: "Plan",
            variable_name: "plan",
            value: planName
          },
          {
            display_name: "Billing Cycle",
            variable_name: "billing_cycle",
            value: billingCycle
          }
        ]
      },
      callback: function(response) {
        // Payment successful
        verifyPaystackPayment(response.reference, options, onSuccess);
      },
      onClose: function() {
        // Payment cancelled
        if (onCancel) onCancel();
      }
    });
    
    handler.openIframe();
  };
  
  /**
   * Verify Paystack payment
   */
  function verifyPaystackPayment(reference, options, onSuccess) {
    // In production, this would make a server-side API call to verify
    // For now, we'll simulate successful verification
    
    console.log('Verifying payment:', reference);
    
    // Simulate verification delay
    setTimeout(() => {
      const paymentRecord = {
        reference: reference,
        amount: options.amount,
        currency: options.currency,
        status: 'success',
        provider: 'paystack',
        method: 'card', // Could be card, bank, ussd, etc.
        date: new Date().toISOString(),
        organizationName: options.organizationName,
        planName: options.planName,
        billingCycle: options.billingCycle
      };
      
      // Save payment record
      savePaymentRecord(paymentRecord);
      
      // Call success callback
      if (onSuccess) {
        onSuccess(paymentRecord);
      }
      
      alert(`✅ Payment Successful!\n\nReference: ${reference}\nAmount: ${formatCurrencyAmount(options.amount, options.currency)}\n\nYour subscription has been activated.`);
    }, 1500);
  }
  
  /**
   * Show Paystack-style payment simulation
   */
  function showPaystackSimulation(options) {
    const modal = document.createElement('div');
    modal.id = 'paystack-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); z-index: 99999; display: flex;
      justify-content: center; align-items: center;
    `;
    
    const paymentMethods = getPaymentMethodsForPaystack(options.currency);
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; max-width: 450px; width: 90%; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="background: #00C3F7; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 24px; font-weight: bold;">Paystack</div>
            <div style="font-size: 14px; opacity: 0.9;">Secure Payment</div>
          </div>
          <button onclick="closePaystackModal()" style="background: none; border: none; color: white; font-size: 28px; cursor: pointer; width: 35px; height: 35px;">×</button>
        </div>
        
        <!-- Amount -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-bottom: 2px solid #e0e0e0;">
          <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Amount to pay</div>
          <div style="font-size: 32px; font-weight: bold; color: #333;">${formatCurrencyAmount(options.amount, options.currency)}</div>
          <div style="font-size: 13px; color: #666; margin-top: 5px;">${options.planName} - ${options.billingCycle === 'annual' ? 'Annual' : 'Monthly'}</div>
        </div>
        
        <!-- Payment Methods Tabs -->
        <div style="padding: 20px;">
          <div id="payment-method-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #e0e0e0;">
            ${paymentMethods.map((method, index) => `
              <button onclick="selectPaystackMethod('${method.id}')" 
                      id="tab-${method.id}"
                      class="paystack-tab ${index === 0 ? 'active' : ''}"
                      style="flex: 1; padding: 12px; border: none; background: none; cursor: pointer; font-weight: 600; color: #666; border-bottom: 3px solid transparent; transition: all 0.3s;">
                ${method.icon} ${method.name}
              </button>
            `).join('')}
          </div>
          
          <!-- Payment Forms -->
          <div id="paystack-form-container">
            <!-- Populated by selectPaystackMethod -->
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize first payment method
    selectPaystackMethod(paymentMethods[0]?.id || 'card', options);
  }
  
  /**
   * Get payment methods available in Paystack for currency
   */
  function getPaymentMethodsForPaystack(currency) {
    const methods = [];
    
    if (['NGN', 'GHS', 'ZAR', 'KES'].includes(currency)) {
      methods.push({ id: 'card', icon: '💳', name: 'Card' });
    }
    
    if (currency === 'NGN') {
      methods.push({ id: 'bank', icon: '🏦', name: 'Bank' });
      methods.push({ id: 'ussd', icon: '📱', name: 'USSD' });
      methods.push({ id: 'transfer', icon: '💸', name: 'Transfer' });
    }
    
    if (currency === 'KES') {
      methods.push({ id: 'mpesa', icon: '💚', name: 'M-Pesa' });
    }
    
    if (currency === 'GHS') {
      methods.push({ id: 'mobilemoney', icon: '📲', name: 'Mobile Money' });
    }
    
    return methods;
  }
  
  /**
   * Select payment method tab
   */
  window.selectPaystackMethod = function(methodId, options = {}) {
    // Update tab styles
    document.querySelectorAll('.paystack-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.style.color = '#666';
      tab.style.borderBottom = '3px solid transparent';
    });
    
    const activeTab = document.getElementById(`tab-${methodId}`);
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.style.color = '#00C3F7';
      activeTab.style.borderBottom = '3px solid #00C3F7';
    }
    
    const container = document.getElementById('paystack-form-container');
    if (!container) return;
    
    // Show form for selected method
    if (methodId === 'card') {
      container.innerHTML = getCardPaymentForm(options);
    } else if (methodId === 'bank') {
      container.innerHTML = getBankPaymentForm(options);
    } else if (methodId === 'ussd') {
      container.innerHTML = getUSSDPaymentForm(options);
    } else if (methodId === 'transfer') {
      container.innerHTML = getTransferPaymentForm(options);
    } else if (methodId === 'mpesa') {
      container.innerHTML = getMpesaPaymentForm(options);
    } else if (methodId === 'mobilemoney') {
      container.innerHTML = getMobileMoneyPaymentForm(options);
    }
  };
  
  /**
   * Card payment form
   */
  function getCardPaymentForm(options) {
    return `
      <div>
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Card Number</label>
        <input type="text" id="card-number" placeholder="0000 0000 0000 0000" maxlength="19" 
               style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; margin-bottom: 15px;"
               oninput="formatCardNumber(this)">
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Expiry Date</label>
            <input type="text" id="card-expiry" placeholder="MM/YY" maxlength="5"
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px;"
                   oninput="formatExpiry(this)">
          </div>
          <div>
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">CVV</label>
            <input type="text" id="card-cvv" placeholder="123" maxlength="4"
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px;"
                   oninput="this.value = this.value.replace(/[^0-9]/g, '')">
          </div>
        </div>
        
        <button onclick="processPaystackCardPayment()" 
                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #00C3F7, #0099CC); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 10px;">
          Pay ${options.amount ? formatCurrencyAmount(options.amount, options.currency) : ''}
        </button>
        
        <div style="text-align: center; margin-top: 15px; font-size: 12px; color: #999;">
          🔒 Secured by Paystack
        </div>
      </div>
    `;
  }
  
  /**
   * Bank transfer form
   */
  function getTransferPaymentForm(options) {
    return `
      <div style="text-align: center;">
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 15px 0;">
          <p style="color: #666; margin-bottom: 15px;">Transfer ${options.amount ? formatCurrencyAmount(options.amount, options.currency) : ''} to the account below:</p>
          
          <div style="background: white; padding: 15px; border-radius: 6px; text-align: left;">
            <p style="margin: 8px 0;"><strong>Bank:</strong> Wema Bank</p>
            <p style="margin: 8px 0;"><strong>Account Name:</strong> Paystack Merchant - MediForge</p>
            <p style="margin: 8px 0;"><strong>Account Number:</strong> <span style="font-size: 18px; font-weight: bold; color: #00C3F7;">9876543210</span></p>
            <p style="margin: 8px 0; font-size: 12px; color: #666;">This account is automatically generated and expires in 1 hour</p>
          </div>
        </div>
        
        <p style="color: #666; font-size: 14px; margin: 15px 0;">Once you complete the transfer, click confirm below.</p>
        
        <button onclick="confirmPaystackTransfer()" 
                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #00C3F7, #0099CC); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer;">
          I've Completed the Transfer
        </button>
      </div>
    `;
  }
  
  /**
   * USSD payment form
   */
  function getUSSDPaymentForm(options) {
    return `
      <div>
        <p style="color: #666; margin-bottom: 15px;">Select your bank to get a USSD code:</p>
        
        <select id="ussd-bank" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; margin-bottom: 15px; font-size: 16px;">
          <option value="">-- Select Your Bank --</option>
          <option value="gtb">GTBank - Dial *737*</option>
          <option value="access">Access Bank - Dial *901*</option>
          <option value="zenith">Zenith Bank - Dial *966*</option>
          <option value="uba">UBA - Dial *919*</option>
          <option value="firstbank">First Bank - Dial *894*</option>
          <option value="fcmb">FCMB - Dial *329*</option>
        </select>
        
        <div id="ussd-code-display" style="display: none; background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center; margin: 15px 0;">
          <p style="margin: 0 0 10px 0; color: #666;">Dial this code on your phone:</p>
          <div id="ussd-code" style="font-size: 24px; font-weight: bold; color: #155724; font-family: monospace;"></div>
          <p style="margin: 15px 0 0 0; font-size: 13px; color: #666;">Follow the prompts to complete payment</p>
        </div>
        
        <button onclick="generateUSSDCode()" 
                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #00C3F7, #0099CC); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer;">
          Generate USSD Code
        </button>
      </div>
    `;
  }
  
  /**
   * M-Pesa payment form (Kenya)
   */
  function getMpesaPaymentForm(options) {
    return `
      <div>
        <p style="color: #666; margin-bottom: 15px;">Enter your M-Pesa phone number:</p>
        
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">M-Pesa Phone Number</label>
        <input type="tel" id="mpesa-phone" placeholder="0712345678" 
               style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; margin-bottom: 15px;"
               oninput="this.value = this.value.replace(/[^0-9]/g, '')">
        
        <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
          <p style="margin: 0; font-size: 13px; color: #666;">
            💚 You will receive an M-Pesa prompt on your phone. Enter your M-Pesa PIN to complete the payment.
          </p>
        </div>
        
        <button onclick="initiateM pesaPayment()" 
                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #00C3F7, #0099CC); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer;">
          Send M-Pesa Prompt
        </button>
      </div>
    `;
  }
  
  /**
   * Bank selection form
   */
  function getBankPaymentForm(options) {
    return `
      <div>
        <p style="color: #666; margin-bottom: 15px;">Select your bank to pay directly from your account:</p>
        
        <select id="bank-select" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; margin-bottom: 15px; font-size: 16px;">
          <option value="">-- Select Your Bank --</option>
          <option value="gtb">Guaranty Trust Bank</option>
          <option value="access">Access Bank</option>
          <option value="zenith">Zenith Bank</option>
          <option value="uba">United Bank for Africa</option>
          <option value="firstbank">First Bank of Nigeria</option>
          <option value="fcmb">FCMB</option>
          <option value="sterling">Sterling Bank</option>
          <option value="fidelity">Fidelity Bank</option>
        </select>
        
        <button onclick="processBankPayment()" 
                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #00C3F7, #0099CC); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer;">
          Continue with Bank
        </button>
      </div>
    `;
  }
  
  /**
   * Mobile Money form (Ghana)
   */
  function getMobileMoneyPaymentForm(options) {
    return `
      <div>
        <p style="color: #666; margin-bottom: 15px;">Select your mobile money provider:</p>
        
        <select id="momo-provider" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; margin-bottom: 15px; font-size: 16px;">
          <option value="">-- Select Provider --</option>
          <option value="mtn">MTN Mobile Money</option>
          <option value="vodafone">Vodafone Cash</option>
          <option value="airteltigo">AirtelTigo Money</option>
        </select>
        
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Mobile Money Number</label>
        <input type="tel" id="momo-phone" placeholder="0241234567" 
               style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; margin-bottom: 15px;"
               oninput="this.value = this.value.replace(/[^0-9]/g, '')">
        
        <button onclick="processMobileMoneyPayment()" 
                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #00C3F7, #0099CC); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer;">
          Pay with Mobile Money
        </button>
      </div>
    `;
  }
  
  /**
   * Process card payment
   */
  window.processPaystackCardPayment = function() {
    const cardNumber = document.getElementById('card-number')?.value.replace(/\s/g, '');
    const expiry = document.getElementById('card-expiry')?.value;
    const cvv = document.getElementById('card-cvv')?.value;
    
    if (!cardNumber || cardNumber.length < 15) {
      alert('Please enter a valid card number');
      return;
    }
    
    if (!expiry || expiry.length < 5) {
      alert('Please enter card expiry (MM/YY)');
      return;
    }
    
    if (!cvv || cvv.length < 3) {
      alert('Please enter CVV');
      return;
    }
    
    // Show processing
    showPaymentProcessing();
    
    // Simulate payment processing
    setTimeout(() => {
      // For Nigerian cards, show OTP
      if (currentPaymentOptions.currency === 'NGN') {
        showOTPVerification();
      } else {
        completePaystackPayment();
      }
    }, 2000);
  };
  
  /**
   * Show OTP verification (Nigerian cards)
   */
  function showOTPVerification() {
    const container = document.getElementById('paystack-form-container');
    container.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 48px; margin: 20px 0;">🔐</div>
        <h3 style="color: #333; margin-bottom: 10px;">Enter OTP</h3>
        <p style="color: #666; margin-bottom: 20px;">Please enter the OTP sent to your phone</p>
        
        <input type="text" id="otp-input" placeholder="123456" maxlength="6"
               style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 24px; text-align: center; letter-spacing: 8px; font-weight: bold; margin-bottom: 20px;"
               oninput="this.value = this.value.replace(/[^0-9]/g, '')">
        
        <button onclick="verifyOTP()" 
                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #00C3F7, #0099CC); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer;">
          Verify & Pay
        </button>
        
        <button onclick="selectPaystackMethod('card')" 
                style="width: 100%; padding: 12px; background: none; color: #666; border: none; cursor: pointer; margin-top: 10px;">
          ← Back
        </button>
      </div>
    `;
  }
  
  /**
   * Verify OTP and complete payment
   */
  window.verifyOTP = function() {
    const otp = document.getElementById('otp-input')?.value;
    
    if (!otp || otp.length !== 6) {
      alert('Please enter a valid 6-digit OTP');
      return;
    }
    
    showPaymentProcessing();
    setTimeout(completePaystackPayment, 2000);
  };
  
  /**
   * Show payment processing animation
   */
  function showPaymentProcessing() {
    const container = document.getElementById('paystack-form-container');
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 64px; animation: spin 1s linear infinite;">⏳</div>
        <h3 style="color: #333; margin: 20px 0 10px 0;">Processing Payment...</h3>
        <p style="color: #666;">Please wait while we confirm your payment</p>
      </div>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  }
  
  /**
   * Complete Paystack payment
   */
  function completePaystackPayment() {
    const reference = generatePaymentReference(currentPaymentOptions.organizationName);
    
    const paymentRecord = {
      reference: reference,
      amount: currentPaymentOptions.amount,
      currency: currentPaymentOptions.currency,
      status: 'success',
      provider: 'paystack',
      method: 'card',
      date: new Date().toISOString(),
      organizationName: currentPaymentOptions.organizationName,
      planName: currentPaymentOptions.planName,
      billingCycle: currentPaymentOptions.billingCycle
    };
    
    savePaymentRecord(paymentRecord);
    
    // Update subscription
    updateOrgSubscription(currentPaymentOptions);
    
    // Show success
    showPaymentSuccess(paymentRecord);
  }
  
  /**
   * Show payment success
   */
  function showPaymentSuccess(payment) {
    const container = document.querySelector('#paystack-modal > div');
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 72px; color: #4CAF50; margin-bottom: 20px;">✅</div>
        <h2 style="color: #333; margin-bottom: 10px;">Payment Successful!</h2>
        <p style="color: #666; margin-bottom: 20px;">Your subscription has been activated</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: left; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Reference:</strong> ${payment.reference}</p>
          <p style="margin: 8px 0;"><strong>Amount:</strong> ${formatCurrencyAmount(payment.amount, payment.currency)}</p>
          <p style="margin: 8px 0;"><strong>Plan:</strong> ${payment.planName}</p>
          <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(payment.date).toLocaleString()}</p>
        </div>
        
        <button onclick="closePaystackModal(); window.location.reload();" 
                style="width: 100%; padding: 15px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 20px;">
          Done
        </button>
      </div>
    `;
  }
  
  /**
   * Close Paystack modal
   */
  window.closePaystackModal = function() {
    const modal = document.getElementById('paystack-modal');
    if (modal) modal.remove();
    currentPaymentOptions = null;
  };
  
  /**
   * Format card number
   */
  window.formatCardNumber = function(input) {
    let value = input.value.replace(/\s/g, '');
    value = value.replace(/[^0-9]/g, '');
    value = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = value;
  };
  
  /**
   * Format expiry date
   */
  window.formatExpiry = function(input) {
    let value = input.value.replace(/[^0-9]/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    input.value = value;
  };
  
  /**
   * Generate payment reference
   */
  function generatePaymentReference(orgName) {
    const prefix = orgName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const timestamp = Date.now();
    return `${prefix}-PAY-${timestamp}`;
  }
  
  /**
   * Save payment record
   */
  function savePaymentRecord(payment) {
    const payments = JSON.parse(localStorage.getItem('subscription_payments') || '[]');
    payments.push(payment);
    localStorage.setItem('subscription_payments', JSON.stringify(payments));
    console.log('Payment record saved:', payment.reference);
  }
  
  /**
   * Update organization subscription
   */
  function updateOrgSubscription(options) {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (!organizations[options.organizationName]) return;
    
    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + (options.billingCycle === 'annual' ? 12 : 1));
    
    organizations[options.organizationName].subscription = {
      currentPlan: options.planId,
      planName: options.planName,
      status: 'active',
      billingCycle: options.billingCycle,
      startDate: now.toISOString(),
      expiryDate: nextBilling.toISOString(),
      nextBillingDate: nextBilling.toISOString(),
      autoRenew: false,
      paymentMethod: 'paystack',
      lastPayment: {
        date: now.toISOString(),
        amount: options.amount,
        currency: options.currency,
        method: 'paystack',
        status: 'completed',
        reference: generatePaymentReference(options.organizationName)
      }
    };
    
    localStorage.setItem('organizations', JSON.stringify(organizations));
    console.log('Subscription updated for:', options.organizationName);
  }
  
  // Store current payment options globally
  let currentPaymentOptions = null;
  
  window.setCurrentPaymentOptions = function(options) {
    currentPaymentOptions = options;
  };
  
  console.log('Paystack integration loaded');
})();


