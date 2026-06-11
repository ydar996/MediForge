# Sync all files to git to match Netlify deployment
git --no-pager add -A
git --no-pager status --short > git-status.txt
Write-Host "Files staged. Check git-status.txt for details."

