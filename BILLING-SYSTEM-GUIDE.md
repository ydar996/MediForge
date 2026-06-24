# 💰 MediForge Billing: User Guide

**Last updated:** May 2026  
**Audience:** Receptionists, cashiers, billers, and clinic managers.

> **Start here for everyday use:** [User Manual](docs/USER-MANUAL.md) → section 7 (Billing), or open [user-manual.html](user-manual.html) on your site.  
> This guide has **extra billing detail** (workflows, reports, void payments, general ledger).

---

## Quick start (most common)

**Walk-in patient pays at the desk:**

1. Dashboard → **Billing & Payments** → **Quick Checkout**
2. Find the patient → add services → **Cash** (or mobile money) → print receipt

**Time:** about 1–2 minutes.

---

## 📋 WHAT'S BEEN BUILT (reference)

### ✅ **Core Modules (5 JavaScript files)**
1. **`js/billing.js`** - Core billing engine (invoices, payments, statistics)
2. **`js/pricing.js`** - Service pricing catalog with 16 default services
3. **`js/payments.js`** - Payment processing & receipt generation  
4. **`js/cash-register.js`** - Daily cash tracking & reconciliation
5. **`js/billing-reports.js`** - Comprehensive financial reporting

### ✅ **User Interface (10 HTML pages)**
1. **`billing-dashboard.html`** - Main billing hub with statistics
2. **`quick-checkout.html`** - **⭐ Fast cash checkout (< 2 minutes)**
3. **`invoices.html`** - View and search all invoices
4. **`invoice-details.html`** - Detailed invoice view with payments
5. **`payments.html`** - Record payments manually
6. **`all-payments.html`** - View all payments (includes Void button)
7. **`cash-register.html`** - Open/close daily cash register
8. **`pricing-catalog.html`** - Manage service prices
9. **`billing-reports.html`** - Financial reports & analytics
10. **`gl-dashboard.html`** - General Ledger (income by account)

### ✅ **Data & Configuration**
1. **`data/african-billing-config.json`** - 40+ African currencies & tax rates for all countries

### ✅ **Integration**
- ✅ Added "💰 Billing & Payments" button to main dashboard
- ✅ Service worker updated (v222) to cache all billing files
- ✅ Offline-capable (works without internet)

---

## 🚀 HOW TO USE THE BILLING SYSTEM

### **QUICK START (Cash Patient Workflow)**

#### Option 1: Quick Checkout (Recommended for 70% cash patients)
```
Dashboard → Billing & Payments → Quick Checkout

1. Search and select patient
2. Add services (quick buttons or search)
3. Apply discount (optional)
4. Click "💵 Cash Payment"
5. Print receipt
Done! (< 2 minutes)
```

#### Option 2: Create Invoice First
```
Dashboard → Billing & Payments → Create Invoice

1. Select patient
2. Add services
3. Save invoice
4. Record payment later
```

---

## 📊 KEY FEATURES

### **1. CASH-FIRST DESIGN**
- ✅ Quick checkout optimized for walk-in cash patients
- ✅ Instant receipt generation
- ✅ Cash register tracking (opening/closing balance)
- ✅ Cash reconciliation with discrepancy detection

### **2. MULTI-CURRENCY SUPPORT**
**40+ African Currencies Configured:**
- 🇰🇪 Kenya (KES - KSh)
- 🇳🇬 Nigeria (NGN - ₦)
- 🇿🇦 South Africa (ZAR - R)
- 🇬🇭 Ghana (GHS - GH₵)
- 🇹🇿 Tanzania (TZS - TSh)
- 🇺🇬 Uganda (UGX - USh)
- 🇷🇼 Rwanda (RWF - RF)
- 🇪🇬 Egypt (EGP - E£)
- 🇲🇦 Morocco (MAD)
- And 30+ more!

**Tax Rates Configured:**
- South Africa: 15% VAT
- Kenya: 16% VAT
- Nigeria: 7.5% VAT
- Ghana: 12.5% VAT + 2.5% Health Tax
- And more...

### **3. PAYMENT METHODS**
- 💵 **Cash** (Priority - auto-records in cash register)
- 📱 **Mobile Money** (M-Pesa, MTN, Airtel, etc.)
- 💳 **Card** (via Paystack/Flutterwave - integration ready)
- 🏦 **Bank Transfer**
- 📝 **Check/Cheque**

### **4. INVOICING**
- ✅ Automatic invoice numbering (INV-2024-00001, etc.)
- ✅ Invoice status tracking (Pending, Paid, Overdue, Partial)
- ✅ Due date management
- ✅ Discount support with reason tracking
- ✅ Tax calculation (VAT/sales tax)
- ✅ Print-friendly invoices

