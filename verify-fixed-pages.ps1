# Verify All Fixed Pages Have Correct Script Tags
# This ensures no broken HTML was created

$productionPages = @(
    'edit-invoice.html',
    'payment-receipts.html',
    'lab-order.html',
    'imaging-order.html',
    'prescription.html',
    'referral-letter.html',
    'discharge-summary.html',
    'patient-documents.html',
    'platform-analytics.html',
    'healthcare-staff.html',
    'revenue-analytics.html',
    'disease-analytics.html',
    'vital-signs-analysis.html',
    'security-dashboard.html',
    'data-import-export.html',
    'platform-subscriptions.html',
    'patient-encounters.html'
)

$issues = @()
$ok = @()

foreach ($pageName in $productionPages) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        continue
    }
    
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    
    # Check for malformed script tags
    $hasMalformed = $content -match '<script[^>]*>\s*</script>\s*</script>'
    $hasUnclosed = ($content | Select-String -Pattern '<script' -AllMatches).Matches.Count -ne ($content | Select-String -Pattern '</script>' -AllMatches).Matches.Count
    $hasDuplicateClosing = $content -match '</script></script>'
    
    if ($hasMalformed -or $hasUnclosed -or $hasDuplicateClosing) {
        $issues += "$pageName - MALFORMED SCRIPT TAGS"
        Write-Host "ERROR: $pageName - Malformed script tags detected!" -ForegroundColor Red
    } else {
        $ok += $pageName
        Write-Host "OK: $pageName - Script tags are valid" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "OK: $($ok.Count) pages" -ForegroundColor Green
Write-Host "ISSUES: $($issues.Count) pages" -ForegroundColor $(if ($issues.Count -eq 0) { "Green" } else { "Red" })
if ($issues.Count -gt 0) {
    Write-Host ""
    Write-Host "PAGES WITH ISSUES:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  - $issue" -ForegroundColor Red
    }
}

