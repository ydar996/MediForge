# Check for remaining old versions in HTML files
Write-Host "Checking for remaining old versions..." -ForegroundColor Yellow

$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$oldVersions = @()

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    
    if ($content -match 'universal-data-loader\.js\?v=1' -or 
        $content -match 'universal-sync-status\.js\?v=1' -or 
        $content -match 'patients\.js\?v=283' -or 
        $content -match 'appointments\.js\?v=285' -or 
        $content -match 'main\.js\?v=300') {
        $oldVersions += $file.Name
    }
}

if ($oldVersions.Count -gt 0) {
    Write-Host "Found $($oldVersions.Count) files with old versions:" -ForegroundColor Red
    $oldVersions | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
} else {
    Write-Host "All files have been updated!" -ForegroundColor Green
}

Write-Host "Total HTML files: $($htmlFiles.Count)" -ForegroundColor Cyan
Write-Host "Files with old versions: $($oldVersions.Count)" -ForegroundColor Cyan
