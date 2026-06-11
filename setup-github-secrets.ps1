# Setup GitHub Secrets for Netlify Auto-Deployment
# This script helps you add the required secrets to GitHub

Write-Host "🔧 Setting up GitHub Secrets for Netlify Auto-Deployment" -ForegroundColor Cyan
Write-Host ""

# Get Netlify Site ID (we already know it)
$NETLIFY_SITE_ID = "OLD-SITE-ID-REMOVED-CREATE-NEW-SITE"
Write-Host "✅ Netlify Site ID: $NETLIFY_SITE_ID" -ForegroundColor Green

# Get Netlify Auth Token
Write-Host "`n🔑 Getting Netlify Auth Token..." -ForegroundColor Yellow
Write-Host "Please run: netlify login (if not already logged in)" -ForegroundColor Yellow
Write-Host "Then run: netlify auth:token" -ForegroundColor Yellow
Write-Host ""

$NETLIFY_TOKEN = Read-Host "Paste your Netlify Auth Token here"

if ([string]::IsNullOrWhiteSpace($NETLIFY_TOKEN)) {
    Write-Host "❌ Token is required. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Summary:" -ForegroundColor Cyan
Write-Host "  NETLIFY_SITE_ID: $NETLIFY_SITE_ID" -ForegroundColor Gray
Write-Host "  NETLIFY_AUTH_TOKEN: $($NETLIFY_TOKEN.Substring(0, [Math]::Min(10, $NETLIFY_TOKEN.Length)))..." -ForegroundColor Gray

# Check if GitHub CLI is available
$ghAvailable = Get-Command gh -ErrorAction SilentlyContinue

if ($ghAvailable) {
    Write-Host "`n✅ GitHub CLI found. Adding secrets..." -ForegroundColor Green
    
    # Add secrets using GitHub CLI
    gh secret set NETLIFY_AUTH_TOKEN --body $NETLIFY_TOKEN
    gh secret set NETLIFY_SITE_ID --body $NETLIFY_SITE_ID
    
    Write-Host "`n✅ Secrets added successfully!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  GitHub CLI not found. Manual setup required:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Go to: https://github.com/ydar996/MediForge/settings/secrets/actions" -ForegroundColor Cyan
    Write-Host "2. Click 'New repository secret'" -ForegroundColor Cyan
    Write-Host "3. Add these secrets:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Name: NETLIFY_AUTH_TOKEN" -ForegroundColor White
    Write-Host "   Value: $NETLIFY_TOKEN" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Name: NETLIFY_SITE_ID" -ForegroundColor White
    Write-Host "   Value: $NETLIFY_SITE_ID" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Click 'Add secret' for each" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Or install GitHub CLI: winget install GitHub.cli" -ForegroundColor Yellow
}

Write-Host "`n✅ Setup instructions complete!" -ForegroundColor Green
Write-Host "🚀 After adding secrets, GitHub Actions will auto-deploy on every push to main" -ForegroundColor Cyan

