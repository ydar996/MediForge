# Comprehensive Audit of ALL HTML Pages (excluding test/debug/backup files)
# This checks EVERY production page in the app

Write-Host "COMPREHENSIVE AUDIT OF ALL HTML PAGES" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Get ALL HTML files excluding test/debug/migration/backup
$allHtmlFiles = Get-ChildItem -Path . -Filter "*.html" -File | Where-Object { 
    $_.Name -notlike "*test*" -and 
    $_.Name -notlike "*debug*" -and 
    $_.Name -notlike "*migration*" -and 
    $_.Name -notlike "*fix*" -and 
    $_.Name -notlike "*backup*" -and
    $_.DirectoryName -notlike "*sync-upgrade-backup*" -and
    $_.Name -ne "index.html" -and
    $_.Name -ne "login.html" -and
    $_.Name -ne "register.html" -and
    $_.Name -ne "platform-login.html" -and
    $_.Name -notlike "about-us*" -and
    $_.Name -notlike "key-features*"
}

Write-Host "Found $($allHtmlFiles.Count) production HTML files to audit" -ForegroundColor Yellow
Write-Host ""

$results = @{
    Compliant = @()
    MissingSupabaseCDN = @()
    MissingSupabaseClient = @()
    MissingUniversalLoader = @()
    MissingMainJS = @()
    MissingSyncStatus = @()
    MalformedTags = @()
    MissingCacheControl = @()
}

foreach ($file in $allHtmlFiles) {
    $pageName = $file.Name
    $filePath = $file.FullName
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        $issues = @()
        
        # Check for malformed script tags
        $hasMalformed = $content -match '</script></script>' -or $content -match '</script>\s*</script>'
        if ($hasMalformed) {
            $issues += "Malformed script tags"
            $results.MalformedTags += $pageName
        }
        
        # Check for cache control
        if ($content -notmatch 'Cache-Control.*no-cache.*no-store') {
            $issues += "Missing cache-control"
            $results.MissingCacheControl += $pageName
        }
        
        # Check for Supabase CDN
        if ($content -notmatch 'cdn\.jsdelivr\.net/npm/@supabase/supabase-js') {
            $issues += "Missing Supabase CDN"
            $results.MissingSupabaseCDN += $pageName
        }
        
        # Check for supabase-client.js
        if ($content -notmatch 'supabase-client\.js') {
            $issues += "Missing supabase-client.js"
            $results.MissingSupabaseClient += $pageName
        }
        
        # Check for universal-data-loader.js (CRITICAL)
        if ($content -notmatch 'universal-data-loader\.js') {
            $issues += "Missing universal-data-loader.js (CRITICAL)"
            $results.MissingUniversalLoader += $pageName
        }
        
        # Check for main.js
        if ($content -notmatch '\<script[^>]*main\.js') {
            $issues += "Missing main.js"
            $results.MissingMainJS += $pageName
        }
        
        # Check for universal-sync-status.js
        if ($content -notmatch 'universal-sync-status\.js') {
            $issues += "Missing universal-sync-status.js"
            $results.MissingSyncStatus += $pageName
        }
        
        if ($issues.Count -eq 0) {
            Write-Host "OK: $pageName" -ForegroundColor Green
            $results.Compliant += $pageName
        } else {
            Write-Host "ISSUES: $pageName - $($issues -join ', ')" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "ERROR reading $pageName : $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "COMPREHENSIVE AUDIT SUMMARY" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Total Pages Audited: $($allHtmlFiles.Count)" -ForegroundColor Yellow
Write-Host ""
Write-Host "COMPLIANT: $($results.Compliant.Count) pages" -ForegroundColor Green
Write-Host ""
Write-Host "ISSUES FOUND:" -ForegroundColor Yellow
Write-Host "  CRITICAL - Missing Universal Loader: $($results.MissingUniversalLoader.Count)" -ForegroundColor $(if ($results.MissingUniversalLoader.Count -eq 0) { "Green" } else { "Red" })
Write-Host "  Missing Supabase CDN: $($results.MissingSupabaseCDN.Count)" -ForegroundColor $(if ($results.MissingSupabaseCDN.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host "  Missing Supabase Client: $($results.MissingSupabaseClient.Count)" -ForegroundColor $(if ($results.MissingSupabaseClient.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host "  Missing Main.js: $($results.MissingMainJS.Count)" -ForegroundColor $(if ($results.MissingMainJS.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host "  Missing Sync Status: $($results.MissingSyncStatus.Count)" -ForegroundColor $(if ($results.MissingSyncStatus.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host "  Malformed Script Tags: $($results.MalformedTags.Count)" -ForegroundColor $(if ($results.MalformedTags.Count -eq 0) { "Green" } else { "Red" })
Write-Host "  Missing Cache Control: $($results.MissingCacheControl.Count)" -ForegroundColor $(if ($results.MissingCacheControl.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

# Save detailed report
$reportPath = "COMPREHENSIVE_AUDIT_REPORT.txt"
$report = @"
COMPREHENSIVE AUDIT REPORT - ALL HTML PAGES
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Total Pages: $($allHtmlFiles.Count)

COMPLIANT PAGES ($($results.Compliant.Count)):
$($results.Compliant -join "`n")

CRITICAL ISSUES - MISSING UNIVERSAL DATA LOADER ($($results.MissingUniversalLoader.Count)):
$($results.MissingUniversalLoader -join "`n")

MALFORMED SCRIPT TAGS ($($results.MalformedTags.Count)):
$($results.MalformedTags -join "`n")

MISSING SUPABASE CDN ($($results.MissingSupabaseCDN.Count)):
$($results.MissingSupabaseCDN -join "`n")

MISSING SUPABASE CLIENT ($($results.MissingSupabaseClient.Count)):
$($results.MissingSupabaseClient -join "`n")

MISSING MAIN.JS ($($results.MissingMainJS.Count)):
$($results.MissingMainJS -join "`n")

MISSING SYNC STATUS ($($results.MissingSyncStatus.Count)):
$($results.MissingSyncStatus -join "`n")

MISSING CACHE CONTROL ($($results.MissingCacheControl.Count)):
$($results.MissingCacheControl -join "`n")
"@

$report | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "Detailed report saved to: $reportPath" -ForegroundColor Cyan

