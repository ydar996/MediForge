# Export the database structure (tables, security rules, functions - NO data)
# from an existing Supabase project, so you can paste it into a new project.
#
# What you need: the database connection string of the SOURCE project.
#   Supabase Dashboard -> your old project -> Connect (top bar) -> Direct connection
#   It looks like: postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
#
# Docker Desktop must be running (the Supabase tool uses it behind the scenes).
#
# Usage (PowerShell, from the MediForge folder):
#   .\scripts\export-database-schema.ps1 -DbUrl "postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres"
#
# Output: mediforge-schema.sql in the MediForge folder.
# Then open your NEW Supabase project -> SQL Editor -> paste the file contents -> Run.

param(
  [Parameter(Mandatory = $true)]
  [string]$DbUrl
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Exporting database structure (no patient data)..." -ForegroundColor Cyan
npx supabase db dump --db-url $DbUrl -f mediforge-schema.sql

if (Test-Path "$root\mediforge-schema.sql") {
  Write-Host ""
  Write-Host "Done! File created: $root\mediforge-schema.sql" -ForegroundColor Green
  Write-Host "Next: open your NEW Supabase project -> SQL Editor -> paste the file contents -> Run."
} else {
  Write-Host "Something went wrong - the schema file was not created." -ForegroundColor Red
}
