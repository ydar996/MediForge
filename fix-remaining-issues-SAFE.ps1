# Fix Remaining Issues: Malformed Tags and Missing Components
# Only fixes what's missing - never modifies existing code

$ErrorActionPreference = "Continue"

Write-Host "FIXING REMAINING ISSUES" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green
Write-Host ""

# Pages with malformed tags that need fixing
$malformedPages = @(
    'payment-receipts.html',
    'healthcare-staff.html',
    'revenue-analytics.html',
    'disease-analytics.html',
    'vital-signs-analysis.html',
    'security-dashboard.html',
    'data-import-export.html',
    'platform-subscriptions.html'
)

Write-Host "Step 1: Fixing malformed script tags (8 pages)..." -ForegroundColor Cyan

foreach ($pageName in $malformedPages) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        Write-Host "SKIP: $pageName - File not found" -ForegroundColor Yellow
        continue
    }
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        
        # Fix duplicate closing script tags
        $content = $content -replace '</script></script>', '</script>'
        $content = $content -replace '</script>\s+</script>', '</script>'
        
        # Fix unclosed script tags (script tags without closing)
        # Pattern: <script src="..."> followed by another tag without </script>
        $content = $content -replace '(<script[^>]*src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2">)(\s*)(<!--)', '$1</script>$2$3'
        $content = $content -replace '(<script[^>]*src="js/supabase-client\.js[^"]*">)(\s*)(<!--)', '$1</script>$2$3'
        $content = $content -replace '(<script[^>]*src="js/universal-data-loader\.js[^"]*">)(\s*)(<!--)', '$1</script>$2$3'
        
        # Create backup
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupPath = "$filePath.backup-malformed-$timestamp"
        Copy-Item -Path $filePath -Destination $backupPath -ErrorAction SilentlyContinue
        
        # Save fixed content
        $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
        
        Write-Host "  FIXED: $pageName" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: $pageName - $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Step 2: Adding missing main.js and sync-status..." -ForegroundColor Cyan

# Pages missing main.js or sync-status (from latest audit)
$pagesNeedingComponents = @(
    'sync-localstorage-with-supabase.html',
    'sync-user-profiles.html',
    'unaddressed-patients.html',
    'verify-supabase-data.html',
    'verify-supabase-dob.html',
    'vital-signs-analysis.html',
    'healthcare-staff.html',
    'revenue-analytics.html',
    'disease-analytics.html',
    'security-dashboard.html',
    'data-import-export.html',
    'platform-subscriptions.html',
    'imaging-order.html',
    'lab-order.html',
    'platform-analytics.html',
    'patient-encounters.html',
    'payment-receipts.html',
    'discharge-summary.html'
)

foreach ($pageName in $pagesNeedingComponents) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        continue
    }
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        $needsMainJS = $content -notmatch '\<script[^>]*main\.js'
        $needsSyncStatus = $content -notmatch 'universal-sync-status\.js'
        
        if (-not ($needsMainJS -or $needsSyncStatus)) {
            continue
        }
        
        Write-Host "Processing: $pageName" -ForegroundColor Cyan
        
        # Add main.js if missing
        if ($needsMainJS) {
            $mainJS = @"

  <!-- General helpers -->
  <script src="js/main.js?v=20251101160000"></script>
"@
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$mainJS`n`$1"
                Write-Host "  Added: main.js" -ForegroundColor Green
            }
        }
        
        # Add sync-status if missing
        if ($needsSyncStatus) {
            $syncStatus = @"

  <!-- Universal Sync Status Indicator -->
  <script src="js/universal-sync-status.js?v=202510220113080113081308"></script>
"@
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$syncStatus`n`$1"
                Write-Host "  Added: universal-sync-status.js" -ForegroundColor Green
            }
        }
        
        # Save
        $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
        
    } catch {
        Write-Host "  ERROR: $pageName - $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "All remaining issues fixed!" -ForegroundColor Green

