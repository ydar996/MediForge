// Purpose: Payment processing and receipt generation for MediForge
// Handles cash, mobile money, card, and other payment methods

// ==================== RECEIPT GENERATION ====================

// Generate receipt HTML
window.generateReceiptHTML = function(payment, invoice) {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const org = user.org || 'Healthcare Facility';
    
    // Safe currency formatting with fallback
    const formatCurrencySafe = function(amount, currency) {
      if (typeof window.formatCurrency === 'function') {
        return window.formatCurrency(amount || 0, currency || 'CAD');
      }
      // Fallback formatting
      const symbol = currency === 'CAD' ? 'CA$' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'GHS' ? 'GH₵' : currency === 'NGN' ? '₦' : currency;
      const numAmount = parseFloat(amount || 0).toFixed(2);
      return `${symbol}${numAmount}`;
    };
    
    // Safe value extraction with fallbacks
    const safeValue = function(value, fallback = 'N/A') {
      return value !== null && value !== undefined && value !== '' ? value : fallback;
    };
    
    const receiptNo = safeValue(payment.reference, payment.id || 'N/A');
    const paymentDate = safeValue(payment.date, new Date().toISOString().split('T')[0]);
    const patientName = safeValue(payment.patientName, 'N/A');
    const paymentMethod = getPaymentMethodName(payment.method || 'cash');
    const methodDetails = safeValue(payment.methodDetails, '');
    const receivedBy = safeValue(payment.receivedBy, user.username || user.name || 'Staff');
    const paymentAmount = parseFloat(payment.amount || 0);
    const paymentCurrency = payment.currency || 'CAD';
    
    // Invoice calculations with safety checks
    let invoiceTotal = 0;
    let invoiceCurrency = paymentCurrency;
    let previousPayments = 0;
    let balanceDue = paymentAmount;
    
    if (invoice) {
      invoiceTotal = parseFloat(invoice.total || 0);
      invoiceCurrency = invoice.currency || paymentCurrency;
      const amountPaid = parseFloat(invoice.amountPaid || 0);
      previousPayments = amountPaid > paymentAmount ? amountPaid - paymentAmount : 0;
      balanceDue = parseFloat(invoice.amountDue || 0);
    }
    
    // Build services list for receipt
    let services = [];
    if (invoice && invoice.services) {
      if (Array.isArray(invoice.services)) {
        services = invoice.services;
      } else if (typeof invoice.services === 'string') {
        try {
          const parsed = JSON.parse(invoice.services);
          if (Array.isArray(parsed)) {
            services = parsed;
          }
        } catch (e) {
          services = [];
        }
      }
    }

    const servicesHtml = invoice ? `
  <div class="section">
    <div class="row">
      <span class="label">Services:</span>
      <span></span>
    </div>
    ${services.length > 0 ? services.map(service => {
      const name = safeValue(service.name || service.service_name, 'Service');
      const code = service.code || service.service_code;
      const quantity = parseFloat(service.quantity || 1);
      const price = parseFloat(service.price || 0);
      const total = parseFloat(service.total || (price * quantity) || 0);
      const label = code ? `${name} (${code})` : name;
      const line = `${quantity} x ${formatCurrencySafe(price, invoiceCurrency)}`;
      return `
    <div class="row">
      <span class="label" style="font-weight: normal;">${label}</span>
      <span>${line} = ${formatCurrencySafe(total, invoiceCurrency)}</span>
    </div>`;
    }).join('') : `
    <div class="row">
      <span class="label" style="font-weight: normal;">No service details available</span>
      <span></span>
    </div>`}
  </div>
    ` : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${receiptNo}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      max-width: 400px;
      margin: 20px auto;
      padding: 20px;
      border: 2px solid #333;
      background: white;
    }
    .header {
      text-align: center;
      border-bottom: 2px dashed #333;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .header h2 {
      margin: 0;
      font-size: 18px;
      color: #008753;
    }
    .header p {
      margin: 5px 0;
      font-size: 12px;
    }
    .section {
      margin: 15px 0;
      padding: 10px 0;
      border-bottom: 1px dashed #999;
    }
    .section:last-of-type {
      border-bottom: none;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      word-wrap: break-word;
    }
    .label {
      font-weight: bold;
      flex: 0 0 auto;
      margin-right: 10px;
    }
    .row span:last-child {
      text-align: right;
      flex: 1;
    }
    .total {
      font-size: 18px;
      font-weight: bold;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 2px solid #333;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 11px;
      border-top: 2px dashed #333;
      padding-top: 10px;
    }
    @media print {
      body {
        border: none;
        margin: 0;
        padding: 10px;
        max-width: 100%;
      }
      @page {
        margin: 0.5cm;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${org}</h2>
    <p>OFFICIAL RECEIPT</p>
    <p>${new Date().toLocaleString()}</p>
  </div>
  
  <div class="section">
    <div class="row">
      <span class="label">Receipt No:</span>
      <span>${receiptNo}</span>
    </div>
    ${invoice && invoice.invoiceNumber ? `
    <div class="row">
      <span class="label">Invoice No:</span>
      <span>${invoice.invoiceNumber}</span>
    </div>
    ` : ''}
    <div class="row">
      <span class="label">Date:</span>
      <span>${paymentDate}</span>
    </div>
    <div class="row">
      <span class="label">Patient:</span>
      <span>${patientName}</span>
    </div>
  </div>
  
  <div class="section">
    <div class="row">
      <span class="label">Payment Method:</span>
      <span>${paymentMethod}</span>
    </div>
    ${methodDetails ? `
    <div class="row">
      <span class="label">Reference:</span>
      <span>${methodDetails}</span>
    </div>
    ` : ''}
  </div>
  
  ${invoice ? `
  <div class="section">
    <div class="row">
      <span class="label">Invoice Amount:</span>
      <span>${formatCurrencySafe(invoiceTotal, invoiceCurrency)}</span>
    </div>
    ${previousPayments > 0 ? `
    <div class="row">
      <span class="label">Previous Payments:</span>
      <span>${formatCurrencySafe(previousPayments, invoiceCurrency)}</span>
    </div>
    ` : ''}
    <div class="row">
      <span class="label">This Payment:</span>
      <span>${formatCurrencySafe(paymentAmount, invoiceCurrency)}</span>
    </div>
    <div class="row total">
      <span class="label">Balance Due:</span>
      <span>${formatCurrencySafe(balanceDue, invoiceCurrency)}</span>
    </div>
  </div>
  ${servicesHtml}
  ` : `
  <div class="section">
    <div class="row total">
      <span class="label">Amount Paid:</span>
      <span>${formatCurrencySafe(paymentAmount, paymentCurrency)}</span>
    </div>
  </div>
  `}
  
  <div class="footer">
    <p>Received by: ${receivedBy}</p>
    <p>Thank you for your payment!</p>
    <p style="margin-top: 10px; font-size: 10px;">
      This is a computer-generated receipt.
    </p>
  </div>
  
  <script>
    // Auto-print when opened
    (function() {
      function attemptPrint() {
        try {
          window.print();
        } catch (error) {
          console.error('Print error:', error);
        }
      }
      
      if (document.readyState === 'complete') {
        setTimeout(attemptPrint, 250);
      } else {
        window.addEventListener('load', function() {
          setTimeout(attemptPrint, 500);
        });
      }
    })();
  </script>
</body>
</html>
    `;
    
    return html;
  } catch (error) {
    console.error('Error generating receipt HTML:', error);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt Error</title></head><body><h1>Error generating receipt</h1><p>${error.message}</p></body></html>`;
  }
};

