param(
    [Parameter(Mandatory = $true)]
    [string]$SiteId,
    [switch]$Prod,
    [int]$CommitCount = 5,
    [string]$MessageOverride = ""
)

Write-Host "Preparing Netlify deployment..." -ForegroundColor Cyan

# Generate or accept a deployment message
$message = $MessageOverride
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = & .\generate-deploy-message.ps1 -CommitCount $CommitCount -IncludeWorkingTree
}

if ([string]::IsNullOrWhiteSpace($message)) {
    Write-Host "Deployment message generation failed." -ForegroundColor Red
    exit 1
}

$messageSingle = $message -replace "(\r?\n)+", " | "
$deployArgs = @("netlify-cli", "deploy", "--site", $SiteId, "--message", $messageSingle)
if ($Prod.IsPresent) {
    $deployArgs += "--prod"
}

Write-Host "Prod flag: $($Prod.IsPresent)" -ForegroundColor Cyan
Write-Host "Deploying with message:" -ForegroundColor Green
Write-Host $message -ForegroundColor White
Write-Host "Message sent to Netlify (single line):" -ForegroundColor DarkGray
Write-Host $messageSingle -ForegroundColor DarkGray

npx --yes @($deployArgs)