### **5. RECEIPTS**
- ✅ Auto-generated receipt numbers (PAY-2024-00001, etc.)
- ✅ Professional receipt format
- ✅ Auto-print on payment
- ✅ Downloadable HTML receipts
- ✅ Shows payment method, reference, balance due

### **6. CASH REGISTER**
- ✅ Open register with opening balance
- ✅ Auto-records all cash payments
- ✅ Manual cash in/out transactions
- ✅ Real-time balance tracking
- ✅ Close register with actual count
- ✅ Discrepancy detection & alerts
- ✅ Complete transaction history

### **7. SERVICE CATALOG**
**16 Pre-configured Services:**
- General Consultation ($50)
- Specialist Consultation ($100)
- Follow-up Visit ($30)
- Wound Dressing ($25)
- Suturing ($75)
- Minor Surgery ($200)
- Complete Blood Count ($40)
- Malaria Test ($15)
- Blood Glucose ($20)
- Urinalysis ($25)
- X-Ray Single View ($60)
- Ultrasound ($80)
- COVID-19 Vaccine ($25)
- Flu Vaccine ($20)
- Medical Certificate ($15)
- Prescription Refill ($10)

**Features:**
- ✅ Add/edit/deactivate services
- ✅ Service categories (Consultation, Lab, Imaging, etc.)
- ✅ Quick-add buttons for frequent services
- ✅ Searchable catalog
- ✅ Taxable/non-taxable designation

### **8. COMPREHENSIVE REPORTS**

#### **Revenue Report:**
- Total Revenue
- Total Collected
- Outstanding Balance
- Collection Rate (%)
- Average Invoice Value
- Invoice count by status

#### **Payment Methods Breakdown:**
- Count and amount by method
- Percentage distribution
- Cash vs. Mobile vs. Card analysis

#### **Top 10 Services:**
- Revenue ranking
- Service usage count
- Best-performing services

#### **Accounts Receivable Aging:**
- 0-30 days
- 31-60 days
- 61-90 days
- 90+ days (urgent follow-up)
- Detailed patient-by-patient breakdown

#### **Daily Cash Flow:**
- Cash collected per day
- Payment method breakdown
- Transaction counts
- Date range filtering

#### **Export Features:**
- ✅ Export all reports to CSV
- ✅ Date range filtering
- ✅ Import into Excel/Google Sheets

---

## 💡 WORKFLOWS

### **Workflow 1: Walk-In Cash Patient (Most Common - 70%)**
```
1. Patient arrives & sees doctor
2. Receptionist opens Quick Checkout
3. Searches patient name
4. Clicks quick-add services OR searches specific services
5. Applies discount if needed
6. Clicks "💵 Cash Payment"
7. Collects cash from patient
8. Prints receipt
9. Done!

Time: 1-2 minutes
```

### **Workflow 2: Mobile Money Payment**
```
1. Follow steps 1-5 above
2. Click "📱 Mobile Money"
3. Patient pays via M-Pesa on their phone
4. Enter M-Pesa transaction code
5. Print receipt
6. Done!
```

### **Workflow 3: Invoice for Later Payment**
```
1. Follow steps 1-5 above
2. Click "📄 Invoice Only (Pay Later)"
3. Set due date (e.g., 30 days)
4. Patient leaves with invoice
5. When patient returns:
   - Dashboard → View Invoices
   - Find invoice → Click "Pay"
   - Record payment
```

### **Workflow 4: Daily Cash Register**
```
Morning:
1. Open Cash Register
2. Count cash drawer → Enter opening balance
3. Click "Open Cash Register"

Throughout Day:
- All cash payments auto-recorded
- Manual cash in/out if needed

Evening:
1. Click "Close Register"
2. Count cash drawer → Enter actual balance
3. System shows expected vs. actual
4. If discrepancy → Investigate
5. Close register
```

### **Workflow 5: Monthly Financial Review**
```
1. Dashboard → Billing & Payments → View Reports
2. Set date range (e.g., last month)
3. Click "Generate Reports"
4. Review:
   - Revenue summary
   - Payment methods (cash vs. mobile vs. card)
   - Top services
   - Outstanding balances
   - Aging report (who owes money)
5. Export reports to CSV for accounting
6. Follow up on overdue invoices
```

---

## 🆕 NEW FEATURES (Feb 2026)

### **Bill Visit (Consultation Billing from Encounters)**

Create an invoice directly from a patient's clinical visit.

**Steps:**
1. Go to **Patient Details** (search for patient, click to open).
2. Click the **Medical Visits** tab.
3. Find the visit date you want to bill.
4. Click the green **Bill Visit** button next to that visit.
5. The system creates an invoice with the default consultation service from your pricing catalog.
6. You are redirected to **Collect Payment** to record the payment.

**When to use:** After a consultation when you want to bill for that visit without manually adding services in Quick Checkout.

---

### **Void Payment (Reverse Erroneous Payments)**

