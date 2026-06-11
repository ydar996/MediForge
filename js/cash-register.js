// Purpose: Cash register management for MediForge billing
// Tracks daily cash operations, opening/closing balances

// ==================== STORAGE ====================

function getCashRegisterKey() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  return `${org}_billing_cash_register`;
}

// ==================== CASH REGISTER SESSIONS ====================

// Get all cash register sessions
window.getAllCashSessions = function() {
  const key = getCashRegisterKey();
  const sessions = localStorage.getItem(key);
  return sessions ? JSON.parse(sessions) : [];
};

// Save cash sessions
function saveCashSessions(sessions) {
  const key = getCashRegisterKey();
  localStorage.setItem(key, JSON.stringify(sessions));
}

// Get current (open) cash session
window.getCurrentCashSession = function() {
  const sessions = getAllCashSessions();
  return sessions.find(s => s.status === 'open');
};

// Open cash register
window.openCashRegister = async function(openingBalance, openedBy) {
  const currentSession = getCurrentCashSession();
  if (currentSession) {
    alert('Cash register is already open. Please close the current session first.');
    return null;
  }
  
  const sessions = getAllCashSessions();
  
  const openingBal = parseFloat(openingBalance) || 0;
  
  const session = {
    id: Date.now().toString(),
    date: new Date().toISOString().split('T')[0],
    openedAt: new Date().toISOString(),
    openedBy: openedBy || getCurrentUsername(),
    openingBalance: openingBal,
    closingBalance: null,
    expectedClosing: openingBal, // Initialize to opening balance
    discrepancy: null,
    totalCashIn: 0,
    totalCashOut: 0,
    totalTransactions: 0,
    status: 'open', // open, closed
    notes: '',
    closedAt: null,
    closedBy: null,
    transactions: []
  };
  
  sessions.push(session);
  saveCashSessions(sessions);
  
  console.log('Cash register opened:', session.id);
  
  // RETROACTIVELY add any cash payments made today before register was opened
  const today = new Date().toISOString().split('T')[0];
  const todaysCashPayments = (await getAllPayments()).filter(p => 
    p.date === today && 
    p.method === 'cash' && 
    p.status === 'completed'
  );
  
  console.log('Found', todaysCashPayments.length, 'cash payments made today before register opened');
  
  // Add them to the register
  todaysCashPayments.forEach(payment => {
    const description = `Payment ${payment.reference} - ${payment.patientName}`;
    console.log('Adding retroactive cash payment:', payment.reference, payment.amount);
    
    const transaction = {
      id: Date.now().toString() + '_' + Math.random(),
      type: 'in',
      amount: parseFloat(payment.amount),
      description: description,
      reference: payment.reference,
      timestamp: payment.createdAt || new Date().toISOString(),
      recordedBy: payment.receivedBy || 'System'
    };
    
    session.transactions.push(transaction);
    session.totalCashIn = (session.totalCashIn || 0) + transaction.amount;
    session.totalTransactions++;
  });
  
  // Recalculate expected closing with retroactive payments
  const opening = parseFloat(session.openingBalance) || 0;
  const cashIn = parseFloat(session.totalCashIn) || 0;
  const cashOut = parseFloat(session.totalCashOut) || 0;
  session.expectedClosing = opening + cashIn - cashOut;
  
  // Save updated session with retroactive payments
  const updatedSessions = getAllCashSessions();
  const sessionIndex = updatedSessions.findIndex(s => s.id === session.id);
  if (sessionIndex !== -1) {
    updatedSessions[sessionIndex] = session;
    saveCashSessions(updatedSessions);
    console.log('Session updated with retroactive payments. Expected closing:', session.expectedClosing);
  }
  
  // Log audit event
  if (typeof logAuditEvent === 'function') {
    logAuditEvent('cash_register_opened', `Cash register opened with balance ${formatCurrency(openingBalance, 'USD')}`, {
      sessionId: session.id,
      openingBalance: openingBalance,
      retroactivePayments: todaysCashPayments.length
    });
  }
  
  return session;
};

