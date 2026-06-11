# PowerShell script to add cache busting to all HTML pages
# This ensures all pages get fresh content, not just register/login

$htmlFiles = Get-ChildItem -Path "." -Filter "*.html" -Recurse | Where-Object { $_.Name -notlike "*test*" -and $_.Name -notlike "*backup*" }

foreach ($file in $htmlFiles) {
    Write-Host "Processing: $($file.FullName)"
    
    $content = Get-Content $file.FullName -Raw
    
    # Check if file already has cache busting
    if ($content -match "Cache-Control.*no-cache") {
        Write-Host "  Already has cache busting - skipping"
        continue
    }
    
    # Add cache busting meta tags to head section
    $cacheBustingMeta = @"
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
"@
    
    # Insert after <head> tag
    if ($content -match "<head>") {
        $content = $content -replace "<head>", "<head>$cacheBustingMeta"
        Write-Host "  Added cache busting meta tags"
    }
    
    # Update script version parameters
    $currentTime = [DateTime]::Now.ToString("yyyyMMddHHmmss")
    $content = $content -replace 'v=\d{14}', "v=$currentTime"
    $content = $content -replace 'v=\d{10}', "v=$currentTime"
    $content = $content -replace 'v=\d{8}', "v=$currentTime"
    
    # Add service worker registration if not present
    if ($content -notmatch "serviceWorker") {
        $serviceWorkerScript = @"
  
  <!-- Service Worker for Automatic Cache Busting -->
  <script>
    // Register service worker for automatic cache busting
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw-cache-buster.js?v=' + new Date().getTime())
          .then(function(registration) {
            console.log('🔄 Service Worker registered for cache busting');
          })
          .catch(function(error) {
            console.log('Service Worker registration failed:', error);
          });
      });
    }
  </script>
"@
        
        # Add before closing </body> tag
        if ($content -match "</body>") {
            $content = $content -replace "</body>", "$serviceWorkerScript`n</body>"
            Write-Host "  Added service worker registration"
        }
    }
    
    # Save the updated content
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "  Updated: $($file.Name)"
}

Write-Host "Cache busting added to all HTML pages!"
