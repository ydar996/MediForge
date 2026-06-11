$ErrorActionPreference = 'Stop'
$root = 'C:\Users\yinka\Documents\MediForge'

# Rename diagnose page if present
$diagOld = Join-Path $root 'diagnose-mediforge-app.html'
$diagNew = Join-Path $root 'diagnose-mediforge-app.html'
if (Test-Path $diagOld) {
  Move-Item -LiteralPath $diagOld -Destination $diagNew -Force
  Write-Host 'Renamed diagnose-mediforge-app.html -> diagnose-mediforge-app.html'
}

# Rename org patient-id module
$orgOld = Join-Path $root 'js\mediforge-org-patient-id.js'
$orgNew = Join-Path $root 'js\mediforge-org-patient-id.js'
if (Test-Path $orgOld) {
  Move-Item -LiteralPath $orgOld -Destination $orgNew -Force
  Write-Host 'Renamed js/mediforge-org-patient-id.js -> js/mediforge-org-patient-id.js'
}

$ext = @('.html','.js','.md','.txt','.ps1','.cjs','.mjs','.json','.toml','.css')
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $ext -contains $_.Extension.ToLower() -or $_.Name -eq '_redirects'
}

$replacements = @(
  @('mediforge-org-patient-id.js', 'mediforge-org-patient-id.js'),
  @('diagnose-mediforge-app.html', 'diagnose-mediforge-app.html'),
  @('diagnose-mediforge-app', 'diagnose-mediforge-app'),
  @('MFASC_ORGANIZATION_ID', 'MFASC_ORGANIZATION_ID'),
  @('MFASC_DEFAULT_PATIENT_ID_PREFIX', 'MFASC_DEFAULT_PATIENT_ID_PREFIX'),
  @('window.mf', 'window.mf'),
  @('function mf', 'function mf'),
  @('mediforgeAppVersion', 'mediforgeAppVersion'),
  @('mediforge_session_token', 'mediforge_session_token'),
  @('mediforge_session', 'mediforge_session'),
  @('mediforge_cookie_test', 'mediforge_cookie_test'),
  @('mediforge_pv_banner_snooze_', 'mediforge_pv_banner_snooze_'),
  @('mediforge-cache', 'mediforge-cache'),
  @('mediforge-static', 'mediforge-static'),
  @('mediforge-dynamic', 'mediforge-dynamic'),
  @('MediForge Dashboard', 'MediForge Dashboard'),
  @('MediForge', 'MediForge'),
  @('MediForge', 'MediForge'),
  @('MediForge', 'MediForge'),
  @('MediForge', 'MediForge'),
  @('MediForge', 'MediForge'),
  @('MediForge', 'MediForge'),
  @('in MediForge', 'in MediForge'),
  @('to the MediForge drug format', 'to the MediForge drug format'),
  @('MediForge format (DRUG_DATABASE)', 'MediForge format (DRUG_DATABASE)')
)

$changed = 0
foreach ($f in $files) {
  if ($f.FullName -match '\\node_modules\\') { continue }
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  $text = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $text
  foreach ($pair in $replacements) {
    $text = $text.Replace($pair[0], $pair[1])
  }
  if ($text -ne $orig) {
    $enc = New-Object System.Text.UTF8Encoding($hasBom)
    [System.IO.File]::WriteAllText($f.FullName, $text, $enc)
    $changed++
  }
}
Write-Host "Updated $changed files"