// Record cash transaction
window.recordCashTransaction = function(type, amount, description, reference) {
  const session = getCurrentCashSession();
  if (!session) {
    alert('No open cash session. Please open the cash register first.');
    return null;
  }
  
  const transaction = {
    id: Date.now().toString(),
    type: type, // 'in' or 'out'
    amount: parseFloat(amount),
    description: description || '',
    reference: reference || '',
    timestamp: new Date().toISOString(),
    recordedBy: getCurrentUsername()
  };
  
  session.transactions.push(transaction);
  
  if (type === 'in') {
    session.totalCashIn = (session.totalCashIn || 0) + transaction.amount;
  } else if (type === 'out') {
    session.totalCashOut = (session.totalCashOut || 0) + transaction.amount;
  }
  
  session.totalTransactions++;
  
  // Update expected closing balance (ensure all values are numbers)
  const opening = parseFloat(session.openingBalance) || 0;
  const cashIn = parseFloat(session.totalCashIn) || 0;
  const cashOut = parseFloat(session.totalCashOut) || 0;
  session.expectedClosing = opening + cashIn - cashOut;
  
  // Save - be more careful about finding and updating the session
  const sessions = getAllCashSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  
  if (index === -1) {
    console.error('Cash session not found in array! This should not happen.');
    // Add it if somehow missing
    sessions.push(session);
  } else {
    sessions[index] = session;
  }
  
  saveCashSessions(sessions);
  
  console.log('Cash transaction recorded:', transaction);
  console.log('Session after transaction:', {
    id: session.id,
    openingBalance: session.openingBalance,
    totalCashIn: session.totalCashIn,
    totalCashOut: session.totalCashOut,
    expectedClosing: session.expectedClosing
  });
  
  return transaction;
};

// Auto-record payment in cash register
window.autoRecordCashPayment = function(payment) {
  console.log('autoRecordCashPayment called with:', {
    method: payment.method,
    status: payment.status,
    amount: payment.amount,
    reference: payment.reference
  });
  
  if (payment.method === 'cash' && payment.status === 'completed') {
    // Auto-open register if not already open
    let session = getCurrentCashSession();
    console.log('Current cash session:', session ? 'EXISTS (id: ' + session.id + ')' : 'NONE - will auto-open');
    
    if (!session) {
      console.log('Auto-opening cash register for cash payment...');
      const lastSession = getAllCashSessions().filter(s => s.status === 'closed').pop();
      const openingBalance = lastSession ? lastSession.closingBalance : 0;
      session = openCashRegister(openingBalance, 'Auto-opened for cash payment');
      console.log('Cash register auto-opened with session id:', session ? session.id : 'FAILED');
    }
    
    const description = `Payment ${payment.reference} - ${payment.patientName}`;
    console.log('Recording cash transaction:', { type: 'in', amount: payment.amount, description });
    const result = recordCashTransaction('in', payment.amount, description, payment.reference);
    console.log('Cash transaction result:', result ? 'SUCCESS' : 'FAILED');
    return result;
  } else {
    console.log('Payment is not cash or not completed, skipping cash register recording');
  }
};

