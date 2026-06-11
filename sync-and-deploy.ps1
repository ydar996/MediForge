# Sync and Deploy Script - Ensures everything is synced before deploying
# This script: 1) Checks sync, 2) Commits changes, 3) Pushes to git, 4) Deploys to Netlify

param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "",
    [switch]$GenerateDetailedMessage = $false
)

Write-Host "🚀 Sync and Deploy Script" -ForegroundColor Cyan

# Generate detailed message if requested or if no message provided
if ($GenerateDetailedMessage -or [string]::IsNullOrWhiteSpace($Message)) {
    Write-Host "📝 Generating detailed deployment message..." -ForegroundColor Yellow
    $detailedMessage = & "$PSScriptRoot\generate-deploy-message.ps1" -CommitCount 3
    if ($detailedMessage) {
        $Message = $detailedMessage
    }
}

if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = Read-Host "Enter deployment message (or press Enter to generate detailed message)"
    if ([string]::IsNullOrWhiteSpace($Message)) {
        $detailedMessage = & "$PSScriptRoot\generate-deploy-message.ps1" -CommitCount 3
        if ($detailedMessage) {
            $Message = $detailedMessage
        } else {
            $Message = "Deploy: $(git log -1 --pretty=format:'%s')"
        }
    }
}

Write-Host "Message: $Message" -ForegroundColor Yellow

# Step 1: Check for uncommitted changes
Write-Host "`n📋 Step 1: Checking for changes..." -ForegroundColor Yellow
$changes = git status --short
if ($changes) {
    Write-Host "✅ Found changes, staging them..." -ForegroundColor Green
    git add -A
    git commit -m $Message
    Write-Host "✅ Changes committed" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No changes to commit" -ForegroundColor Gray
}

# Step 2: Push to git
Write-Host "`n📡 Step 2: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Pushed to GitHub successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to push to GitHub" -ForegroundColor Red
    exit 1
}

# Step 3: Deploy to Netlify
Write-Host "`n🚀 Step 3: Deploying to Netlify..." -ForegroundColor Yellow

# Clean up message for Netlify (remove markdown formatting, keep it concise but detailed)
$netlifyMessage = $Message -replace "`n", " | " -replace "📋|📝|🔗|•", "" -replace "\s+", " "
# Limit length to avoid issues
if ($netlifyMessage.Length -gt 200) {
    $netlifyMessage = $netlifyMessage.Substring(0, 197) + "..."
}

netlify deploy --prod --message $netlifyMessage
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployed to Netlify successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to deploy to Netlify" -ForegroundColor Red
    exit 1
}

# Step 4: Verify sync
Write-Host "`n✅ Step 4: Verifying sync..." -ForegroundColor Yellow
$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse origin/main

if ($localCommit -eq $remoteCommit) {
    Write-Host "✅ All systems in sync!" -ForegroundColor Green
    Write-Host "   Local:  $localCommit" -ForegroundColor Gray
    Write-Host "   Remote: $remoteCommit" -ForegroundColor Gray
    Write-Host "   Netlify: Deployed" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Warning: Local and remote commits don't match" -ForegroundColor Yellow
}

Write-Host "`n🎉 Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Site: https://mediforge.netlify.app" -ForegroundColor Cyan

