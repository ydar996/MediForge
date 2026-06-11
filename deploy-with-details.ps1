# Deploy with Detailed Message - Quick deployment script with automatic detailed messages
# Usage: .\deploy-with-details.ps1
#        .\deploy-with-details.ps1 -CustomMessage "Your custom message"

param(
    [string]$CustomMessage = ""
)

Write-Host "Deploy with Detailed Message" -ForegroundColor Cyan
Write-Host ""

# Check if there are uncommitted changes
$status = git status --short
if ($status) {
    Write-Host "You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host $status
    $commit = Read-Host "Do you want to commit these changes first? (y/n)"
    if ($commit -eq 'y' -or $commit -eq 'Y') {
        $commitMessage = Read-Host "Enter commit message"
        if ([string]::IsNullOrWhiteSpace($commitMessage)) {
            $commitMessage = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        }
        git add -A
        git commit -m $commitMessage
        git push origin main
        Write-Host "Changes committed and pushed" -ForegroundColor Green
    }
}

# Generate detailed deployment message
if ([string]::IsNullOrWhiteSpace($CustomMessage)) {
    Write-Host "Generating detailed deployment message from recent commits..." -ForegroundColor Yellow
    
    # Get latest commit info
    $latestCommit = git log -1 --pretty=format:"%h - %s"
    $commitHash = git rev-parse --short HEAD
    $commitDate = git log -1 --pretty=format:"%ad" --date=short
    
    # Get changed files
    $changedFiles = git diff-tree --no-commit-id --name-only -r HEAD
    
    # Categorize files
    $htmlFiles = @($changedFiles | Where-Object { $_ -like "*.html" })
    $jsFiles = @($changedFiles | Where-Object { $_ -like "*.js" })
    $cssFiles = @($changedFiles | Where-Object { $_ -like "*.css" })
    $configFiles = @($changedFiles | Where-Object { $_ -like "*.toml" -or $_ -like "*.json" -or $_ -like ".gitignore" })
    $otherFiles = @($changedFiles | Where-Object { $_ -notlike "*.html" -and $_ -notlike "*.js" -and $_ -notlike "*.css" -and $_ -notlike "*.toml" -and $_ -notlike "*.json" -and $_ -ne ".gitignore" })
    
    # Build detailed message
    $fileCount = $changedFiles.Count
    $CustomMessage = "Deploy: $latestCommit"
    $changesHeader = 'Changes (' + $fileCount + ' files):'
    $CustomMessage += [Environment]::NewLine + [Environment]::NewLine + $changesHeader
    
    if ($htmlFiles.Count -gt 0) {
        $htmlCount = $htmlFiles.Count
        $htmlList = $htmlFiles -join ', '
        $CustomMessage += [Environment]::NewLine + "  HTML: $htmlCount file(s) - $htmlList" + [Environment]::NewLine
    }
    if ($jsFiles.Count -gt 0) {
        $jsCount = $jsFiles.Count
        $jsList = $jsFiles -join ', '
        $CustomMessage += [Environment]::NewLine + "  JavaScript: $jsCount file(s) - $jsList" + [Environment]::NewLine
    }
    if ($cssFiles.Count -gt 0) {
        $cssCount = $cssFiles.Count
        $cssList = $cssFiles -join ', '
        $CustomMessage += [Environment]::NewLine + "  CSS: $cssCount file(s) - $cssList" + [Environment]::NewLine
    }
    if ($configFiles.Count -gt 0) {
        $configCount = $configFiles.Count
        $configList = $configFiles -join ', '
        $CustomMessage += [Environment]::NewLine + "  Config: $configCount file(s) - $configList" + [Environment]::NewLine
    }
    if ($otherFiles.Count -gt 0) {
        $otherCount = $otherFiles.Count
        $otherListArray = $otherFiles | Select-Object -First 5
        $otherList = $otherListArray -join ', '
        $CustomMessage += [Environment]::NewLine + "  Other: $otherCount file(s)"
        if ($otherCount -le 5) {
            $CustomMessage += " - $otherList" + [Environment]::NewLine
        } else {
            $remaining = $otherCount - 5
            $CustomMessage += " - $otherList ... and $remaining more" + [Environment]::NewLine
        }
    }
    
    $commitInfo = "Commit: $commitHash | Date: $commitDate"
    $CustomMessage += [Environment]::NewLine + [Environment]::NewLine + $commitInfo
    
    Write-Host ""
    Write-Host "Generated message:" -ForegroundColor Green
    Write-Host $CustomMessage -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Using custom message: $CustomMessage" -ForegroundColor Yellow
}

# Deploy to Netlify
Write-Host "Deploying to Netlify..." -ForegroundColor Cyan

# Clean message for Netlify (single line, reasonable length)
$netlifyMessage = $CustomMessage -replace [Environment]::NewLine, " | "
# Use double quotes for regex pattern to properly interpret \s+ as whitespace regex
$netlifyMessage = $netlifyMessage -replace "\s+", " "
if ($netlifyMessage.Length -gt 250) {
    $truncated = $netlifyMessage.Substring(0, 247)
    $netlifyMessage = $truncated + " ..."
}

netlify deploy --prod --message $netlifyMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host "Site: https://mediforge.netlify.app" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Deployment failed" -ForegroundColor Red
    exit 1
}