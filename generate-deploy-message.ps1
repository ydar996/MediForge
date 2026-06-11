# Generate Detailed Deployment Message from Git Commits
# This script reads recent commits and creates a detailed deployment message

param(
    [int]$CommitCount = 5,
    [switch]$IncludeWorkingTree
)

Write-Host "Generating detailed deployment message..." -ForegroundColor Cyan

# Get recent commits
$commits = git log --oneline -n $CommitCount

if (!$commits) {
    Write-Host "No commits found" -ForegroundColor Yellow
    exit 1
}

# Get the latest commit hash and message
$latestCommit = git log -1 --pretty=format:"%h - %s"
$latestCommitHash = git rev-parse --short HEAD

# Get changed files in the latest commit
$commitFiles = git diff-tree --no-commit-id --name-only -r HEAD

# Include working tree and staged changes when requested
$stagedFiles = @()
$workingFiles = @()
if ($IncludeWorkingTree) {
    $stagedFiles = git diff --name-only --cached
    $workingFiles = git diff --name-only
}

$changedFiles = @($commitFiles + $stagedFiles + $workingFiles | Sort-Object -Unique)

# Count file types
$htmlFiles = ($changedFiles | Where-Object { $_ -like "*.html" }).Count
$jsFiles = ($changedFiles | Where-Object { $_ -like "*.js" }).Count
$cssFiles = ($changedFiles | Where-Object { $_ -like "*.css" }).Count
$otherFiles = ($changedFiles | Where-Object { $_ -notlike "*.html" -and $_ -notlike "*.js" -and $_ -notlike "*.css" }).Count

# Build detailed message
$message = "Deploy: $latestCommit`n`n"
$message += "Scope:`n"
$message += "  - Latest commit: $latestCommitHash`n"
$message += "  - Include working tree: $IncludeWorkingTree`n`n"
$message += "Changes Summary:`n"
$message += "  - HTML files: $htmlFiles`n"
$message += "  - JavaScript files: $jsFiles`n"
$message += "  - CSS files: $cssFiles`n"
$message += "  - Other files: $otherFiles`n"
$message += "`nModified Files:`n"

# List key files (limit to 10 most important)
$importantFiles = $changedFiles | Select-Object -First 10
foreach ($file in $importantFiles) {
    $message += "  - $file`n"
}

if ($changedFiles.Count -gt 10) {
    $remaining = $changedFiles.Count - 10
    $message += "  ... and $remaining more file(s)`n"
}

$message += "`nCommit: $latestCommitHash"

# Strip non-ASCII characters to avoid encoding issues in deploy messages
$message = [Regex]::Replace($message, '[^\x00-\x7F]', '')

# Output the message
Write-Host "`nGenerated deployment message:" -ForegroundColor Green
Write-Host $message -ForegroundColor White

# Save to file for use by deployment scripts
$message | Out-File -FilePath ".deploy-message.txt" -Encoding UTF8

return $message

