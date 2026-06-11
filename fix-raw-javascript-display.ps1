# Fix raw JavaScript display issue and update timestamp
Write-Host "Fixing raw JavaScript display issue and updating timestamp..." -ForegroundColor Red

$newTimestamp = "20251018195757"

# Update patients.js version in all HTML files
$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    $needsUpdate = $false
    $newContent = $content
    
    # Replace patients.js version
    if ($newContent -match 'patients\.js\?v=20251018193547') {
        $newContent = $newContent -replace 'patients\.js\?v=20251018193547', "patients.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "Updated $fileName with patients.js timestamp $newTimestamp" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host "`nFixed raw JavaScript display issue and updated $processedCount files with timestamp $newTimestamp" -ForegroundColor Green
