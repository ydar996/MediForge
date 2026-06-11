# Fix Malformed Script Tags in Pages
# This fixes the regex replacement issue that created malformed tags

$brokenPages = @(
    'payment-receipts.html',
    'lab-order.html',
    'imaging-order.html',
    'referral-letter.html',
    'patient-documents.html',
    'healthcare-staff.html',
    'revenue-analytics.html',
    'disease-analytics.html',
    'vital-signs-analysis.html',
    'security-dashboard.html',
    'data-import-export.html',
    'platform-subscriptions.html'
)

foreach ($pageName in $brokenPages) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        Write-Host "SKIP: $pageName - File not found" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "Fixing: $pageName" -ForegroundColor Cyan
    
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    
    # Fix malformed script tags - remove duplicate closing tags
    $content = $content -replace '</script></script>', '</script>'
    $content = $content -replace '</script>\s*</script>', '</script>'
    
    # Fix unclosed script tags - find patterns like <script src="..."> without closing
    # Look for: <script src="..." followed by another <script (without closing tag in between)
    $content = $content -replace '(<script[^>]*src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2">)\s*(<!--)', '$1</script>`n  $2'
    $content = $content -replace '(<script[^>]*src="js/supabase-client\.js[^"]*">)\s*(<!--)', '$1</script>`n  $2'
    $content = $content -replace '(<script[^>]*src="js/universal-data-loader\.js[^"]*">)\s*(<!--)', '$1</script>`n  $2'
    
    # Save fixed content
    $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
    Write-Host "  FIXED: $pageName" -ForegroundColor Green
}

Write-Host ""
Write-Host "All malformed script tags have been fixed!" -ForegroundColor Green

