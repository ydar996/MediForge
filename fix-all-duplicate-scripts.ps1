# Fix ALL duplicate universal-data-loader scripts across ALL HTML files
Write-Host "Fixing ALL duplicate universal-data-loader scripts..." -ForegroundColor Red

$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    
    # Count current duplicates
    $currentCount = ([regex]::Matches($content, 'universal-data-loader\.js')).Count
    
    if ($currentCount -gt 1) {
        Write-Host "Fixing $fileName ($currentCount duplicates)" -ForegroundColor Yellow
        
        # Remove ALL universal-data-loader script tags
        $content = $content -replace '<script src="js/universal-data-loader\.js\?v=[^"]*"></script>[^<]*<!-- Universal data loader[^>]*-->', ''
        $content = $content -replace '<script src="js/universal-data-loader\.js\?v=[^"]*"></script>', ''
        
        # Remove ALL universal-sync-status script tags
        $content = $content -replace '<script src="js/universal-sync-status\.js\?v=[^"]*"></script>[^<]*<!-- Universal sync status[^>]*-->', ''
        $content = $content -replace '<script src="js/universal-sync-status\.js\?v=[^"]*"></script>', ''
        
        # Clean up malformed script tags
        $content = $content -replace '</script>\s*</script>', '</script>'
        $content = $content -replace '</script>\s*<!-- [^>]* -->\s*<script[^>]*></script>', '</script>'
        
        # Add the correct scripts before </body> tag
        $bodyEndPattern = '</body>'
        $correctScripts = @"

  <!-- Supabase Client -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="js/supabase-client.js"></script>
  
  <!-- Universal Scripts -->
  <script src="js/universal-data-loader.js?v=2"></script>  <!-- Universal data loader with Supabase priority -->
  <script src="js/universal-sync-status.js?v=2"></script>  <!-- Universal sync status indicator -->

"@
        
        # Only add if not already present
        if ($content -notmatch 'supabase-client\.js') {
            $content = $content -replace $bodyEndPattern, ($correctScripts + "`n" + $bodyEndPattern)
        }
        
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        $processedCount++
    }
}

Write-Host "`nProcessed $processedCount files with duplicate scripts" -ForegroundColor Green
