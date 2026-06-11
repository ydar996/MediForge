# Comprehensive Audit Script for Supabase-First Architecture
# Checks ALL production pages for correct script loading pattern
# This ensures data sync across all browsers and devices

Write-Host "🔍 COMPREHENSIVE SUPABASE SYNC AUDIT" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
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

# Pages that should NOT have sync (login, static pages)
$skipPages = @(
    'login.html',
    'register.html',
    'index.html',
    'about-us.html',
    'about-us-local.html',
    'key-features.html',
    'key-features-local.html',
    'platform-login.html'
)

Write-Host "📋 Checking $($productionPages.Count) production pages..." -ForegroundColor Yellow
Write-Host ""

$results = @{
    Compliant = @()
    MissingSupabaseCDN = @()
    MissingSupabaseClient = @()
    MissingUniversalLoader = @()
    MissingMainJS = @()
    MissingSyncStatus = @()
    WrongScriptOrder = @()
    MissingCacheControl = @()
    NotInProduction = @()
}

foreach ($pageName in $productionPages) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        $results.NotInProduction += $pageName
        Write-Host "⚠️  $pageName - File not found" -ForegroundColor Yellow
        continue
    }
    
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    $issues = @()
    
    # Check for cache control meta tags
    if ($content -notmatch 'Cache-Control.*no-cache.*no-store') {
        $issues += "Missing cache-control meta tags"
        $results.MissingCacheControl += $pageName
    }
    
    # Check for Supabase CDN (must be in <head>)
    $hasSupabaseCDN = $content -match 'cdn\.jsdelivr\.net/npm/@supabase/supabase-js'
    if (-not $hasSupabaseCDN) {
        $issues += "Missing Supabase CDN library"
        $results.MissingSupabaseCDN += $pageName
    }
    
    # Check for supabase-client.js
    $hasSupabaseClient = $content -match 'supabase-client\.js'
    if (-not $hasSupabaseClient) {
        $issues += "Missing supabase-client.js"
        $results.MissingSupabaseClient += $pageName
    }
    
    # Check for universal-data-loader.js (CRITICAL)
    $hasUniversalLoader = $content -match 'universal-data-loader\.js'
    if (-not $hasUniversalLoader) {
        $issues += "Missing universal-data-loader.js (CRITICAL)"
        $results.MissingUniversalLoader += $pageName
    }
    
    # Check for main.js
    $hasMainJS = $content -match 'main\.js'
    if (-not $hasMainJS) {
        $issues += "Missing main.js"
        $results.MissingMainJS += $pageName
    }
    
    # Check for universal-sync-status.js
    $hasSyncStatus = $content -match 'universal-sync-status\.js'
    if (-not $hasSyncStatus) {
        $issues += "Missing universal-sync-status.js"
        $results.MissingSyncStatus += $pageName
    }
    
    # Check script order (Supabase CDN should load before supabase-client)
    if ($hasSupabaseCDN -and $hasSupabaseClient) {
        $supabaseCDNIndex = [regex]::Match($content, 'cdn\.jsdelivr\.net/npm/@supabase/supabase-js').Index
        $supabaseClientIndex = [regex]::Match($content, 'supabase-client\.js').Index
        if ($supabaseClientIndex -lt $supabaseCDNIndex) {
            $issues += "Wrong script order (supabase-client loads before CDN)"
            $results.WrongScriptOrder += $pageName
        }
    }
    
    if ($issues.Count -eq 0) {
        Write-Host "✅ $pageName - Compliant" -ForegroundColor Green
        $results.Compliant += $pageName
    } else {
        Write-Host "❌ $pageName" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "   - $issue" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 AUDIT SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Compliant pages: $($results.Compliant.Count)" -ForegroundColor Green
Write-Host "❌ Pages with issues: $($productionPages.Count - $results.Compliant.Count - $results.NotInProduction.Count)" -ForegroundColor Red
Write-Host ""
Write-Host "📋 ISSUE BREAKDOWN:" -ForegroundColor Yellow
Write-Host "   Missing Supabase CDN: $($results.MissingSupabaseCDN.Count)" -ForegroundColor $(if ($results.MissingSupabaseCDN.Count -eq 0) { "Green" } else { "Red" })
Write-Host "   Missing Supabase Client: $($results.MissingSupabaseClient.Count)" -ForegroundColor $(if ($results.MissingSupabaseClient.Count -eq 0) { "Green" } else { "Red" })
Write-Host "   Missing Universal Loader: $($results.MissingUniversalLoader.Count)" -ForegroundColor $(if ($results.MissingUniversalLoader.Count -eq 0) { "Green" } else { "Red" })
Write-Host "   Missing Main.js: $($results.MissingMainJS.Count)" -ForegroundColor $(if ($results.MissingMainJS.Count -eq 0) { "Green" } else { "Red" })
Write-Host "   Missing Sync Status: $($results.MissingSyncStatus.Count)" -ForegroundColor $(if ($results.MissingSyncStatus.Count -eq 0) { "Green" } else { "Red" })
Write-Host "   Wrong Script Order: $($results.WrongScriptOrder.Count)" -ForegroundColor $(if ($results.WrongScriptOrder.Count -eq 0) { "Green" } else { "Red" })
Write-Host "   Missing Cache Control: $($results.MissingCacheControl.Count)" -ForegroundColor $(if ($results.MissingCacheControl.Count -eq 0) { "Green" } else { "Red" })
Write-Host "   Files Not Found: $($results.NotInProduction.Count)" -ForegroundColor Yellow
Write-Host ""

# Save detailed report
$reportPath = Join-Path $PSScriptRoot "supabase-sync-audit-report.txt"
$report = @"
SUPABASE SYNC ARCHITECTURE AUDIT REPORT
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

COMPLIANT PAGES ($($results.Compliant.Count)):
$($results.Compliant -join "`n")

CRITICAL ISSUES - MISSING UNIVERSAL DATA LOADER ($($results.MissingUniversalLoader.Count)):
$($results.MissingUniversalLoader -join "`n")

MISSING SUPABASE CDN ($($results.MissingSupabaseCDN.Count)):
$($results.MissingSupabaseCDN -join "`n")

MISSING SUPABASE CLIENT ($($results.MissingSupabaseClient.Count)):
$($results.MissingSupabaseClient -join "`n")

MISSING MAIN.JS ($($results.MissingMainJS.Count)):
$($results.MissingMainJS -join "`n")

MISSING SYNC STATUS ($($results.MissingSyncStatus.Count)):
$($results.MissingSyncStatus -join "`n")

WRONG SCRIPT ORDER ($($results.WrongScriptOrder.Count)):
$($results.WrongScriptOrder -join "`n")

MISSING CACHE CONTROL ($($results.MissingCacheControl.Count)):
$($results.MissingCacheControl -join "`n")

FILES NOT FOUND ($($results.NotInProduction.Count)):
$($results.NotInProduction -join "`n")
"@

$report | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "📄 Detailed report saved to: supabase-sync-audit-report.txt" -ForegroundColor Cyan
Write-Host ""

if ($results.MissingUniversalLoader.Count -gt 0 -or $results.MissingSupabaseCDN.Count -gt 0) {
    Write-Host "⚠️  CRITICAL: Some pages are missing required sync scripts!" -ForegroundColor Red
    Write-Host "   Run fix-all-pages-supabase-sync.ps1 to fix these issues." -ForegroundColor Yellow
}

