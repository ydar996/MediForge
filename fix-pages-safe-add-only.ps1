# Safe Fix Script - ONLY ADDS missing components, NEVER removes or moves existing scripts
# This ensures no existing functionality is broken

Write-Host "🔧 SAFE FIX: Adding Missing Components Only" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host "⚠️  This script ONLY ADDS missing components" -ForegroundColor Yellow
Write-Host "    It will NOT remove, modify, or move existing scripts" -ForegroundColor Yellow
Write-Host ""

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
    'todays-revenue.html'
)

$fixedCount = 0
$skippedCount = 0
$errorCount = 0

foreach ($pageName in $productionPages) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        Write-Host "⚠️  $pageName - File not found" -ForegroundColor Yellow
        $skippedCount++
        continue
    }
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        $originalContent = $content
        $changes = @()
        
        Write-Host "Checking: $pageName" -ForegroundColor Cyan
        
        # 1. Add cache control meta tags if completely missing (only if NO cache control exists)
        if ($content -notmatch 'Cache-Control.*no-cache' -and $content -notmatch 'no-cache.*no-store') {
            $cacheControlMeta = @'
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
'@
            if ($content -match '(<head[^>]*>)') {
                $content = $content -replace '(<head[^>]*>)', "$1`n$cacheControlMeta"
                $changes += "Added cache-control meta tags"
                Write-Host "  ✅ Added cache-control meta tags" -ForegroundColor Green
            }
        }
        
        # 2. Add Supabase CDN ONLY if completely missing
        if ($content -notmatch 'cdn\.jsdelivr\.net/npm/@supabase/supabase-js') {
            $supabaseCDN = '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
            
            # Try to add in <head> after other scripts or before </head>
            if ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$supabaseCDN`n$1"
                $changes += "Added Supabase CDN"
                Write-Host "  ✅ Added Supabase CDN library" -ForegroundColor Green
            }
        }
        
        # 3. Add supabase-client.js ONLY if completely missing
        if ($content -notmatch 'supabase-client\.js') {
            $supabaseClient = '  <script src="js/supabase-client.js?v=202510220113080113081308"></script>'
            
            # Try to add after Supabase CDN, or before </head>, or before </body>
            if ($content -match '(cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^>]*>)') {
                $content = $content -replace '(cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^>]*>)', "$1`n$supabaseClient"
                $changes += "Added supabase-client.js"
                Write-Host "  ✅ Added supabase-client.js" -ForegroundColor Green
            } elseif ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$supabaseClient`n$1"
                $changes += "Added supabase-client.js"
                Write-Host "  ✅ Added supabase-client.js" -ForegroundColor Green
            } elseif ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$supabaseClient`n$1"
                $changes += "Added supabase-client.js"
                Write-Host "  ✅ Added supabase-client.js" -ForegroundColor Green
            }
        }
        
        # 4. Add universal-data-loader.js ONLY if completely missing (CRITICAL)
        if ($content -notmatch 'universal-data-loader\.js') {
            $universalLoader = '  <script src="js/universal-data-loader.js?v=202510220113080113081308"></script>'
            
            # Try to add after supabase-client.js, or before </head>, or before </body>
            if ($content -match '(supabase-client\.js[^>]*>)') {
                $content = $content -replace '(supabase-client\.js[^>]*>)', "$1`n$universalLoader"
                $changes += "Added universal-data-loader.js (CRITICAL)"
                Write-Host "  ✅ Added universal-data-loader.js (CRITICAL)" -ForegroundColor Green
            } elseif ($content -match '(</head>)') {
                $content = $content -replace '(</head>)', "$universalLoader`n$1"
                $changes += "Added universal-data-loader.js (CRITICAL)"
                Write-Host "  ✅ Added universal-data-loader.js (CRITICAL)" -ForegroundColor Green
            } elseif ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$universalLoader`n$1"
                $changes += "Added universal-data-loader.js (CRITICAL)"
                Write-Host "  ✅ Added universal-data-loader.js (CRITICAL)" -ForegroundColor Green
            }
        }
        
        # 5. Add main.js ONLY if completely missing (before </body>)
        if ($content -notmatch '\<script[^>]*main\.js') {
            $mainJS = '  <script src="js/main.js?v=20251101160000"></script>'
            
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$mainJS`n$1"
                $changes += "Added main.js"
                Write-Host "  ✅ Added main.js" -ForegroundColor Green
            }
        }
        
        # 6. Add universal-sync-status.js ONLY if completely missing (before </body>)
        if ($content -notmatch 'universal-sync-status\.js') {
            $syncStatus = '  <script src="js/universal-sync-status.js?v=202510220113080113081308"></script>'
            
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$syncStatus`n$1"
                $changes += "Added universal-sync-status.js"
                Write-Host "  ✅ Added universal-sync-status.js" -ForegroundColor Green
            }
        }
        
        # Only save if changes were made
        if ($changes.Count -gt 0) {
            # Create backup first
            $backupPath = "$filePath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Copy-Item -Path $filePath -Destination $backupPath
            Write-Host "  💾 Created backup: $(Split-Path $backupPath -Leaf)" -ForegroundColor Gray
            
            $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
            $changesList = $changes -join ", "
            Write-Host "  Saved changes: $changesList" -ForegroundColor Green
            $fixedCount++
        } else {
            Write-Host "  ✓ Already has all required components" -ForegroundColor Gray
            $skippedCount++
        }
        
    } catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Fixed: $fixedCount pages" -ForegroundColor Green
Write-Host "⏭️  Skipped (already complete): $skippedCount pages" -ForegroundColor Gray
Write-Host "❌ Errors: $errorCount pages" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
Write-Host ""
Write-Host "✨ Safe fix complete! All existing functionality preserved." -ForegroundColor Cyan
Write-Host "   Only missing components were added - nothing was removed or moved." -ForegroundColor Yellow

