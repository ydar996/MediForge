# Fix ALL Production Pages for Supabase Sync
# Only targets actual production pages, not test/debug/migration pages

$ErrorActionPreference = "Stop"

Write-Host "FIXING ALL PRODUCTION PAGES FOR SUPABASE SYNC" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Production pages that need Supabase sync
$productionPages = @(
    'dashboard.html',
    'patients.html',
    'patient-details.html',
    'patient-summary.html',
    'add-patient.html',
    'edit-patient.html',
    'appointments.html',
    'add-appointment.html',
    'billing-dashboard.html',
    'invoices.html',
    'edit-invoice.html',
    'invoice-details.html',
    'payments.html',
    'edit-payment.html',
    'collect-payment.html',
    'payment-receipts.html',
    'cash-register.html',
    'quick-checkout.html',
    'configure-services.html',
    'billing-reports.html',
    'billing-permissions.html',
    'todays-revenue.html',
    'total-revenue.html',
    'total-cash-received.html',
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
    'edit-profile.html',
    'specialist-register.html'
)

$fixedCount = 0
$skippedCount = 0
$errorCount = 0
$missingPages = @()

foreach ($pageName in $productionPages) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        Write-Host "WARNING: $pageName - File not found" -ForegroundColor Yellow
        $missingPages += $pageName
        $skippedCount++
        continue
    }
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        $originalContent = $content
        $changes = @()
        
        # Check what's missing
        $needsSupabaseCDN = $content -notmatch 'cdn\.jsdelivr\.net/npm/@supabase/supabase-js'
        $needsSupabaseClient = $content -notmatch 'supabase-client\.js'
        $needsUniversalLoader = $content -notmatch 'universal-data-loader\.js'
        $needsMainJS = $content -notmatch '\<script[^>]*main\.js'
        $needsSyncStatus = $content -notmatch 'universal-sync-status\.js'
        $needsCacheControl = $content -notmatch 'Cache-Control.*no-cache.*no-store'
        
        if (-not ($needsSupabaseCDN -or $needsSupabaseClient -or $needsUniversalLoader -or $needsMainJS -or $needsSyncStatus -or $needsCacheControl)) {
            Write-Host "OK: $pageName - Already compliant" -ForegroundColor Gray
            $skippedCount++
            continue
        }
        
        Write-Host "Fixing: $pageName" -ForegroundColor Cyan
        
        # 1. Add cache control meta tags if missing
        if ($needsCacheControl) {
            $cacheControlMeta = "`n  <meta http-equiv=`"Cache-Control`" content=`"no-cache, no-store, must-revalidate, max-age=0`">`n  <meta http-equiv=`"Pragma`" content=`"no-cache`">`n  <meta http-equiv=`"Expires`" content=`"0`">`n  <meta name=`"mobile-web-app-capable`" content=`"yes`">`n  <meta name=`"apple-mobile-web-app-capable`" content=`"yes`">`n  <meta name=`"apple-mobile-web-app-status-bar-style`" content=`"black-translucent`">"
            if ($content -match '(<head[^>]*>)') {
                $content = $content -replace '(<head[^>]*>)', "`$1$cacheControlMeta"
                $changes += "cache-control"
            }
        }
        
        # 2. Add Supabase CDN in head if missing
        if ($needsSupabaseCDN) {
            $supabaseCDN = "`n  <!-- Supabase CDN Library -->`n  <script src=`"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`"></script>"
            if ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$supabaseCDN`n`$1"
                $changes += "Supabase-CDN"
            }
        }
        
        # 3. Add supabase-client.js if missing
        if ($needsSupabaseClient) {
            $supabaseClient = "`n  <!-- Supabase Client Initialization -->`n  <script src=`"js/supabase-client.js?v=202510220113080113081308`"></script>"
            if ($content -match '(cdn\.jsdelivr\.net/npm/@supabase/supabase-js)') {
                $content = $content -replace '(cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^>]*>)', "`$1$supabaseClient"
            } elseif ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$supabaseClient`n`$1"
            }
            $changes += "supabase-client"
        }
        
        # 4. Add universal-data-loader.js if missing (CRITICAL)
        if ($needsUniversalLoader) {
            $universalLoader = "`n  <!-- Universal Data Loader for Supabase-first architecture -->`n  <script src=`"js/universal-data-loader.js?v=202510220113080113081308`"></script>"
            if ($content -match '(supabase-client\.js)') {
                $content = $content -replace '(supabase-client\.js[^>]*>)', "`$1$universalLoader"
            } elseif ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$universalLoader`n`$1"
            } elseif ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$universalLoader`n`$1"
            }
            $changes += "universal-loader"
        }
        
        # 5. Add main.js before </body> if missing
        if ($needsMainJS) {
            $mainJS = "`n  <!-- General helpers -->`n  <script src=`"js/main.js?v=20251101160000`"></script>"
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$mainJS`n`$1"
                $changes += "main.js"
            }
        }
        
        # 6. Add universal-sync-status.js before </body> if missing
        if ($needsSyncStatus) {
            $syncStatus = "`n  <!-- Universal Sync Status Indicator -->`n  <script src=`"js/universal-sync-status.js?v=202510220113080113081308`"></script>"
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$syncStatus`n`$1"
                $changes += "sync-status"
            }
        }
        
        # Save if changes were made
        if ($changes.Count -gt 0) {
            # Create backup
            $backupPath = "$filePath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Copy-Item -Path $filePath -Destination $backupPath -ErrorAction SilentlyContinue
            
            $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
            Write-Host "  FIXED: Added - $($changes -join ', ')" -ForegroundColor Green
            $fixedCount++
        }
        
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "FIXED: $fixedCount pages" -ForegroundColor Green
Write-Host "SKIPPED (already compliant): $skippedCount pages" -ForegroundColor Gray
Write-Host "ERRORS: $errorCount pages" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
if ($missingPages.Count -gt 0) {
    Write-Host "MISSING FILES: $($missingPages.Count) pages" -ForegroundColor Yellow
    Write-Host "  $($missingPages -join ', ')" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "All production pages should now sync with Supabase!" -ForegroundColor Cyan