// Close cash register
window.closeCashRegister = function(actualClosingBalance, notes, closedBy) {
  const session = getCurrentCashSession();
  if (!session) {
    alert('No open cash session to close.');
    return null;
  }
  
  session.closingBalance = parseFloat(actualClosingBalance);
  session.expectedClosing = session.openingBalance + session.totalCashIn - session.totalCashOut;
  session.discrepancy = session.closingBalance - session.expectedClosing;
  session.status = 'closed';
  session.closedAt = new Date().toISOString();
  session.closedBy = closedBy || getCurrentUsername();
  session.notes = notes || '';
  
  // Save
  const sessions = getAllCashSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  sessions[index] = session;
  saveCashSessions(sessions);
  
  console.log('Cash register closed:', session.id);
  
  // Log audit event
  if (typeof logAuditEvent === 'function') {
    logAuditEvent('cash_register_closed', `Cash register closed. Expected: ${formatCurrency(session.expectedClosing, 'USD')}, Actual: ${formatCurrency(session.closingBalance, 'USD')}, Discrepancy: ${formatCurrency(session.discrepancy, 'USD')}`, {
      sessionId: session.id,
      expectedClosing: session.expectedClosing,
      actualClosing: session.closingBalance,
      discrepancy: session.discrepancy
    });
  }
  
  // Alert if discrepancy
  if (Math.abs(session.discrepancy) > 0.01) {
    alert(`Cash discrepancy detected!\nExpected: ${formatCurrency(session.expectedClosing, 'USD')}\nActual: ${formatCurrency(session.closingBalance, 'USD')}\nDifference: ${formatCurrency(session.discrepancy, 'USD')}`);
  }
  
  return session;
};

// Get cash session by ID
window.getCashSessionById = function(sessionId) {
  const sessions = getAllCashSessions();
  return sessions.find(s => s.id === sessionId);
};

// Update opening balance of a cash session
window.updateCashSessionOpeningBalance = function(sessionId, newOpeningBalance) {
  try {
    console.log('updateCashSessionOpeningBalance called:', { sessionId, newOpeningBalance, sessionIdType: typeof sessionId });
    
    const sessions = getAllCashSessions();
    console.log('Total sessions found:', sessions.length);
    
    // Ensure sessionId is a string for comparison
    const searchId = String(sessionId);
    const sessionIndex = sessions.findIndex(s => String(s.id) === searchId);
    
    console.log('Session search result:', { sessionIndex, searchId });
    
    if (sessionIndex === -1) {
      console.error('Cash session not found:', {
        searchId,
        availableSessionIds: sessions.map(s => ({ id: s.id, idType: typeof s.id }))
      });
      return false;
    }
    
    const session = sessions[sessionIndex];
    console.log('Found session:', { id: session.id, status: session.status, currentOpening: session.openingBalance });
    
    const oldOpening = parseFloat(session.openingBalance) || 0;
    const newOpening = parseFloat(newOpeningBalance) || 0;
    
    // Update opening balance
    session.openingBalance = newOpening;
    
    // Recalculate expected closing balance
    const cashIn = parseFloat(session.totalCashIn) || 0;
    const cashOut = parseFloat(session.totalCashOut) || 0;
    session.expectedClosing = newOpening + cashIn - cashOut;
    
    // If session is closed, recalculate discrepancy
    if (session.status === 'closed' && session.closingBalance !== null) {
      session.discrepancy = session.closingBalance - session.expectedClosing;
    }
    
    // Save updated session
    sessions[sessionIndex] = session;
    
    try {
      saveCashSessions(sessions);
      console.log('✅ Sessions saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving sessions:', saveError);
      return false;
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('cash_session_opening_balance_updated', `Opening balance updated from ${oldOpening} to ${newOpening} for session ${sessionId}`, {
        sessionId: sessionId,
        oldOpeningBalance: oldOpening,
        newOpeningBalance: newOpening
      });
    }
    
    console.log('✅ Opening balance updated successfully:', { sessionId, oldOpening, newOpening });
    return true;
    
  } catch (error) {
    console.error('❌ Error in updateCashSessionOpeningBalance:', error);
    console.error('Error stack:', error.stack);
    return false;
  }
};

