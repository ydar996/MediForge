# Verify all HTML files have been updated
Write-Host "Verifying all HTML files have latest versions..." -ForegroundColor Yellow

$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$totalFiles = $htmlFiles.Count
$updatedFiles = 0
$oldVersionFiles = @()

Write-Host "Checking $totalFiles HTML files..." -ForegroundColor Cyan

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $hasOldVersion = $false
    
    # Check for old versions
    if ($content -match 'universal-data-loader\.js\?v=1' -or 
        $content -match 'universal-sync-status\.js\?v=1' -or 
        $content -match 'patients\.js\?v=283' -or 
        $content -match 'appointments\.js\?v=285' -or 
        $content -match 'main\.js\?v=300') {
        $hasOldVersion = $true
        $oldVersionFiles += $file.Name
    }
    
    # Check for new versions
    if ($content -match 'universal-data-loader\.js\?v=2' -or 
        $content -match 'universal-sync-status\.js\?v=2' -or 
        $content -match 'patients\.js\?v=284' -or 
        $content -match 'appointments\.js\?v=286' -or 
        $content -match 'main\.js\?v=401') {
        $updatedFiles++
    }
}

Write-Host "`nRESULTS:" -ForegroundColor Green
Write-Host "Total HTML files: $totalFiles" -ForegroundColor White
Write-Host "Files with new versions: $updatedFiles" -ForegroundColor Green
Write-Host "Files with old versions: $($oldVersionFiles.Count)" -ForegroundColor Red

if ($oldVersionFiles.Count -gt 0) {
    Write-Host "`nFiles still with old versions:" -ForegroundColor Red
    $oldVersionFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
} else {
    Write-Host "`n✅ ALL FILES UPDATED!" -ForegroundColor Green
}
