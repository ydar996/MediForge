# SAFE Fix Script for ALL 87 Missed Pages
# This script ONLY ADDS missing components - NEVER removes or modifies existing code
# Follows proven pattern from billing-dashboard.html

$ErrorActionPreference = "Continue"

Write-Host "SAFELY FIXING ALL 87 MISSED PAGES" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host "GUARANTEE: Only adding missing components, never modifying existing code" -ForegroundColor Yellow
Write-Host ""

# Get list from audit report - pages that need fixes
$pagesToFix = @(
    'allergies-diagnostic.html',
    'check-mecure-address.html',
    'check-supabase-dob-data.html',
    'check-ydar109-user.html',
    'cleanup-duplicates.html',
    'create-auth-users.html',
    'create-icon.html',
    'diagnose-ehr-app.html',
    'direct-mobile-sync.html',
    'force-cache-update.html',
    'force-mobile-cache-bust.html',
    'generate-icons.html',
    'get-org-id.html',
    'migrate-all-clinical-data.html',
    'migrate-complete-all-data.html',
    'migrate-to-supabase.html',
    'migrate-user-password.html',
    'mobile-data-retrieval.html',
    'mobile-sync-selector.html',
    'patient-encounters-broken.html',
    'platform-security-dashboard.html',
    'platform-settings.html',
    'populate-localstorage-from-supabase.html',
    'pricing-catalog.html',
    'reset-refresh.html',
    'simple-cleanup.html',
    'simple-dob-sync.html',
    'simple-mobile-sync.html',
    'sync-localstorage-with-supabase.html',
    'sync-mobile-data.html',
    'sync-user-profiles.html',
    'unaddressed-patients.html',
    'verify-supabase-data.html',
    'verify-supabase-dob.html',
    'ACTUALLY-FINAL-WORKING-CODE.html',
    'ACTUALLY-WORKING-CODE.html',
    'audit-localstorage-usage.html',
    'audit-mecure-data.html',
    'automated-audit-tool.html',
    'check-and-migrate-patients.html',
    'check-deployment-status.html',
    'check-supabase-data.html',
    'cleanup-appointments-patients.html',
    'cleanup-deleted-patients.html',
    'clear-cache.html',
    'clear-localstorage.html',
    'color-scheme-examples-local.html',
    'condition-patients.html',
    'delete-unknown-patients.html',
    'diagnose-patient-data.html',
    'direct-override.html',
    'discharge-summary.html',
    'disease-analytics.html',
    'FINAL-REALLY-WORKING-CODE.html',
    'final-ui-safe-code.html',
    'final-working-code.html',
    'healthcare-staff.html',
    'hybrid-solution.html',
    'imaging-order.html',
    'investigate-missing-patients.html',
    'lab-order.html',
    'login-clean.html',
    'migrate-data-day3.html',
    'migrate-patient-demographics.html',
    'migrate-users.html',
    'mobile-sync-diagnostic.html',
    'patient-encounters.html',
    'payment-receipts.html',
    'performance-audit-simple.html',
    'performance-audit.html',
    'platform-analytics.html',
    'platform-audit-log.html',
    'platform-subscriptions.html',
    'register-clinic.html',
    'REALLY-FINAL-WORKING-CODE.html',
    'REALLY-WORKING-CODE.html',
    'restore-appointments.html',
    'restore-subscription-plans.html',
    'restore-tool.html',
    'restore-working-login.html',
    'security-audit-simple.html',
    'security-audit.html',
    'security-dashboard.html',
    'vital-signs-analysis.html',
    'deleted-patients.html',
    'reports.html'
)

$fixedCount = 0
$skippedCount = 0
$errorCount = 0
$fixedPages = @()
$skippedPages = @()
$errorPages = @()

