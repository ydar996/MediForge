# PowerShell Script: Add Supabase Sync Notifications to All HTML Files
# Purpose: Add universal sync notification system to all HTML files missing it
# Author: AI Assistant
# Date: $(Get-Date)

Write-Host "🔧 Starting Supabase Sync Notification System Upgrade..." -ForegroundColor Green

# Create backup first
$backupDir = "sync-upgrade-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host "📁 Creating backup in: $backupDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Find all HTML files missing universal-sync-status
$htmlFiles = Get-ChildItem -Path "*.html" | Where-Object { 
    $content = Get-Content $_.FullName -Raw
    $content -notmatch "universal-sync-status"
}

Write-Host "📊 Found $($htmlFiles.Count) HTML files missing sync notification system" -ForegroundColor Cyan

# Script block to add (same as working files)
$scriptBlock = @"

  <!-- Supabase Client -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="js/supabase-client.js?v=20251019050000"></script>
  
  <!-- Universal Scripts -->
  <script src="js/universal-data-loader.js?v=20251019050000"></script>  <!-- Universal data loader with Supabase priority -->
  <script src="js/universal-sync-status.js?v=20251019050000"></script>  <!-- Universal sync status indicator -->
</body>
</html>
"@

$updatedCount = 0
$errorCount = 0

foreach ($file in $htmlFiles) {
    try {
        Write-Host "🔄 Processing: $($file.Name)" -ForegroundColor Blue
        
        # Create backup of original file
        Copy-Item $file.FullName "$backupDir\$($file.Name)"
        
        # Read file content
        $content = Get-Content $file.FullName -Raw
        
        # Check if file has proper closing tags
        if ($content -match "</body>\s*</html>") {
            # Replace the closing tags with our script block
            $newContent = $content -replace "</body>\s*</html>", $scriptBlock
            Set-Content -Path $file.FullName -Value $newContent -NoNewline
            $updatedCount++
            Write-Host "  ✅ Updated successfully" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Skipped - unusual file structure" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "  ❌ Error processing $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host "`n📊 Upgrade Summary:" -ForegroundColor Green
Write-Host "  ✅ Successfully updated: $updatedCount files" -ForegroundColor Green
Write-Host "  ❌ Errors encountered: $errorCount files" -ForegroundColor Red
Write-Host "  📁 Backup created in: $backupDir" -ForegroundColor Yellow

if ($errorCount -eq 0) {
    Write-Host "`n🎉 All files updated successfully!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some files had errors. Check the backup folder for originals." -ForegroundColor Yellow
}

Write-Host "`n🔍 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Test a few updated files locally" -ForegroundColor White
Write-Host "  2. Verify sync notifications appear" -ForegroundColor White
Write-Host "  3. If issues arise, restore from backup folder" -ForegroundColor White
