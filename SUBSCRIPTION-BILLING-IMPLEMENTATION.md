# Subscription Billing & Enforcement Implementation

## Overview
This document describes the subscription billing and enforcement system implemented for MediForge.

---

## ✅ What Has Been Implemented

### 1. **Recurring Billing System** (`js/subscription-manager.js`)

**Function: `checkRecurringBilling()`**
- Automatically checks all organizations for recurring billing needs
- Generates new invoices when `nextBillingDate` is reached
- Creates payment records in `billing_history` table
- Updates organization subscription status to 'pending'

**How it works:**
- Checks each organization's `subscription.nextBillingDate`
- If billing date has passed, generates a new invoice
- Calculates amount based on billing cycle (monthly/annual with 15% annual discount)
- Creates payment record with status 'pending'
- Updates `nextBillingDate` for the next billing cycle

### 2. **Subscription Enforcement System** (`js/subscription-manager.js`)

**Function: `enforceSubscriptionPayments()`**
- Checks all organizations for overdue payments
- Automatically suspends organizations 15+ days after billing date if payment is pending
- Updates organization status to 'suspended' in both localStorage and Supabase

**How it works:**
- Checks each organization's `lastPayment.status`
- If status is 'pending', calculates days overdue
- If 15+ days overdue, calls `suspendOrganization()`
- Updates subscription status to 'suspended'
- Records suspension reason and date

### 3. **Organization Suspension** (`suspendOrganization()`)

**What happens when suspended:**
- Organization status changed to 'suspended'
- Subscription status changed to 'suspended'
- Suspension date and reason recorded
- Updated in both localStorage and Supabase

### 4. **Organization Reactivation** (`reactivateOrganization()`)

**Function: `reactivateOrganization(orgName)`**
- Reactivates organization after payment approval
- Calculates new expiry date based on billing cycle
- Updates subscription status to 'active'
- Removes suspension flags

**Integration:**
- Automatically called when payment receipt is approved in `payment-receipts.html`
- Calculates expiry date based on billing cycle (monthly = +1 month, annual = +12 months)

---

## 🔄 How to Use

### **Automatic Checks (Client-Side)**

The subscription manager automatically runs checks when:
- Platform admin pages are loaded
- `runSubscriptionChecks()` is called manually

**To run checks manually:**
```javascript
// Check for recurring billing
await window.checkRecurringBilling();

// Check for overdue payments and suspend
await window.enforceSubscriptionPayments();
```

### **Manual Organization Management**

**Reactivate an organization:**
```javascript
await window.reactivateOrganization('Organization Name');
```

---

## ⚠️ Current Limitations

### **1. No Server-Side Scheduled Tasks**

**Current Implementation:**
- Checks run client-side when platform admin pages load
- Not automated via cron jobs or scheduled tasks

**What's Needed:**
- Supabase Edge Function or cron job to run checks daily
- Or use a service like GitHub Actions, AWS Lambda, or similar

**Recommended Solution:**
Create a Supabase Edge Function that runs daily:
```sql
-- Supabase Edge Function (Deno)
-- Runs daily at midnight UTC
-- Checks for recurring billing and overdue payments
```

### **2. No Platform Admin UI for Subscription Management**

**What's Missing:**
- Page to view all organization subscription statuses
- Manual suspend/reactivate controls
- View overdue payments
- View upcoming billing dates

**Recommended:**
Create `platform-subscription-management.html` with:
- Table of all organizations with subscription status
- Days overdue indicator
- Manual suspend/reactivate buttons
- Filter by status (active, pending, suspended, expired)

---

## 📋 Recommended Next Steps

### **Priority 1: Create Platform Admin Subscription Management Page**

Create `platform-subscription-management.html`:
- List all organizations with subscription details
- Show billing cycle, next billing date, payment status
- Show days overdue for pending payments
- Manual suspend/reactivate buttons
- Filter and search functionality

### **Priority 2: Set Up Automated Scheduled Tasks**

**Option A: Supabase Edge Function**
- Create Edge Function that runs daily
- Calls `checkRecurringBilling()` and `enforceSubscriptionPayments()`
- Schedule via Supabase Cron or external service

**Option B: External Cron Service**
- Use GitHub Actions, AWS Lambda, or similar
- Make HTTP request to trigger checks
- Run daily at midnight UTC

### **Priority 3: Email Notifications**

**Add email notifications for:**
- New invoice generated (to organization)
- Payment overdue warning (7 days before suspension)
- Organization suspended (to organization)
- Payment approved (to organization)

---

## 🔍 Testing the System

### **Test Recurring Billing:**

1. Set an organization's `nextBillingDate` to yesterday:
```javascript
const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
orgs['Test Org'].subscription.nextBillingDate = new Date(Date.now() - 24*60*60*1000).toISOString();
localStorage.setItem('organizations', JSON.stringify(orgs));
```

2. Run check:
```javascript
await window.checkRecurringBilling();
```

3. Verify new invoice was created in `billing_history`

### **Test Subscription Enforcement:**

1. Set an organization's payment to pending 16 days ago:
```javascript
const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
orgs['Test Org'].subscription.lastPayment.status = 'pending';
orgs['Test Org'].subscription.lastPayment.date = new Date(Date.now() - 16*24*60*60*1000).toISOString();
localStorage.setItem('organizations', JSON.stringify(orgs));
```

2. Run enforcement:
```javascript
await window.enforceSubscriptionPayments();
```

3. Verify organization status changed to 'suspended'

---

## 📝 Database Schema Requirements

### **Organizations Table:**
- `subscription_status` (active, pending, suspended, expired)
- `subscription_expires_at` (timestamp)
- `status` (active, suspended)

### **Subscriptions Table (if exists):**
- `status` (active, pending, suspended)
- `billing_cycle` (monthly, annual)
- `next_billing_date` (timestamp)

### **Billing History Table:**
- `status` (pending, completed, failed)
- `billing_cycle` (monthly, annual)
- `created_at` (timestamp)

---

## 🎯 Summary

**✅ Implemented:**
- Recurring billing check function
- Subscription enforcement (15-day suspension)
- Organization suspension/reactivation
- Integration with payment approval

**⚠️ Needs Implementation:**
- Server-side scheduled tasks (cron/Edge Function)
- Platform admin UI for subscription management
- Email notifications

**Current Status:**
- System works but requires manual trigger or page load
- Ready for production once scheduled tasks are set up


