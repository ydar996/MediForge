$env:GIT_PAGER = ''
$env:PAGER = ''
Set-Location C:\Users\yinka\Documents\MediForge
git add -A
git commit -m "SYNC: Sync all local changes to match Netlify deployment - includes blood-group-summary.html with platform dashboard button"
git push origin main
Write-Host "Sync complete!"

