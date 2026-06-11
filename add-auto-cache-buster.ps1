# Auto Cache Buster Script
# Adds automatic mobile cache busting to all critical pages

$htmlDir = "C:\Users\yinka\Documents\MediForge"
$cacheBusterVersion = "20251022020000"

# Critical pages that need auto cache busting
$criticalPages = @(
    "login.html",
    "dashboard.html", 
    "patients.html",
    "appointments.html",
    "register.html",
    "index.html"
)

# Auto cache buster script tag
$cacheBusterScript = @"
  
  <!-- Auto Cache Buster for Mobile -->
  <script src="js/auto-cache-buster.js?v=$cacheBusterVersion"></script>
"@

foreach ($page in $criticalPages) {
    $filePath = Join-Path $htmlDir $page
    
    if (Test-Path $filePath) {
        Write-Host "Processing: $page"
        
        $content = Get-Content $filePath -Raw
        
        # Check if auto cache buster is already present
        if ($content -match 'auto-cache-buster\.js') {
            Write-Host "  Already has auto cache buster - skipping"
            continue
        }
        
        # Find the first <link> tag and add the script after it
        if ($content -match '(<link[^>]+>)') {
            $content = $content -replace '(<link[^>]+>)', "`$1$cacheBusterScript"
            Set-Content -Path $filePath -Value $content -Encoding UTF8
            Write-Host "  Added auto cache buster to $page"
        } else {
            Write-Host "  No <link> tag found in $page - skipping"
        }
    } else {
        Write-Host "File not found: $page"
    }
}

Write-Host "Auto cache buster added to critical pages!"
Write-Host "This will automatically fix mobile cache issues for all users."
