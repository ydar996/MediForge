# Fix literal \n strings in HTML files

$brokenPages = @(
    'payment-receipts.html',
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
        continue
    }
    
    Write-Host "Fixing: $pageName" -ForegroundColor Cyan
    
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    
    # Fix literal backtick-n strings
    $content = $content -replace '`n', "`n"
    $content = $content -replace '\\n', "`n"
    
    # Fix script tags with literal strings
    $content = $content -replace '"></script>`n  <!--', '"></script>`n`n  <!--'
    
    $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
    Write-Host "  Fixed: $pageName" -ForegroundColor Green
}

