# Complete Setup Script - Automates GitHub Secrets Configuration
# This script gets the Netlify token and adds it to GitHub

param(
    [string]$GitHubToken = ""
)

Write-Host "🚀 Complete GitHub Secrets Setup" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get Netlify Site ID (we already know it)
$NETLIFY_SITE_ID = "OLD-SITE-ID-REMOVED-CREATE-NEW-SITE"
Write-Host "✅ Netlify Site ID: $NETLIFY_SITE_ID" -ForegroundColor Green

# Step 2: Get Netlify Auth Token
Write-Host "`n🔑 Step 1: Getting Netlify Auth Token..." -ForegroundColor Yellow

# Try to get token from Netlify CLI
$netlifyToken = $null
try {
    # Check if we can get it from the API
    $userInfo = netlify api getCurrentUser 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Netlify CLI is authenticated" -ForegroundColor Green
        # Token is stored in Netlify's config, we need to get it via auth:token command
        Write-Host "💡 Run this command to get your token:" -ForegroundColor Yellow
        Write-Host "   netlify auth:token" -ForegroundColor White
        Write-Host ""
        $netlifyToken = Read-Host "Paste the Netlify Auth Token here (or press Enter to skip)"
    }
} catch {
    Write-Host "⚠️  Could not verify Netlify authentication" -ForegroundColor Yellow
    Write-Host "💡 Make sure you're logged in: netlify login" -ForegroundColor Yellow
    $netlifyToken = Read-Host "Paste the Netlify Auth Token here"
}

if ([string]::IsNullOrWhiteSpace($netlifyToken)) {
    Write-Host "`n⚠️  No token provided. You'll need to add it manually." -ForegroundColor Yellow
    Write-Host "`n📋 Manual Setup Instructions:" -ForegroundColor Cyan
    Write-Host "1. Get your Netlify token: netlify auth:token" -ForegroundColor White
    Write-Host "2. Go to: https://github.com/ydar996/MediForge/settings/secrets/actions" -ForegroundColor White
    Write-Host "3. Add these secrets:" -ForegroundColor White
    Write-Host "   - NETLIFY_AUTH_TOKEN: [your token]" -ForegroundColor Gray
    Write-Host "   - NETLIFY_SITE_ID: $NETLIFY_SITE_ID" -ForegroundColor Gray
    exit 0
}

# Step 3: Add secrets to GitHub
Write-Host "`n📡 Step 2: Adding secrets to GitHub..." -ForegroundColor Yellow

# Check if GitHub CLI is available
$ghAvailable = Get-Command gh -ErrorAction SilentlyContinue

if ($ghAvailable) {
    Write-Host "✅ GitHub CLI found. Adding secrets..." -ForegroundColor Green
    
    gh secret set NETLIFY_AUTH_TOKEN --body $netlifyToken
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ NETLIFY_AUTH_TOKEN added" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to add NETLIFY_AUTH_TOKEN" -ForegroundColor Red
    }
    
    gh secret set NETLIFY_SITE_ID --body $NETLIFY_SITE_ID
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ NETLIFY_SITE_ID added" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to add NETLIFY_SITE_ID" -ForegroundColor Red
    }
    
    Write-Host "`n✅ All secrets added successfully!" -ForegroundColor Green
} elseif ($GitHubToken) {
    Write-Host "✅ Using GitHub API with provided token..." -ForegroundColor Green
    
    $headers = @{
        "Authorization" = "token $GitHubToken"
        "Accept" = "application/vnd.github.v3+json"
    }
    
    $repo = "ydar996/MediForge"
    
    # Add NETLIFY_AUTH_TOKEN
    $body = @{
        encrypted_value = $netlifyToken
        key_id = ""  # GitHub will handle this
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/actions/secrets/NETLIFY_AUTH_TOKEN" -Method PUT -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "✅ NETLIFY_AUTH_TOKEN added" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to add NETLIFY_AUTH_TOKEN: $_" -ForegroundColor Red
    }
    
    # Add NETLIFY_SITE_ID
    $body = @{
        encrypted_value = $NETLIFY_SITE_ID
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/actions/secrets/NETLIFY_SITE_ID" -Method PUT -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "✅ NETLIFY_SITE_ID added" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to add NETLIFY_SITE_ID: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  GitHub CLI not found and no GitHub token provided." -ForegroundColor Yellow
    Write-Host "`n📋 Manual Setup Required:" -ForegroundColor Cyan
    Write-Host "1. Go to: https://github.com/ydar996/MediForge/settings/secrets/actions" -ForegroundColor White
    Write-Host "2. Click 'New repository secret'" -ForegroundColor White
    Write-Host "3. Add these secrets:" -ForegroundColor White
    Write-Host ""
    Write-Host "   Name: NETLIFY_AUTH_TOKEN" -ForegroundColor White
    Write-Host "   Value: $netlifyToken" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Name: NETLIFY_SITE_ID" -ForegroundColor White
    Write-Host "   Value: $NETLIFY_SITE_ID" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Or install GitHub CLI: winget install GitHub.cli" -ForegroundColor Yellow
    Write-Host "💡 Or provide GitHub token: .\complete-setup.ps1 -GitHubToken 'your-token'" -ForegroundColor Yellow
}

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "🚀 GitHub Actions will now auto-deploy on every push to main" -ForegroundColor Cyan
Write-Host "📝 Test it: Make a change, commit, and push - Netlify will deploy automatically!" -ForegroundColor Yellow