// Get payment method display name
function getPaymentMethodName(method) {
  const names = {
    'cash': 'Cash',
    'mobile_money': 'Mobile Money',
    'card': 'Card Payment',
    'bank_transfer': 'Bank Transfer',
    'check': 'Check/Cheque',
    'insurance': 'Insurance'
  };
  return names[method] || method;
}

// Print receipt
window.printReceipt = async function(paymentIdOrPayment) {
  try {
    // Allow passing a payment object directly
    let payment = null;
    let paymentId = paymentIdOrPayment;
    if (paymentIdOrPayment && typeof paymentIdOrPayment === 'object') {
      payment = paymentIdOrPayment;
      paymentId = payment.id;
    }

    // Get all payments function with fallback
    const getAllPaymentsFn = window.getAllPayments || getAllPayments;
    if (typeof getAllPaymentsFn !== 'function') {
      console.error('getAllPayments function not available');
      alert('Unable to retrieve payment data. Please try again.');
      return;
    }
    
    // Lookup payment if we didn't receive the object
    let allPayments = [];
    if (!payment) {
      allPayments = await getAllPaymentsFn();
      payment = allPayments.find(p => p.id === paymentId || p.id === String(paymentId));
    }
    if (!payment) {
      // Fallback to localStorage (Supabase save can fail but local save succeeds)
      try {
        const localKey = getBillingKey('payments');
        const localPayments = JSON.parse(localStorage.getItem(localKey) || '[]');
        payment = localPayments.find(p => p.id === paymentId || p.id === String(paymentId));
        if (!payment) {
          const legacyPayments = JSON.parse(localStorage.getItem('_billing_payments') || '[]');
          payment = legacyPayments.find(p => p.id === paymentId || p.id === String(paymentId));
        }
        if (!payment && window.__lastRecordedPayment) {
          const lastPayment = window.__lastRecordedPayment;
          if (lastPayment.id === paymentId || lastPayment.id === String(paymentId)) {
            payment = lastPayment;
          }
        }
      } catch (fallbackError) {
        console.error('Error loading local payments for receipt:', fallbackError);
      }
    }
    if (!payment) {
      console.error('Payment not found with ID:', paymentId);
      alert('Payment not found. Please check the payment ID and try again.');
      return;
    }
    
    // Get invoice with fallback - await async getInvoiceById
    const getInvoiceByIdFn = window.getInvoiceById || getInvoiceById;
    let invoice = null;
    if (payment.invoiceId && typeof getInvoiceByIdFn === 'function') {
      invoice = await getInvoiceByIdFn(payment.invoiceId);
    }
    
    const receiptHTML = generateReceiptHTML(payment, invoice);
    
    if (!receiptHTML) {
      console.error('Failed to generate receipt HTML');
      alert('Failed to generate receipt. Please try again.');
      return;
    }
    
    // Open in new window and print
    try {
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
        // Popup blocked - do NOT replace current page
        alert('Popups are blocked. Please allow popups to print the receipt or use the download option.');
        if (typeof window.downloadReceipt === 'function') {
          window.downloadReceipt(paymentId);
        }
        return;
      }
      
      // Write content to new window
      printWindow.document.open();
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      // Wait for content to load then print
      const attemptPrint = function() {
        try {
          if (printWindow && !printWindow.closed) {
            printWindow.focus();
            printWindow.print();
          }
        } catch (error) {
          console.error('Print error:', error);
          alert('Print dialog failed to open. The receipt is displayed in a new window.');
        }
      };
      
      // Close the print window after print/cancel
      printWindow.onafterprint = function() {
        try {
          printWindow.close();
        } catch (closeError) {
          // ignore
        }
      };
      
      printWindow.onload = function() {
        setTimeout(attemptPrint, 300);
      };
      
      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (printWindow && !printWindow.closed && printWindow.document.readyState === 'complete') {
          attemptPrint();
        }
      }, 600);
      
    } catch (windowError) {
      console.error('Error opening print window:', windowError);
      alert('Unable to open print window. Please check your browser settings or use the download option.');
    }
    
  } catch (error) {
    console.error('Error in printReceipt:', error);
    alert('An error occurred while trying to print the receipt. Please try again or contact support.');
  }
};

