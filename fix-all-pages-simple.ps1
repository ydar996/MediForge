# Simple script to add universal scripts to ALL HTML pages
Write-Host "Fixing ALL pages for universal data sync..." -ForegroundColor Green

# Get all HTML files
$htmlFiles = Get-ChildItem -Path . -Filter "*.html"

Write-Host "Found $($htmlFiles.Count) HTML files to process" -ForegroundColor Yellow

$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    
    # Skip login and register pages
    if ($fileName -eq "login.html" -or $fileName -eq "register.html" -or $fileName -eq "index.html") {
        Write-Host "Skipping $fileName (login/static page)" -ForegroundColor Gray
        continue
    }
    
    $needsUpdate = $false
    $newContent = $content
    
    # Add universal data loader if missing
    if ($newContent -notmatch 'universal-data-loader\.js') {
        Write-Host "Adding universal data loader to $fileName" -ForegroundColor Cyan
        if ($newContent -match '(\s*</body>)') {
            $scriptsToAdd = @"
  <script src="js/universal-data-loader.js?v=1"></script>
$1
"@
            $newContent = $newContent -replace '(\s*</body>)', $scriptsToAdd
            $needsUpdate = $true
        }
    }
    
    # Add universal sync status if missing
    if ($newContent -notmatch 'universal-sync-status\.js') {
        Write-Host "Adding universal sync status to $fileName" -ForegroundColor Cyan
        if ($newContent -match '(\s*</body>)') {
            $scriptsToAdd = @"
  <script src="js/universal-sync-status.js?v=1"></script>
$1
"@
            $newContent = $newContent -replace '(\s*</body>)', $scriptsToAdd
            $needsUpdate = $true
        }
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "Updated $fileName" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host "Processed $processedCount files" -ForegroundColor Green