Use when a payment was recorded by mistake (e.g., duplicate entry, wrong amount). This is different from a **Refund**, which is for returning money to the patient.

**Steps:**
1. Go to **Billing Dashboard** → **View All Payments**.
2. Find the payment you need to void (must be **Completed**).
3. Click the gray **Void** button.
4. Enter a reason (e.g., "Duplicate entry", "Wrong amount") – minimum 3 characters.
5. Confirm. The payment is marked as voided and the invoice balance is reversed.

**Note:** Voided payments cannot be edited or refunded. They appear with a gray "VOIDED" badge in the payments list.

---

### **General Ledger**

View income by account and cost center. Payments are automatically posted to the GL when recorded.

**Steps:**
1. Go to **Billing Dashboard** → **General Ledger**.
2. Set the date range (From / To).
3. Click **Refresh**.
4. View **Income Summary** by account (Consultation, Lab, Pharmacy, Other).
5. View **Cost Centers** (OPD, Lab, Pharmacy, Admin).

**When to use:** For basic income tracking by department or for accounting reconciliation.

---

## 📈 REPORTING & ANALYTICS

### **Available Reports:**

1. **Revenue Summary**
   - Total invoiced
   - Total collected
   - Outstanding
   - Collection rate

2. **Payment Methods Analysis**
   - See which payment methods are most popular
   - Track cash vs. digital payments

3. **Top Services by Revenue**
   - Identify most profitable services
   - Optimize service offerings

4. **Aging Report**
   - Track overdue invoices
   - Follow up with patients
   - Reduce bad debt

5. **Daily Cash Flow**
   - Monitor daily collections
   - Identify busy/slow days
   - Plan staffing

### **All Reports Exportable to CSV!**

---

## 🎓 TRAINING TIPS

### **For Receptionists/Cashiers:**
1. Master Quick Checkout (practice 5-10 times)
2. Learn to open/close cash register
3. Know how to search patients quickly
4. Understand discount policy
5. Print receipts for every payment

### **For Accountants/Managers:**
1. Review billing reports weekly
2. Monitor aging report monthly
3. Follow up on overdue invoices
4. Reconcile cash register daily
5. Export reports for bookkeeping

### **For Doctors/Clinicians:**
- No direct billing interaction needed
- Receptionist handles all billing after consultation
- Can view patient billing history in patient details (future)

---

## 🔧 CONFIGURATION

### **To Update Service Prices:**
```
Dashboard → Billing & Payments → Manage Pricing
- Click service → Edit
- Update price
- Save
```

### **To Add New Services:**
```
Dashboard → Billing & Payments → Manage Pricing
- Click "+ Add New Service"
- Enter details
- Set price
- Choose category
- Mark as taxable/non-taxable
- Save
```

### **To Change Tax Rate:**
Currently set in billing settings. Default is 0% (can be configured per country).

### **To Change Currency:**
Default is USD. Multi-currency support is built-in. Update in billing configuration.

---

## ⚠️ IMPORTANT NOTES

### **Data Storage:**
- All billing data stored in browser localStorage
- Specific to organization (multi-org support)
- Regular backups recommended (use main dashboard backup feature)

### **Cash Register Best Practices:**
1. ✅ Open register at start of day
2. ✅ Close register at end of day
3. ✅ Investigate any discrepancies
4. ✅ Keep opening balance consistent
5. ✅ Don't mix personal money with business cash

### **Invoice Numbering:**
- Auto-generated sequentially
- Format: INV-YYYY-NNNNN
- Cannot be changed (audit trail)

### **Payment References:**
- Auto-generated: PAY-YYYY-NNNNN
- Keep M-Pesa codes in "method details"
- Important for reconciliation

---

## 🚨 TROUBLESHOOTING

### **Problem: Quick Checkout button not working**
- **Solution**: Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
- Service worker may need to update to v222

### **Problem: Invoices not showing**
- **Solution**: Check if billing module is loaded
- Open browser console (F12), look for "Billing module loaded successfully"

### **Problem: Cash register shows "closed" but it's open**
- **Solution**: Reload page, check getCurrentCashSession()

### **Problem: Receipt not printing**
- **Solution**: Check browser popup blocker
- Allow popups for this site

### **Problem: Reports showing $0**
- **Solution**: Check date range, ensure invoices exist for that period

---

## 📊 DEFAULT SERVICE CATALOG

