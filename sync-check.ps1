# Sync Check Script - Ensures Local, Git, and Netlify are in sync
# Run this before making changes or deploying

Write-Host "🔄 Checking sync status..." -ForegroundColor Cyan

# Check git status
Write-Host "`n📋 Git Status:" -ForegroundColor Yellow
$gitStatus = git status --short
if ($gitStatus) {
    Write-Host "⚠️  WARNING: You have uncommitted changes!" -ForegroundColor Red
    Write-Host $gitStatus
    Write-Host "`n💡 Run: git add -A && git commit -m 'Your message' && git push" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ Working directory is clean" -ForegroundColor Green
}

# Check if local is ahead/behind remote
Write-Host "`n📡 Git Remote Status:" -ForegroundColor Yellow
$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse origin/main 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Could not fetch remote status. Run: git fetch" -ForegroundColor Yellow
} else {
    if ($localCommit -eq $remoteCommit) {
        Write-Host "✅ Local and remote are in sync" -ForegroundColor Green
    } else {
        $localAhead = git rev-list --count origin/main..HEAD
        $remoteAhead = git rev-list --count HEAD..origin/main
        
        if ($localAhead -gt 0) {
            Write-Host "⚠️  Local is $localAhead commit(s) ahead of remote" -ForegroundColor Yellow
            Write-Host "💡 Run: git push" -ForegroundColor Yellow
        }
        if ($remoteAhead -gt 0) {
            Write-Host "⚠️  Remote is $remoteAhead commit(s) ahead of local" -ForegroundColor Yellow
            Write-Host "💡 Run: git pull" -ForegroundColor Yellow
        }
    }
}

# Check latest commit
Write-Host "`n📝 Latest Commit:" -ForegroundColor Yellow
git log -1 --oneline

Write-Host "`n✅ Sync check complete!" -ForegroundColor Green
Write-Host "💡 To deploy to Netlify: netlify deploy --prod" -ForegroundColor Cyan