// Delete a transaction from a cash session
window.deleteCashTransaction = function(sessionId, transactionId) {
  try {
    const sessions = getAllCashSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) {
      console.error('Cash session not found:', sessionId);
      return false;
    }
    
    const session = sessions[sessionIndex];
    const transactionIndex = session.transactions.findIndex(t => t.id === transactionId);
    
    if (transactionIndex === -1) {
      console.error('Transaction not found:', transactionId);
      return false;
    }
    
    const transaction = session.transactions[transactionIndex];
    
    // Reverse the transaction's impact on totals
    if (transaction.type === 'in') {
      session.totalCashIn = (session.totalCashIn || 0) - transaction.amount;
    } else if (transaction.type === 'out') {
      session.totalCashOut = (session.totalCashOut || 0) - transaction.amount;
    }
    
    session.totalTransactions = (session.totalTransactions || 0) - 1;
    
    // Remove transaction
    session.transactions.splice(transactionIndex, 1);
    
    // Recalculate expected closing balance
    const opening = parseFloat(session.openingBalance) || 0;
    const cashIn = parseFloat(session.totalCashIn) || 0;
    const cashOut = parseFloat(session.totalCashOut) || 0;
    session.expectedClosing = opening + cashIn - cashOut;
    
    // If session is closed, recalculate discrepancy
    if (session.status === 'closed' && session.closingBalance !== null) {
      session.discrepancy = session.closingBalance - session.expectedClosing;
    }
    
    // Save updated session
    sessions[sessionIndex] = session;
    saveCashSessions(sessions);
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('cash_transaction_deleted', `Cash transaction ${transactionId} deleted from session ${sessionId}`, {
        sessionId: sessionId,
        transactionId: transactionId,
        amount: transaction.amount,
        type: transaction.type
      });
    }
    
    console.log('Cash transaction deleted:', transactionId);
    return true;
    
  } catch (error) {
    console.error('❌ Error in deleteCashTransaction:', error);
    return false;
  }
};

