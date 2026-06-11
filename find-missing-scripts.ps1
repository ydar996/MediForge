# Find files missing universal scripts
Write-Host "Finding files missing universal scripts..." -ForegroundColor Yellow

$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$missingScripts = @()

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Check if file has any of the universal scripts
    $hasUniversalDataLoader = $content -match 'universal-data-loader\.js'
    $hasUniversalSyncStatus = $content -match 'universal-sync-status\.js'
    
    if (-not $hasUniversalDataLoader -and -not $hasUniversalSyncStatus) {
        $missingScripts += $file.Name
    }
}

Write-Host "`nFiles missing universal scripts:" -ForegroundColor Red
if ($missingScripts.Count -gt 0) {
    $missingScripts | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
} else {
    Write-Host "  None - all files have universal scripts!" -ForegroundColor Green
}

Write-Host "`nTotal files missing scripts: $($missingScripts.Count)" -ForegroundColor Cyan
