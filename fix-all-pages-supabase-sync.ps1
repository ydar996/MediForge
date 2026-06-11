# Comprehensive Fix Script for Supabase-First Architecture
# Automatically fixes ALL production pages to follow the standard pattern
# Ensures data sync across all browsers and devices

Write-Host "🔧 FIXING ALL PAGES FOR SUPABASE SYNC" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Production pages that NEED Supabase sync
$productionPages = @(
    'dashboard.html',
    'patients.html',
    'patient-details.html',
    'patient-summary.html',
    'appointments.html',
    'billing-dashboard.html',
    'invoices.html',
    'payments.html',
    'cash-register.html',
    'quick-checkout.html',
    'configure-services.html',
    'billing-reports.html',
    'billing-permissions.html',
    'edit-invoice.html',
    'edit-payment.html',
    'collect-payment.html',
    'invoice-details.html',
    'payment-receipts.html',
    'clinical-note.html',
    'patient-encounters.html',
    'lab-order.html',
    'imaging-order.html',
    'prescription.html',
    'referral-letter.html',
    'discharge-summary.html',
    'patient-documents.html',
    'schedule.html',
    'reports.html',
    'platform-dashboard.html',
    'platform-analytics.html',
    'manage-clinics.html',
    'clinic-details.html',
    'set-clinic-schedule.html',
    'healthcare-staff.html',
    'revenue-analytics.html',
    'disease-analytics.html',
    'condition-stats.html',
    'conditions-breakdown.html',
    'gaps-summary.html',
    'vital-signs-analysis.html',
    'security-dashboard.html',
    'clinic-security-dashboard.html',
    'audit-log.html',
    'data-import-export.html',
    'manage-subscription.html',
    'platform-subscriptions.html',
    'deleted-patients.html',
    'todays-revenue.html',
    'total-revenue.html',
    'total-cash-received.html'
)

$fixedCount = 0
$skippedCount = 0
$errorCount = 0

foreach ($pageName in $productionPages) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        Write-Host "⚠️  $pageName - File not found, skipping" -ForegroundColor Yellow
        $skippedCount++
        continue
    }
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        $originalContent = $content
        $modified = $false
        
        Write-Host "Processing: $pageName" -ForegroundColor Cyan
        
        # 1. Add cache control meta tags if missing (in <head>)
        if ($content -notmatch 'Cache-Control.*no-cache.*no-store') {
            $cacheControlMeta = @'
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
'@
            # Insert after <head> tag
            if ($content -match '(<head[^>]*>)') {
                $content = $content -replace '(<head[^>]*>)', "$1`n$cacheControlMeta"
                $modified = $true
                Write-Host "  ✅ Added cache-control meta tags" -ForegroundColor Green
            }
        }
        
        # 2. Add Supabase CDN in <head> (must be first)
        if ($content -notmatch 'cdn\.jsdelivr\.net/npm/@supabase/supabase-js') {
            $supabaseCDN = @'
  
  <!-- Supabase CDN Library -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
'@
            # Try to find existing script section or </head>
            if ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$supabaseCDN`n$1"
                $modified = $true
                Write-Host "  ✅ Added Supabase CDN library" -ForegroundColor Green
            } elseif ($content -match '(<link[^>]*stylesheet[^>]*>)') {
                # Insert after last stylesheet link
                $content = $content -replace '((<link[^>]*stylesheet[^>]*>)\s*(?!.*<link[^>]*stylesheet))', "$1`n$supabaseCDN"
                $modified = $true
                Write-Host "  ✅ Added Supabase CDN library" -ForegroundColor Green
            }
        }
        
        # 3. Add supabase-client.js in <head> (after CDN)
        if ($content -notmatch 'supabase-client\.js') {
            $supabaseClient = @'
  
  <!-- Supabase Client Initialization -->
  <script src="js/supabase-client.js?v=202510220113080113081308"></script>
'@
            # Insert after Supabase CDN or before </head>
            if ($content -match '(cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^>]*>)') {
                $content = $content -replace '(cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^>]*>)', "$1`n$supabaseClient"
                $modified = $true
                Write-Host "  ✅ Added supabase-client.js" -ForegroundColor Green
            } elseif ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$supabaseClient`n$1"
                $modified = $true
                Write-Host "  ✅ Added supabase-client.js" -ForegroundColor Green
            }
        }
        
        # 4. Add universal-data-loader.js in <head> (after supabase-client)
        if ($content -notmatch 'universal-data-loader\.js') {
            $universalLoader = @'
  
  <!-- Universal Data Loader for Supabase-first architecture -->
  <script src="js/universal-data-loader.js?v=202510220113080113081308"></script>
'@
            # Insert after supabase-client.js or before </head>
            if ($content -match '(supabase-client\.js[^>]*>)') {
                $content = $content -replace '(supabase-client\.js[^>]*>)', "$1`n$universalLoader"
                $modified = $true
                Write-Host "  ✅ Added universal-data-loader.js (CRITICAL)" -ForegroundColor Green
            } elseif ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$universalLoader`n$1"
                $modified = $true
                Write-Host "  ✅ Added universal-data-loader.js (CRITICAL)" -ForegroundColor Green
            }
        }
        
        # 5. Add main.js before </body>
        if ($content -notmatch '\<script[^>]*main\.js') {
            $mainJS = @'

  <!-- General helpers -->
  <script src="js/main.js?v=20251101160000"></script>
'@
            # Insert before </body> or before existing scripts
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$mainJS`n$1"
                $modified = $true
                Write-Host "  ✅ Added main.js" -ForegroundColor Green
            }
        }
        
        # 6. Add universal-sync-status.js before </body>
        if ($content -notmatch 'universal-sync-status\.js') {
            $syncStatus = @'
  
  <!-- Universal Sync Status Indicator -->
  <script src="js/universal-sync-status.js?v=202510220113080113081308"></script>
'@
            # Insert before </body>
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$syncStatus`n$1"
                $modified = $true
                Write-Host "  ✅ Added universal-sync-status.js" -ForegroundColor Green
            }
        }
        
        # Save if modified
        if ($modified) {
            $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
            Write-Host "  💾 Saved changes to $pageName" -ForegroundColor Green
            $fixedCount++
        } else {
            Write-Host "  ✓ Already compliant" -ForegroundColor Gray
            $skippedCount++
        }
        
    } catch {
        Write-Host "  ❌ Error processing $pageName : $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 FIX SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Fixed: $fixedCount pages" -ForegroundColor Green
Write-Host "⏭️  Skipped (already compliant): $skippedCount pages" -ForegroundColor Gray
Write-Host "❌ Errors: $errorCount pages" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
Write-Host ""
Write-Host "✨ All pages should now sync correctly with Supabase!" -ForegroundColor Cyan
Write-Host "   Run audit-all-pages-supabase-sync.ps1 to verify." -ForegroundColor Yellow