// Get all transactions from all sessions (historical) - INCLUDES cash payments from getAllPayments
window.getAllCashTransactions = async function(startDate, endDate) {
  let sessions = getAllCashSessions();
  
  // Filter by date range if provided
  if (startDate) {
    sessions = sessions.filter(s => s.date >= startDate);
  }
  if (endDate) {
    sessions = sessions.filter(s => s.date <= endDate);
  }
  
  // Flatten all transactions with session info
  const allTransactions = [];
  sessions.forEach(session => {
    if (session.transactions && Array.isArray(session.transactions)) {
      session.transactions.forEach(tx => {
        allTransactions.push({
          ...tx,
          sessionId: session.id,
          sessionDate: session.date,
          sessionStatus: session.status
        });
      });
    }
  });
  
  // ALSO include cash payments from getAllPayments that might not be in sessions
  // This ensures historical payments show up even if register wasn't open
  try {
    const allPayments = await getAllPayments();
    console.log('🔍 getAllCashTransactions: Checking', allPayments.length, 'payments from getAllPayments()');
    
    // Debug: Log all payments to see their structure
    if (allPayments.length > 0) {
      console.log('🔍 Sample payment structure:', allPayments[0]);
      console.log('🔍 Payment fields:', {
        method: allPayments[0].method,
        paymentMethod: allPayments[0].paymentMethod,
        status: allPayments[0].status,
        date: allPayments[0].date,
        paymentDate: allPayments[0].paymentDate,
        amount: allPayments[0].amount,
        patientName: allPayments[0].patientName,
        reference: allPayments[0].reference
      });
    }
    
    const cashPayments = allPayments.filter(p => {
      // Only include cash payments - check multiple field names
      const paymentMethod = (p.method || p.paymentMethod || '').toLowerCase();
      const isCash = paymentMethod === 'cash';
      const isCompleted = (p.status || '').toLowerCase() === 'completed';
      
      if (!isCash) {
        console.log('🔍 Payment filtered out (not cash):', {
          reference: p.reference || p.id,
          method: p.method,
          paymentMethod: p.paymentMethod
        });
        return false;
      }
      
      if (!isCompleted) {
        console.log('🔍 Payment filtered out (not completed):', {
          reference: p.reference || p.id,
          status: p.status
        });
        return false;
      }
      
      // Filter by date range if provided - handle multiple date field names
      const paymentDate = p.date || p.paymentDate || p.payment_date;
      if (!paymentDate) {
        console.log('🔍 Payment filtered out (no date):', {
          reference: p.reference || p.id,
          dateFields: { date: p.date, paymentDate: p.paymentDate, payment_date: p.payment_date }
        });
        return false;
      }
      
      // Date filtering
      if (startDate && paymentDate < startDate) {
        console.log('🔍 Payment filtered out (before start date):', {
          reference: p.reference || p.id,
          paymentDate,
          startDate
        });
        return false;
      }
      if (endDate && paymentDate > endDate) {
        console.log('🔍 Payment filtered out (after end date):', {
          reference: p.reference || p.id,
          paymentDate,
          endDate
        });
        return false;
      }
      
      // Check if this payment is already in transactions (by reference)
      const alreadyInTransactions = allTransactions.some(tx => 
        tx.reference === p.reference || 
        tx.reference === p.id ||
        tx.reference === String(p.id) ||
        (p.reference && tx.description && tx.description.includes(p.reference))
      );
      
      if (alreadyInTransactions) {
        console.log('🔍 Payment filtered out (already in transactions):', {
          reference: p.reference || p.id
        });
        return false;
      }
      
      console.log('✅ Payment included:', {
        reference: p.reference || p.id,
        patientName: p.patientName,
        amount: p.amount,
        date: paymentDate,
        method: paymentMethod
      });
      
      return true; // Include this payment
    });
    
    // Add cash payments as transactions
    cashPayments.forEach(payment => {
      const paymentDate = payment.date || payment.paymentDate;
      const paymentTime = payment.createdAt || payment.payment_date || new Date().toISOString();
      
      allTransactions.push({
        id: 'payment_' + (payment.id || payment.payment_id || Date.now()),
        type: 'in',
        amount: parseFloat(payment.amount || 0),
        description: `Payment ${payment.reference || payment.id || 'N/A'} - ${payment.patientName || 'Unknown Patient'}`,
        reference: payment.reference || payment.id || 'N/A',
        timestamp: paymentTime,
        recordedBy: payment.receivedBy || 'System',
        sessionId: 'external_payment', // Mark as external payment not tied to a session
        sessionDate: paymentDate,
        sessionStatus: 'closed' // Historical payments are always from closed periods
      });
    });
    
    console.log('getAllCashTransactions: Found', allTransactions.length, 'total transactions');
    console.log('  - From cash register sessions:', sessions.length, 'sessions with', allTransactions.filter(tx => tx.sessionId !== 'external_payment').length, 'transactions');
    console.log('  - From getAllPayments():', allPayments.length, 'total payments,', cashPayments.length, 'cash payments included');
    
    if (cashPayments.length === 0 && allPayments.length > 0) {
      console.warn('⚠️ WARNING: Found', allPayments.length, 'payments but 0 cash payments. Checking payment methods...');
      const methodBreakdown = {};
      allPayments.forEach(p => {
        const method = (p.method || p.paymentMethod || 'unknown').toLowerCase();
        methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
      });
      console.log('Payment method breakdown:', methodBreakdown);
      
      // Also check date filtering
      console.log('Date range filter:', { startDate, endDate });
      allPayments.forEach(p => {
        const paymentDate = p.date || p.paymentDate;
        const isInRange = (!startDate || paymentDate >= startDate) && (!endDate || paymentDate <= endDate);
        console.log('Payment', p.reference || p.id, '- Date:', paymentDate, '- In range:', isInRange, '- Method:', p.method || p.paymentMethod);
      });
    }
  } catch (error) {
    console.error('Error loading cash payments for historical view:', error);
  }
  
  // Sort by timestamp (newest first)
  return allTransactions.sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return dateB - dateA;
  });
};