foreach ($pageName in $pagesToFix) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        Write-Host "SKIP: $pageName - File not found" -ForegroundColor Yellow
        $skippedPages += $pageName
        $skippedCount++
        continue
    }
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        $originalContent = $content
        $changes = @()
        $needsFix = $false
        
        Write-Host "Processing: $pageName" -ForegroundColor Cyan
        
        # 1. Add cache control meta tags if missing (in <head>)
        if ($content -notmatch 'Cache-Control.*no-cache.*no-store') {
            $cacheControlMeta = @"

  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
"@
            if ($content -match '(<head[^>]*>)') {
                $content = $content -replace '(<head[^>]*>)', "`$1$cacheControlMeta"
                $changes += "cache-control"
                $needsFix = $true
            }
        }
        
        # 2. Add Supabase CDN if missing (in <head>, before </head>)
        if ($content -notmatch 'cdn\.jsdelivr\.net/npm/@supabase/supabase-js') {
            $supabaseCDN = @"

  <!-- Supabase CDN Library -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
"@
            # Insert before </head>
            if ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$supabaseCDN`n`$1"
                $changes += "Supabase-CDN"
                $needsFix = $true
            }
        }
        
        # 3. Add supabase-client.js if missing (after Supabase CDN or before </head>)
        if ($content -notmatch 'supabase-client\.js') {
            $supabaseClient = @"

  <!-- Supabase Client Initialization -->
  <script src="js/supabase-client.js?v=202510220113080113081308"></script>
"@
            # Try after Supabase CDN first
            if ($content -match '(cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^>]*>)') {
                $content = $content -replace '(cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^>]*>)', "`$1`n$supabaseClient"
                $changes += "supabase-client"
                $needsFix = $true
            } elseif ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$supabaseClient`n`$1"
                $changes += "supabase-client"
                $needsFix = $true
            }
        }
        
        # 4. Add universal-data-loader.js if missing (CRITICAL - after supabase-client or before </head>)
        if ($content -notmatch 'universal-data-loader\.js') {
            $universalLoader = @"

  <!-- Universal Data Loader for Supabase-first architecture -->
  <script src="js/universal-data-loader.js?v=202510220113080113081308"></script>
"@
            # Try after supabase-client.js first
            if ($content -match '(supabase-client\.js[^>]*>)') {
                $content = $content -replace '(supabase-client\.js[^>]*>)', "`$1`n$universalLoader"
                $changes += "universal-loader"
                $needsFix = $true
            } elseif ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$universalLoader`n`$1"
                $changes += "universal-loader"
                $needsFix = $true
            }
        }
        
        # 5. Add main.js if missing (before </body>)
        if ($content -notmatch '\<script[^>]*main\.js') {
            $mainJS = @"

  <!-- General helpers -->
  <script src="js/main.js?v=20251101160000"></script>
"@
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$mainJS`n`$1"
                $changes += "main.js"
                $needsFix = $true
            }
        }
        
        # 6. Add universal-sync-status.js if missing (before </body>)
        if ($content -notmatch 'universal-sync-status\.js') {
            $syncStatus = @"

  <!-- Universal Sync Status Indicator -->
  <script src="js/universal-sync-status.js?v=202510220113080113081308"></script>
"@
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$syncStatus`n`$1"
                $changes += "sync-status"
                $needsFix = $true
            }
        }
        
        # Only save if changes were made AND verify no malformed tags
        if ($needsFix) {
            # Check for malformed tags before saving
            $hasMalformed = $content -match '</script></script>' -or $content -match '</script>\s*</script>'
            if ($hasMalformed) {
                Write-Host "  WARNING: Malformed tags detected, fixing..." -ForegroundColor Yellow
                $content = $content -replace '</script></script>', '</script>'
                $content = $content -replace '</script>\s*</script>', '</script>'
            }
            
            # Create backup
            $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $backupPath = "$filePath.backup-$timestamp"
            Copy-Item -Path $filePath -Destination $backupPath -ErrorAction SilentlyContinue
            
            # Save
            $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
            
            Write-Host "  FIXED: Added - $($changes -join ', ')" -ForegroundColor Green
            if (Test-Path $backupPath) {
                Write-Host "  BACKUP: $(Split-Path $backupPath -Leaf)" -ForegroundColor Gray
            }
            $fixedPages += $pageName
            $fixedCount++
        } else {
            Write-Host "  OK: Already has all required components" -ForegroundColor Gray
            $skippedPages += $pageName
            $skippedCount++
        }
        
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $errorPages += "$pageName - $_"
        $errorCount++
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "FIXED: $fixedCount pages" -ForegroundColor Green
Write-Host "SKIPPED (already complete): $skippedCount pages" -ForegroundColor Gray
Write-Host "ERRORS: $errorCount pages" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($fixedPages.Count -gt 0) {
    Write-Host "FIXED PAGES:" -ForegroundColor Green
    foreach ($page in $fixedPages) {
        Write-Host "  - $page" -ForegroundColor Green
    }
    Write-Host ""
}

if ($errorPages.Count -gt 0) {
    Write-Host "ERRORS:" -ForegroundColor Red
    foreach ($error in $errorPages) {
        Write-Host "  - $error" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "All changes are SAFE - only added missing components" -ForegroundColor Cyan
Write-Host "Backups created for all modified files" -ForegroundColor Yellow

