# Standard HTML Page Template for MediForge

## ⚠️ CRITICAL: Always follow this pattern when creating new pages

This ensures all pages follow the Supabase-first hybrid architecture that we've implemented to fix browser/device sync issues.

## Required Script Loading Pattern

### In `<head>` Section (Load FIRST):

```html
<head>
  <!-- Cache Control Meta Tags (REQUIRED) -->
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  
  <!-- Standard Meta Tags -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Stylesheets -->
  <link rel="stylesheet" href="css/styles.css?v=224">
  
  <!-- SUPABASE SCRIPTS - MUST BE IN <HEAD> AND IN THIS EXACT ORDER -->
  <!-- 1. Supabase CDN Library (loads first) -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  
  <!-- 2. Supabase Client Initialization -->
  <script src="js/supabase-client.js?v=202510220113080113081308"></script>
  
  <!-- 3. Universal Data Loader (auto-syncs on page load) -->
  <script src="js/universal-data-loader.js?v=202510220113080113081308"></script>
  
  <!-- Your custom styles here -->
  <style>
    /* Page-specific styles */
  </style>
</head>
```

### Before `</body>` Tag (Load SECOND):

```html
  <!-- General helpers (formatCurrency, getUser, etc.) -->
  <script src="js/main.js?v=20251101160000"></script>
  
  <!-- Domain-specific scripts (billing, patients, etc.) -->
  <script src="js/billing.js?v=289"></script>
  <!-- Add other domain scripts as needed -->
  
  <!-- Universal Sync Status Indicator -->
  <script src="js/universal-sync-status.js?v=202510220113080113081308"></script>
  
  <!-- Page-specific scripts -->
  <script>
    // Your page-specific JavaScript here
  </script>
</body>
```

## Reference Files

Use these as templates:
- `billing-dashboard.html` - Full billing functionality
- `cash-register.html` - Cash register functionality
- `dashboard.html` - Main dashboard

## Checklist Before Creating New Pages

- [ ] Cache-control meta tags included
- [ ] Supabase CDN library loaded in `<head>` (FIRST)
- [ ] `supabase-client.js` loaded in `<head>` (SECOND)
- [ ] `universal-data-loader.js` loaded in `<head>` (THIRD)
- [ ] `main.js` loaded before `</body>`
- [ ] Domain-specific scripts loaded before `</body>`
- [ ] `universal-sync-status.js` loaded before `</body>`
- [ ] CSS stylesheets included
- [ ] Mobile meta tags included

## Why This Matters

We spent significant time fixing sync issues across:
- Different browsers (Chrome vs Edge)
- Different devices (desktop vs mobile)
- Stale localStorage data

The Supabase-first architecture with `universal-data-loader.js` ensures:
1. Fresh data always loads from Supabase first
2. Auto-sync on page load
3. Consistent data across all browsers/devices
4. Fallback to localStorage only if Supabase is unavailable

**DO NOT CREATE NEW PAGES WITHOUT FOLLOWING THIS PATTERN**