// Get cash sessions by date range
window.getCashSessionsByDateRange = function(startDate, endDate) {
  let sessions = getAllCashSessions();
  
  if (startDate) {
    sessions = sessions.filter(s => s.date >= startDate);
  }
  
  if (endDate) {
    sessions = sessions.filter(s => s.date <= endDate);
  }
  
  return sessions.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
};

// Get today's cash session
window.getTodaysCashSession = function() {
  const today = new Date().toISOString().split('T')[0];
  const sessions = getAllCashSessions();
  return sessions.find(s => s.date === today);
};

// ==================== CASH MANAGEMENT ====================

// Get current cash on hand
window.getCurrentCashOnHand = function() {
  const session = getCurrentCashSession();
  if (!session) return 0;
  
  return session.openingBalance + session.totalCashIn - session.totalCashOut;
};

// Cash drawer reconciliation
window.performCashReconciliation = async function() {
  const session = getCurrentCashSession();
  if (!session) {
    return {
      error: 'No open cash session'
    };
  }
  
  // Get today's cash payments
  const today = new Date().toISOString().split('T')[0];
  const payments = (await getAllPayments()).filter(p => 
    p.method === 'cash' &&
    p.status === 'completed' &&
    p.date === today
  );
  
  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  
  return {
    sessionId: session.id,
    openingBalance: session.openingBalance,
    cashPayments: payments.length,
    paymentsTotal: paymentsTotal,
    totalCashIn: session.totalCashIn,
    totalCashOut: session.totalCashOut,
    expectedBalance: session.openingBalance + session.totalCashIn - session.totalCashOut,
    payments: payments
  };
};

// ==================== CASH FLOW TRACKING ====================

// Get cash flow summary
window.getCashFlowSummary = function(startDate, endDate) {
  const sessions = getCashSessionsByDateRange(startDate, endDate);
  
  const summary = {
    totalSessions: sessions.length,
    openSessions: sessions.filter(s => s.status === 'open').length,
    closedSessions: sessions.filter(s => s.status === 'closed').length,
    totalCashIn: 0,
    totalCashOut: 0,
    totalDiscrepancies: 0,
    averageDiscrepancy: 0,
    largestDiscrepancy: 0
  };
  
  sessions.forEach(session => {
    summary.totalCashIn += session.totalCashIn;
    summary.totalCashOut += session.totalCashOut;
    
    if (session.discrepancy !== null) {
      summary.totalDiscrepancies += Math.abs(session.discrepancy);
      if (Math.abs(session.discrepancy) > Math.abs(summary.largestDiscrepancy)) {
        summary.largestDiscrepancy = session.discrepancy;
      }
    }
  });
  
  if (summary.closedSessions > 0) {
    summary.averageDiscrepancy = summary.totalDiscrepancies / summary.closedSessions;
  }
  
  return summary;
};

// ==================== HELPERS ====================

function getCurrentUsername() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.username || 'Unknown';
}

// ==================== AUTO OPEN/CLOSE ====================