// Download receipt as HTML
window.downloadReceipt = function(paymentId) {
  const payment = getAllPayments().find(p => p.id === paymentId);
  if (!payment) {
    alert('Payment not found');
    return;
  }
  
  const invoice = payment.invoiceId ? getInvoiceById(payment.invoiceId) : null;
  const receiptHTML = generateReceiptHTML(payment, invoice);
  
  // Create download link
  const blob = new Blob([receiptHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Receipt-${payment.reference}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ==================== PAYMENT VALIDATION ====================

// Validate payment data
window.validatePaymentData = function(paymentData) {
  const errors = [];
  
  if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
    errors.push('Payment amount must be greater than zero');
  }
  
  if (!paymentData.method) {
    errors.push('Payment method is required');
  }
  
  if (!paymentData.patientId && !paymentData.patientName) {
    errors.push('Patient information is required');
  }
  
  if (paymentData.invoiceId) {
    const invoice = getInvoiceById(paymentData.invoiceId);
    if (!invoice) {
      errors.push('Invoice not found');
    } else if (invoice.status === 'cancelled') {
      errors.push('Cannot make payment to cancelled invoice');
    } else if (parseFloat(paymentData.amount) > invoice.amountDue) {
      errors.push(`Payment amount exceeds balance due (${formatCurrency(invoice.amountDue, invoice.currency)})`);
    }
  }
  
  return errors;
};

// ==================== PAYMENT PROCESSING ====================

// Process cash payment
window.processCashPayment = function(invoiceId, amount, receivedBy) {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) {
    alert('Invoice not found');
    return null;
  }
  
  const paymentData = {
    invoiceId: invoice.id,
    patientId: invoice.patientId,
    patientName: invoice.patientName,
    amount: amount,
    currency: invoice.currency,
    method: 'cash',
    date: new Date().toISOString().split('T')[0],
    status: 'completed',
    receivedBy: receivedBy || getCurrentUsername()
  };
  
  // Validate
  const errors = validatePaymentData(paymentData);
  if (errors.length > 0) {
    alert('Payment validation failed:\n' + errors.join('\n'));
    return null;
  }
  
  // Record payment
  const payment = recordPayment(paymentData);
  
  // Print receipt
  setTimeout(() => {
    if (confirm('Payment recorded successfully! Print receipt?')) {
      printReceipt(payment.id);
    }
  }, 100);
  
  return payment;
};

// Process partial payment
window.processPartialPayment = function(invoiceId, amount, method, methodDetails) {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) {
    alert('Invoice not found');
    return null;
  }
  
  if (amount > invoice.amountDue) {
    alert(`Payment amount (${formatCurrency(amount, invoice.currency)}) exceeds balance due (${formatCurrency(invoice.amountDue, invoice.currency)})`);
    return null;
  }
  
  const paymentData = {
    invoiceId: invoice.id,
    patientId: invoice.patientId,
    patientName: invoice.patientName,
    amount: amount,
    currency: invoice.currency,
    method: method || 'cash',
    methodDetails: methodDetails || '',
    date: new Date().toISOString().split('T')[0],
    status: 'completed',
    notes: 'Partial payment'
  };
  
  const payment = recordPayment(paymentData);
  
  alert(`Partial payment of ${formatCurrency(amount, invoice.currency)} recorded.\nRemaining balance: ${formatCurrency(invoice.amountDue, invoice.currency)}`);
  
  return payment;
};

