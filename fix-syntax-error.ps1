# Fix syntax error in patients.js and update timestamp
Write-Host "Fixing syntax error in patients.js and updating timestamp..." -ForegroundColor Red

$newTimestamp = "20251018193316"

# Update patients.js version in all HTML files
$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    $needsUpdate = $false
    $newContent = $content
    
    # Replace patients.js version
    if ($newContent -match 'patients\.js\?v=20251018193010') {
        $newContent = $newContent -replace 'patients\.js\?v=20251018193010', "patients.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "Updated $fileName with patients.js timestamp $newTimestamp" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host "`nFixed syntax error and updated $processedCount files with timestamp $newTimestamp" -ForegroundColor Green