| Code | Service | Category | Price |
|------|---------|----------|-------|
| CONS-001 | General Consultation | Consultation | $50 |
| CONS-002 | Specialist Consultation | Consultation | $100 |
| CONS-003 | Follow-up Visit | Consultation | $30 |
| PROC-001 | Wound Dressing | Procedure | $25 |
| PROC-002 | Suturing | Procedure | $75 |
| PROC-003 | Minor Surgery | Procedure | $200 |
| LAB-001 | Complete Blood Count | Laboratory | $40 |
| LAB-002 | Malaria Test | Laboratory | $15 |
| LAB-003 | Blood Glucose | Laboratory | $20 |
| LAB-004 | Urinalysis | Laboratory | $25 |
| IMG-001 | X-Ray (Single View) | Imaging | $60 |
| IMG-002 | Ultrasound | Imaging | $80 |
| VAC-001 | COVID-19 Vaccine | Vaccination | $25 |
| VAC-002 | Flu Vaccine | Vaccination | $20 |
| SRV-001 | Medical Certificate | Documentation | $15 |
| SRV-002 | Prescription Refill | Prescription | $10 |

*All prices are in USD by default. Customize in Pricing Catalog.*

---

## 🎯 SUCCESS METRICS

### **Before Billing System:**
- ❌ No digital billing records
- ❌ Manual receipt books
- ❌ No payment tracking
- ❌ No financial reports
- ❌ Difficult cash reconciliation
- ❌ No outstanding balance tracking

### **After Billing System:**
- ✅ Digital invoice & payment records
- ✅ Auto-generated receipts
- ✅ Real-time payment tracking
- ✅ Comprehensive financial reports
- ✅ Automated cash reconciliation
- ✅ Aging report for collections
- ✅ Multi-currency support
- ✅ Offline capability
- ✅ Cash-first design (70% patients)
- ✅ Export to CSV for accounting

---

## 🌍 AFRICA-SPECIFIC FEATURES

### **1. Cash-First Priority**
- Designed for 70%+ cash transactions
- Quick checkout optimized for speed
- Receipt printing for every transaction

### **2. Mobile Money Ready**
- M-Pesa (Kenya, Tanzania)
- MTN Mobile Money (Ghana, Uganda, Rwanda)
- Airtel Money
- Integration points ready for APIs

### **3. Offline-First**
- Works without internet
- All data stored locally
- Sync-ready for future cloud backup

### **4. Multi-Currency**
- 40+ African currencies configured
- Easy currency switching per country
- Proper currency symbols (₦, KSh, R, etc.)

### **5. Low-Bandwidth**
- No images, minimal CSS
- Fast page loads
- Works on 2G/3G networks

### **6. Simple Training**
- Minimal clicks (Quick Checkout = 3 clicks)
- Visual feedback
- Easy for staff with basic computer skills

---

## 🔮 FUTURE ENHANCEMENTS (Not Included Yet)

### **Phase 2: Patient Portal** (Next Priority)
- Patients view bills online
- Online payment via mobile money
- SMS notifications
- Self-service booking

### **Phase 4: Insurance Claims** (Future)
- Insurance provider management
- Claims generation
- ICD-10/CPT coding
- Claims tracking

### **Phase 5: Collections** (Future)
- Payment plans
- Automated SMS reminders
- Dunning workflows

---

## ✅ TESTING CHECKLIST

Before going live, test:

1. ✅ Create invoice via Quick Checkout
2. ✅ Record cash payment
3. ✅ Print receipt
4. ✅ View invoice details
5. ✅ Search invoices
6. ✅ Open cash register
7. ✅ Close cash register
8. ✅ Add new service to catalog
9. ✅ Edit service price
10. ✅ Generate revenue report
11. ✅ Export report to CSV
12. ✅ Check aging report
13. ✅ Test offline (disconnect internet)

---

## 📞 SUPPORT

### **Console Logging:**
All billing modules log their initialization:
- "Billing module loaded successfully"
- "Pricing module loaded successfully"
- "Payments module loaded successfully"
- "Cash register module loaded successfully"
- "Billing reports module loaded successfully"

### **Check Installation:**
Open browser console (F12):
```javascript
// Verify modules loaded
typeof getAllInvoices === 'function'  // Should be true
typeof recordPayment === 'function'   // Should be true
typeof openCashRegister === 'function' // Should be true
```

---

## 🎉 READY TO GO!

Your MediForge system now has a **complete, production-ready billing system** optimized for African healthcare facilities!

**Key Highlights:**
- ✅ Cash-first design (70% patients covered)
- ✅ Multi-currency (40+ African currencies)
- ✅ Offline-capable
- ✅ 8 UI pages + 5 JavaScript modules
- ✅ Comprehensive reports
- ✅ Professional receipts
- ✅ Cash register tracking
- ✅ Export to CSV
- ✅ All existing functionality preserved

**Access:**
1. Open your MediForge dashboard
2. Click "💰 Billing & Payments"
3. Start with Quick Checkout!

**Hard refresh your browser (Ctrl+F5) to load the new billing system.**

---

*Implementation Date: October 11, 2024*  
*Service Worker Version: v222*  
*Total New Code: ~3,500 lines*  
*Breaking Changes: 0*  
*Test Status: Ready for production*

