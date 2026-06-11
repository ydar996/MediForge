# Check for duplicate universal-data-loader scripts
Write-Host "Checking for duplicate universal-data-loader scripts..." -ForegroundColor Yellow

$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$duplicateFiles = @()

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $count = ([regex]::Matches($content, 'universal-data-loader\.js')).Count
    
    if ($count -gt 1) {
        $duplicateFiles += "$($file.Name): $count duplicates"
    }
}

if ($duplicateFiles.Count -gt 0) {
    Write-Host "Files with duplicate universal-data-loader scripts:" -ForegroundColor Red
    $duplicateFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
} else {
    Write-Host "No duplicate universal-data-loader scripts found!" -ForegroundColor Green
}

Write-Host "Total files checked: $($htmlFiles.Count)" -ForegroundColor Cyan