// Sync missing cash payments to existing session
async function syncMissingCashPayments(session) {
  console.log('Checking for missing cash payments to sync...');
  
  const today = new Date().toISOString().split('T')[0];
  const todaysCashPayments = (await getAllPayments()).filter(p => 
    p.date === today && 
    p.method === 'cash' && 
    p.status === 'completed'
  );
  
  console.log('Found', todaysCashPayments.length, 'total cash payments today');
  
  // Check which payments are NOT in the register
  const existingReferences = session.transactions.map(t => t.reference);
  const missingPayments = todaysCashPayments.filter(p => !existingReferences.includes(p.reference));
  
  console.log('Missing from register:', missingPayments.length, 'payments');
  
  if (missingPayments.length === 0) {
    console.log('All cash payments already in register, no sync needed');
    return;
  }
  
  // Add missing payments
  missingPayments.forEach(payment => {
    const description = `Payment ${payment.reference} - ${payment.patientName}`;
    console.log('SYNCING missing cash payment:', payment.reference, payment.amount);
    
    const transaction = {
      id: Date.now().toString() + '_' + Math.random(),
      type: 'in',
      amount: parseFloat(payment.amount),
      description: description,
      reference: payment.reference,
      timestamp: payment.createdAt || new Date().toISOString(),
      recordedBy: payment.receivedBy || 'System'
    };
    
    session.transactions.push(transaction);
    session.totalCashIn = (session.totalCashIn || 0) + transaction.amount;
    session.totalTransactions++;
  });
  
  // Recalculate expected closing
  const opening = parseFloat(session.openingBalance) || 0;
  const cashIn = parseFloat(session.totalCashIn) || 0;
  const cashOut = parseFloat(session.totalCashOut) || 0;
  session.expectedClosing = opening + cashIn - cashOut;
  
  // Save updated session
  const sessions = getAllCashSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index !== -1) {
    sessions[index] = session;
    saveCashSessions(sessions);
    console.log('✓ Session synced with', missingPayments.length, 'missing payments. New expected closing:', session.expectedClosing);
  }
}

// Check if should auto-open cash register (daily at midnight)
window.checkAutoOpenCashRegister = async function() {
  console.log('checkAutoOpenCashRegister called...');
  
  const currentSession = getCurrentCashSession();
  if (currentSession) {
    console.log('Cash register already open, session id:', currentSession.id);
    
    // Check if there are cash payments not in the register (retroactive sync)
    await syncMissingCashPayments(currentSession);
    
    return null; // Already open
  }
  
  const today = new Date().toISOString().split('T')[0];
  const todaysSession = getTodaysCashSession();
  
  console.log('Todays session check:', todaysSession ? 'EXISTS (status: ' + todaysSession.status + ', closedBy: ' + todaysSession.closedBy + ')' : 'NONE');
  
  // If today's session already exists and was manually closed, respect that
  if (todaysSession && todaysSession.status === 'closed' && todaysSession.closedBy !== 'System') {
    console.log('User manually closed today, not reopening');
    return null; // User manually closed, don't reopen
  }
  
  // Auto-open for today with previous day's closing balance
  const allSessions = getAllCashSessions();
  console.log('Total cash sessions in database:', allSessions.length);
  
  const lastSession = allSessions.filter(s => s.status === 'closed').pop();
  const openingBalance = lastSession ? lastSession.closingBalance : 0;
  
  console.log('Auto-opening cash register for today with opening balance:', openingBalance);
  const newSession = openCashRegister(openingBalance, 'Auto-opened');
  console.log('Auto-open result:', newSession ? 'SUCCESS (id: ' + newSession.id + ')' : 'FAILED');
  
  return newSession;
};

// Check if should auto-close cash register (daily at 11:59 PM)
window.checkAutoCloseCashRegister = function() {
  const currentSession = getCurrentCashSession();
  if (!currentSession) return null; // Not open
  
  // Check if it's a new day (session date is yesterday)
  const today = new Date().toISOString().split('T')[0];
  if (currentSession.date !== today) {
    // It's a new day and old session is still open, auto-close it
    console.log('Auto-closing previous day cash register...');
    return closeCashRegister(currentSession.expectedClosing, 'Auto-closed at midnight', 'System');
  }
  
  return null;
};

// Initialize cash register with auto-open/close checks
window.initializeCashRegister = async function() {
  console.log('Initializing cash register...');
  
  // Check if should auto-open
  await checkAutoOpenCashRegister();
  
  // Check if should auto-close (in case user left it open overnight)
  checkAutoCloseCashRegister();
  
  console.log('Cash register initialization complete');
};

console.log('Cash register module loaded successfully');

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    setTimeout(initializeCashRegister, 100);
  });
}

