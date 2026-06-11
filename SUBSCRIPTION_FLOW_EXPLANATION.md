# Subscription Payment Flow - Problem and Fix

## The Problem

**You couldn't see pending invoices at the platform level** because of a data source mismatch:

### Where Payment Data Lives:
1. **Supabase `organizations` table**: Has only basic subscription columns:
   - `subscription_plan` (e.g., "basic")
   - `subscription_status` (e.g., "pending")
   - `subscription_expires_at` (timestamp)

2. **localStorage `organizations`**: Has full subscription details including:
   ```javascript
   organizations["Mecure Clinics"].subscription.lastPayment = {
     id: "a333eca2-380f-4690-a32a-113e341b792c",
     date: "2025-01-15T10:00:00Z",
     amount: 78000,
     currency: "NGN",
     method: "bank_transfer",
     status: "pending"
   }
   ```

### What Was Broken:
When `platform-subscriptions.html` loaded organizations:
1. It called `getAllOrganizations()` which loaded from Supabase
2. Supabase only had `subscription_plan` and `subscription_status` columns
3. **The `lastPayment` data (with payment ID and details) was missing**
4. So pending payments couldn't be displayed

## The Fix

I updated three files to **merge Supabase data with localStorage data**:

### 1. `js/platform-admin.js` (getAllOrganizations function)
**Before**: Only returned Supabase data (missing `lastPayment`)
**After**: 
- Loads organizations from Supabase
- Also loads from localStorage
- Merges localStorage subscription data (including `lastPayment`) into the result

```javascript
// Merge subscription data from localStorage if it exists (contains lastPayment)
subscription: localOrg.subscription || (org.subscription_plan ? {
  currentPlan: org.subscription_plan,
  status: org.subscription_status || 'trial',
  expiryDate: org.subscription_expires_at
} : null)
```

### 2. `platform-subscriptions.html` (loadSubscriptionData function)
**Before**: Only used Supabase subscription columns
**After**:
- When subscriptions table is empty, it falls back to organization columns
- **Also merges localStorage subscription data** to get `lastPayment`
- Now can see pending payments with full details

```javascript
// Merge localStorage subscription data (includes lastPayment)
if (localOrg && localOrg.subscription) {
  orgData.subscription = {
    ...orgData.subscription,
    ...localOrg.subscription,  // This includes lastPayment!
    // Preserve Supabase status if it's more recent
    status: orgData.subscription_status || localOrg.subscription.status || 'trial',
    currentPlan: orgData.subscription_plan || localOrg.subscription.currentPlan || 'free',
    expiryDate: orgData.subscription_expires_at || localOrg.subscription.expiryDate
  };
}
```

### 3. `payment-receipts.html` (loadReceipts function)
**Before**: Only checked Supabase organizations (missing `lastPayment`)
**After**:
- Also checks and merges localStorage subscription data
- Now can find pending bank deposits that need receipt review

## How to Verify the Fix Works

1. **On `platform-subscriptions.html`**:
   - Should show "Pending Payment" status for Mecure Clinics
   - Should show a "✅ Confirm" button for pending payments

2. **On `payment-receipts.html`**:
   - Should show a receipt entry with status "AWAITING UPLOAD"
   - Payment ID should be `a333eca2-380f-4690-a32a-113e341b792c`
   - Organization should be "Mecure Clinics"

3. **Check Console Logs**:
   - Look for: `✅ Merged subscription data from localStorage for Mecure Clinics (with payment data)`
   - This confirms the merge is working

## Why This Architecture?

We use a **hybrid approach**:
- **Supabase** = Source of truth for basic org data and subscription status
- **localStorage** = Temporary storage for payment details before sync

This ensures:
- ✅ Works offline (localStorage)
- ✅ Syncs across devices (Supabase)
- ✅ No data loss during sync

