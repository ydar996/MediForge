// Purpose: Billing reports and analytics for MediForge
// Generates financial reports, cash flow, revenue analysis

// ==================== REVENUE REPORTS ====================

// Get revenue report for date range
window.getRevenueReport = async function(startDate, endDate) {
  try {
    const getStatsFn = window.getBillingStats || getBillingStats;
    if (typeof getStatsFn !== 'function') {
      console.error('getBillingStats function not available');
      return getDefaultRevenueReport(startDate, endDate);
    }
    
    const stats = await getStatsFn(startDate, endDate) || {};
    const getAllInvoicesFn = window.getAllInvoices || getAllInvoices;
    const allInvoices = await getAllInvoicesFn();
    const invoices = Array.isArray(allInvoices) ? allInvoices.filter(inv => {
      if (!inv || !inv.date) return false;
      if (startDate && inv.date < startDate) return false;
      if (endDate && inv.date > endDate) return false;
      return true;
    }) : [];
    
    return {
      period: { startDate, endDate },
      totalInvoices: stats.totalInvoices || 0,
      totalRevenue: stats.totalRevenue || 0,
      totalCollected: stats.totalPaid || 0,
      totalOutstanding: stats.totalOutstanding || 0,
      collectionRate: (stats.totalRevenue && stats.totalRevenue > 0) ? ((stats.totalPaid || 0) / stats.totalRevenue * 100).toFixed(1) : 0,
      averageInvoiceValue: (stats.totalInvoices && stats.totalInvoices > 0) ? ((stats.totalRevenue || 0) / stats.totalInvoices) : 0,
      paidInvoices: stats.paidInvoices || 0,
      pendingInvoices: stats.pendingInvoices || 0,
      overdueInvoices: stats.overdueInvoices || 0,
      invoicesByStatus: {
        paid: stats.paidInvoices || 0,
        pending: stats.pendingInvoices || 0,
        overdue: stats.overdueInvoices || 0,
        partial: stats.partialInvoices || 0
      },
      paymentsByMethod: {
        cash: { count: stats.cashPayments || 0, amount: stats.cashAmount || 0 },
        mobile_money: { count: stats.mobilePayments || 0, amount: stats.mobileAmount || 0 },
        card: { count: stats.cardPayments || 0, amount: stats.cardAmount || 0 },
        bank_transfer: { count: stats.bankPayments || 0, amount: stats.bankAmount || 0 },
        check: { count: stats.checkPayments || 0, amount: stats.checkAmount || 0 }
      }
    };
  } catch (error) {
    console.error('Error generating revenue report:', error);
    return getDefaultRevenueReport(startDate, endDate);
  }
};

function getDefaultRevenueReport(startDate, endDate) {
  return {
    period: { startDate, endDate },
    totalInvoices: 0,
    totalRevenue: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    collectionRate: 0,
    averageInvoiceValue: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    invoicesByStatus: {
      paid: 0,
      pending: 0,
      overdue: 0,
      partial: 0
    },
    paymentsByMethod: {
      cash: { count: 0, amount: 0 },
      mobile_money: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      bank_transfer: { count: 0, amount: 0 },
      check: { count: 0, amount: 0 }
    }
  };
}

// Get revenue by service category
window.getRevenueByCategory = async function(startDate, endDate) {
  const allInvoices = await getAllInvoices();
  const invoices = Array.isArray(allInvoices) ? allInvoices.filter(inv => {
    if (startDate && inv.date < startDate) return false;
    if (endDate && inv.date > endDate) return false;
    return true;
  }) : [];
  
  const categoryRevenue = {};
  
  invoices.forEach(invoice => {
    if (!invoice || !invoice.services || !Array.isArray(invoice.services)) {
      return;
    }
    
    const getCatalogFn = window.getPricingCatalog || getPricingCatalog;
    const catalog = typeof getCatalogFn === 'function' ? getCatalogFn() : [];
    
    invoice.services.forEach(service => {
      if (!service) return;
      
      const serviceInfo = catalog.find(s => s.id === service.id || s.code === service.code);
      const category = serviceInfo ? serviceInfo.category : 'Other';
      
      if (!categoryRevenue[category]) {
        categoryRevenue[category] = { revenue: 0, count: 0 };
      }
      
      categoryRevenue[category].revenue += (service.quantity || 0) * (service.price || 0);
      categoryRevenue[category].count += service.quantity || 0;
    });
  });
  
  return categoryRevenue;
};

