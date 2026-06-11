# Cache Bust All Pages - Force Mobile Devices to Load Latest Code
Write-Host "Cache busting all pages for mobile compatibility..." -ForegroundColor Green

# Get all HTML files
$htmlFiles = Get-ChildItem -Path . -Filter "*.html"

Write-Host "Found $($htmlFiles.Count) HTML files to process" -ForegroundColor Yellow

$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    
    $needsUpdate = $false
    $newContent = $content
    
    # Update universal-data-loader.js version
    if ($newContent -match 'universal-data-loader\.js\?v=1') {
        $newContent = $newContent -replace 'universal-data-loader\.js\?v=1', 'universal-data-loader.js?v=2'
        $needsUpdate = $true
    }
    
    # Update universal-sync-status.js version
    if ($newContent -match 'universal-sync-status\.js\?v=1') {
        $newContent = $newContent -replace 'universal-sync-status\.js\?v=1', 'universal-sync-status.js?v=2'
        $needsUpdate = $true
    }
    
    # Update patients.js version
    if ($newContent -match 'patients\.js\?v=283') {
        $newContent = $newContent -replace 'patients\.js\?v=283', 'patients.js?v=284'
        $needsUpdate = $true
    }
    
    # Update appointments.js version
    if ($newContent -match 'appointments\.js\?v=285') {
        $newContent = $newContent -replace 'appointments\.js\?v=285', 'appointments.js?v=286'
        $needsUpdate = $true
    }
    
    # Update main.js version
    if ($newContent -match 'main\.js\?v=300') {
        $newContent = $newContent -replace 'main\.js\?v=300', 'main.js?v=401'
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "Updated $fileName" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host "Processed $processedCount files" -ForegroundColor Green
