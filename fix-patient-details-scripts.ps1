# Fix patient-details.html script corruption
Write-Host "Fixing patient-details.html script corruption..." -ForegroundColor Yellow

$content = Get-Content "patient-details.html" -Raw

# Remove all the duplicate universal-data-loader scripts and malformed script tags
$content = $content -replace '<script src="js/universal-data-loader\.js\?v=2"></script>  <!-- Universal data loader with Supabase priority -->\s*</script>', ''
$content = $content -replace '<script src="js/universal-data-loader\.js\?v=2"></script>  <!-- Universal data loader with Supabase priority -->', ''

# Clean up any remaining malformed script tags
$content = $content -replace '</script>\s*</script>', '</script>'
$content = $content -replace '</script>\s*<!-- [^>]* -->\s*<script src="js/universal-data-loader\.js\?v=2"></script>', ''

# Find the proper location to add the correct scripts (before the closing </body> tag)
$bodyEndPattern = '</body>'
$correctScripts = @"

  <!-- Supabase Client -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="js/supabase-client.js"></script>
  
  <!-- Universal Scripts -->
  <script src="js/universal-data-loader.js?v=2"></script>  <!-- Universal data loader with Supabase priority -->
  <script src="js/universal-sync-status.js?v=2"></script>  <!-- Universal sync status indicator -->
  
  <!-- Page-specific Scripts -->
  <script src="js/preventive.js?v=125"></script>  <!-- For gaps -->
  <script src="js/main.js?v=401"></script>  <!-- General helpers -->
  <script src="js/icd11.js?v=125"></script>  <!-- ICD local module -->
  <script src="js/table-alignment-fix.js?v=3"></script>  <!-- Table alignment fix -->
  <script src="js/vaccines.js?v=125"></script>  <!-- Vaccine data -->
  <script src="js/vaccine-selector.js?v=125"></script>  <!-- Vaccine selector -->
  <script src="js/allergy-selector.js?v=125"></script>  <!-- Enhanced allergy selector -->
  <script src="js/icd-selector.js?v=105"></script>  <!-- ICD selector -->
  <script src="js/patients.js?v=284"></script>  <!-- Loads clinical note logic -->
  <script src="js/billing.js?v=1"></script>  <!-- Billing system -->
  <script src="js/pricing.js?v=1"></script>  <!-- Pricing catalog -->

"@

# Replace the body end with scripts + body end
$content = $content -replace $bodyEndPattern, ($correctScripts + "`n" + $bodyEndPattern)

# Remove the malformed script at the end
$content = $content -replace '  </script>  <script src="js/universal-sync-status\.js\?v=2"></script>', ''

Set-Content -Path "patient-details.html" -Value $content -Encoding UTF8

Write-Host "Fixed patient-details.html script corruption" -ForegroundColor Green