// Get top revenue services
window.getTopServices = async function(startDate, endDate, limit = 10) {
  const getAllInvoicesFn = window.getAllInvoices || getAllInvoices;
  const allInvoices = await getAllInvoicesFn();
  const invoices = Array.isArray(allInvoices) ? allInvoices.filter(inv => {
    if (!inv || !inv.date) return false;
    if (startDate && inv.date < startDate) return false;
    if (endDate && inv.date > endDate) return false;
    return true;
  }) : [];
  
  const serviceRevenue = {};
  
  invoices.forEach(invoice => {
    if (!invoice || !invoice.services || !Array.isArray(invoice.services)) {
      return;
    }
    
    invoice.services.forEach(service => {
      if (!service || !service.code) {
        return;
      }
      
      if (!serviceRevenue[service.code]) {
        serviceRevenue[service.code] = {
          name: service.name || 'Unknown',
          code: service.code,
          revenue: 0,
          count: 0
        };
      }
      
      serviceRevenue[service.code].revenue += (service.quantity || 0) * (service.price || 0);
      serviceRevenue[service.code].count += service.quantity || 0;
    });
  });
  
  return Object.values(serviceRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
};

// ==================== AGING REPORT ====================

function getDefaultAgingReport() {
  return {
    current: [],
    days30: [],
    days60: [],
    days90plus: [],
    totals: {
      current: 0,
      days30: 0,
      days60: 0,
      days90plus: 0,
      total: 0
    }
  };
}

// Get accounts receivable aging
window.getAgingReport = async function() {
  try {
    const getOutstandingFn = window.getOutstandingInvoices || getOutstandingInvoices;
    if (typeof getOutstandingFn !== 'function') {
      return getDefaultAgingReport();
    }
    
    const outstanding = await getOutstandingFn();
    if (!Array.isArray(outstanding)) {
      return getDefaultAgingReport();
    }
    
    const today = new Date();
    
    const aging = {
      current: [],      // 0-30 days
      days30: [],       // 31-60 days
      days60: [],       // 61-90 days
      days90plus: [],   // 90+ days
      totals: {
        current: 0,
        days30: 0,
        days60: 0,
        days90plus: 0,
        total: 0
      }
    };
    
    outstanding.forEach(invoice => {
      if (!invoice) return;
      
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : (invoice.date ? new Date(invoice.date) : today);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      
      const item = {
        invoiceNumber: invoice.invoiceNumber || invoice.id || 'N/A',
        patientName: invoice.patientName || 'Unknown',
        invoiceDate: invoice.date || 'N/A',
        dueDate: invoice.dueDate || invoice.date || 'N/A',
        amountDue: invoice.amountDue || 0,
        daysOverdue: daysOverdue
      };
      
      const amountDue = invoice.amountDue || 0;
      
      if (daysOverdue <= 30) {
        aging.current.push(item);
        aging.totals.current += amountDue;
      } else if (daysOverdue <= 60) {
        aging.days30.push(item);
        aging.totals.days30 += amountDue;
      } else if (daysOverdue <= 90) {
        aging.days60.push(item);
        aging.totals.days60 += amountDue;
      } else {
        aging.days90plus.push(item);
        aging.totals.days90plus += amountDue;
      }
      
      aging.totals.total += amountDue;
    });
    
    return aging;
  } catch (error) {
    console.error('Error generating aging report:', error);
    return getDefaultAgingReport();
  }
};

// ==================== CASH FLOW REPORT ====================

// Get daily cash flow
window.getDailyCashFlow = function(startDate, endDate) {
  try {
    const cashFlow = {};
    
    const getAllPaymentsFn = window.getAllPayments || getAllPayments;
    if (typeof getAllPaymentsFn !== 'function') {
      return [];
    }
    
    let allPayments = getAllPaymentsFn();
    if (!Array.isArray(allPayments)) {
      return [];
    }
    
    // Filter by date range if provided
    if (startDate) {
      allPayments = allPayments.filter(pay => pay.date >= startDate);
    }
    if (endDate) {
      allPayments = allPayments.filter(pay => pay.date <= endDate);
    }
    
    allPayments.forEach(payment => {
      if (!payment) return;
      if (payment.status !== 'completed') return;
      if (!payment.date) return;
      
      if (!cashFlow[payment.date]) {
        cashFlow[payment.date] = {
          date: payment.date,
          cashIn: 0,
          cashPayments: 0,
          mobilePayments: 0,
          cardPayments: 0,
          otherPayments: 0,
          totalPayments: 0
        };
      }
      
      const amount = payment.amount || 0;
      cashFlow[payment.date].cashIn += amount;
      cashFlow[payment.date].totalPayments++;
      
      if (payment.method === 'cash') {
        cashFlow[payment.date].cashPayments += amount;
      } else if (payment.method === 'mobile_money') {
        cashFlow[payment.date].mobilePayments += amount;
      } else if (payment.method === 'card') {
        cashFlow[payment.date].cardPayments += amount;
      } else {
        cashFlow[payment.date].otherPayments += amount;
      }
    });
    
    return Object.values(cashFlow).sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return a.date.localeCompare(b.date);
    });
  } catch (error) {
    console.error('Error generating cash flow report:', error);
    return [];
  }
};

// ==================== EXPORT FUNCTIONS ====================

// Export report to CSV
window.exportReportToCSV = function(reportData, filename) {
  let csv = '';
  
  // Convert object/array to CSV
  if (Array.isArray(reportData)) {
    if (reportData.length === 0) return;
    
    // Headers
    const headers = Object.keys(reportData[0]);
    csv = headers.join(',') + '\n';
    
    // Rows
    reportData.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    });
  } else {
    // Simple key-value pairs
    for (const [key, value] of Object.entries(reportData)) {
      csv += `${key},${value}\n`;
    }
  }
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'report.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ==================== DASHBOARD METRICS ====================

// Get key metrics for dashboard
window.getBillingDashboardMetrics = function() {
  const today = new Date().toISOString().split('T')[0];
  const todayStats = getBillingStats(today, today);
  const allStats = getBillingStats();
  
  return {
    today: {
      revenue: todayStats.totalPaid,
      invoices: todayStats.totalInvoices,
      payments: todayStats.cashPayments + todayStats.mobilePayments + todayStats.cardPayments
    },
    overall: {
      totalOutstanding: allStats.totalOutstanding,
      overdueInvoices: allStats.overdueInvoices,
      pendingInvoices: allStats.pendingInvoices
    },
    cashOnHand: getCurrentCashOnHand()
  };
};

console.log('Billing reports module loaded successfully');