// ==================== PAYMENT HISTORY ====================

// Get payment history for date range
window.getPaymentHistory = function(startDate, endDate, method) {
  let payments = getAllPayments();
  
  if (startDate) {
    payments = payments.filter(p => p.date >= startDate);
  }
  
  if (endDate) {
    payments = payments.filter(p => p.date <= endDate);
  }
  
  if (method) {
    payments = payments.filter(p => p.method === method);
  }
  
  return payments.sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Get today's payments
window.getTodaysPayments = function() {
  const today = new Date().toISOString().split('T')[0];
  return getPaymentHistory(today, today);
};

// Get payments summary by method
window.getPaymentsSummaryByMethod = function(startDate, endDate) {
  const payments = getPaymentHistory(startDate, endDate);
  const summary = {};
  
  payments.forEach(payment => {
    if (payment.status === 'completed') {
      if (!summary[payment.method]) {
        summary[payment.method] = {
          count: 0,
          total: 0,
          currency: payment.currency
        };
      }
      summary[payment.method].count++;
      summary[payment.method].total += payment.amount;
    }
  });
  
  return summary;
};

// ==================== VOID / REVERSAL ====================

// Process void (reversal of erroneous/duplicate payment - distinct from refund)
window.processVoid = async function(paymentId, reason) {
  const getAllPaymentsFn = window.getAllPayments;
  const getInvoiceByIdFn = window.getInvoiceById;
  const updateInvoiceFn = window.updateInvoice;
  if (typeof getAllPaymentsFn !== 'function') { alert('Billing module not loaded'); return null; }
  const payments = await getAllPaymentsFn();
  const payment = Array.isArray(payments) ? payments.find(p => p.id === paymentId) : null;
  if (!payment) {
    alert('Payment not found');
    return null;
  }
  if (payment.status === 'voided') {
    alert('Payment already voided');
    return null;
  }
  if (payment.status === 'refunded') {
    alert('Payment was refunded. Use refund workflow instead.');
    return null;
  }
  if (payment.amount <= 0) {
    alert('Cannot void zero or negative payment');
    return null;
  }
  if (!reason || String(reason).trim().length < 3) {
    alert('Please provide a reason for void (min 3 characters)');
    return null;
  }
  const invoice = payment.invoiceId ? await getInvoiceByIdFn(payment.invoiceId) : null;
  payment.status = 'voided';
  payment.voidedAt = new Date().toISOString();
  payment.voidedBy = getCurrentUsername();
  payment.voidReason = String(reason).trim();
  const paymentsList = Array.isArray(payments) ? [...payments] : [];
  const idx = paymentsList.findIndex(p => p.id === paymentId);
  if (idx >= 0) paymentsList[idx] = payment;
  const key = getBillingKey('payments');
  localStorage.setItem(key, JSON.stringify(paymentsList));
  if (window.supabaseClient && typeof window.resolveOrganizationId === 'function') {
    try {
      const orgId = await window.resolveOrganizationId();
      await window.supabaseClient.from('billing_payments')
        .update({ status: 'voided', voided_at: payment.voidedAt, voided_by: payment.voidedBy, void_reason: payment.voidReason })
        .eq('payment_id', paymentId).eq('organization_id', orgId);
    } catch (e) { console.warn('Supabase void update failed:', e); }
  }
  if (invoice) {
    invoice.amountPaid = Math.max(0, (parseFloat(invoice.amountPaid) || 0) - (parseFloat(payment.amount) || 0));
    invoice.amountDue = (parseFloat(invoice.total) || 0) - (parseFloat(invoice.amountPaid) || 0);
    invoice.status = invoice.amountPaid <= 0 ? 'pending' : (invoice.amountPaid >= invoice.total ? 'paid' : 'partial');
    if (typeof updateInvoiceFn === 'function') await updateInvoiceFn(invoice.id, invoice);
  }
  if (typeof logAuditEvent === 'function') {
    logAuditEvent('payment_voided', `Void ${payment.reference}: ${reason}`, { paymentId, amount: payment.amount, reason });
  }
  return payment;
};

// ==================== REFUNDS ====================

// Process refund
window.processRefund = function(paymentId, amount, reason) {
  const payment = getAllPayments().find(p => p.id === paymentId);
  if (!payment) {
    alert('Payment not found');
    return null;
  }
  
  if (payment.status === 'refunded') {
    alert('Payment already refunded');
    return null;
  }
  
  const refundAmount = amount || payment.amount;
  
  if (refundAmount > payment.amount) {
    alert('Refund amount cannot exceed original payment amount');
    return null;
  }
  
  // Create refund record
  const refundPayment = {
    id: Date.now().toString(),
    reference: `REF-${payment.reference}`,
    invoiceId: payment.invoiceId,
    patientId: payment.patientId,
    patientName: payment.patientName,
    amount: -refundAmount, // Negative amount
    currency: payment.currency,
    method: payment.method,
    methodDetails: payment.methodDetails,
    date: new Date().toISOString().split('T')[0],
    status: 'refunded',
    notes: `Refund for ${payment.reference}. Reason: ${reason}`,
    originalPaymentId: payment.id,
    receivedBy: getCurrentUsername(),
    createdAt: new Date().toISOString()
  };
  
  // Save refund
  const payments = getAllPayments();
  payments.push(refundPayment);
  
  const key = getBillingKey('payments');
  localStorage.setItem(key, JSON.stringify(payments));
  
  // Update original payment status
  payment.status = 'refunded';
  payment.refundedAmount = refundAmount;
  payment.refundDate = refundPayment.date;
  
  // Update invoice if applicable
  if (payment.invoiceId) {
    const invoice = getInvoiceById(payment.invoiceId);
    if (invoice) {
      invoice.amountPaid -= refundAmount;
      invoice.amountDue = invoice.total - invoice.amountPaid;
      
      if (invoice.amountPaid === 0) {
        invoice.status = 'pending';
      } else if (invoice.amountPaid < invoice.total) {
        invoice.status = 'partial';
      }
      
      updateInvoice(invoice.id, invoice);
    }
  }
  
  // Log audit event
  if (typeof logAuditEvent === 'function') {
    logAuditEvent('payment_refunded', `Refund ${refundPayment.reference} processed for ${formatCurrency(refundAmount, payment.currency)}`, {
      paymentId: payment.id,
      refundId: refundPayment.id,
      amount: refundAmount,
      reason: reason
    });
  }
  
  alert(`Refund of ${formatCurrency(refundAmount, payment.currency)} processed successfully`);
  return refundPayment;
};

// Helper function to get billing key
function getBillingKey(key) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  return `${org}_billing_${key}`;
}

// Helper function to get current username
function getCurrentUsername() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.username || 'Unknown';
}

console.log('Payments module loaded successfully');

