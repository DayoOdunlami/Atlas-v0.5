# Sync Atlas 5 agent env vars from .env.local → Railway service.
# Requires: railway CLI logged in (`railway login`) and project linked (`railway link`).
#
# Usage:
#   .\scripts\sync-railway-agent-env.ps1
#   .\scripts\sync-railway-agent-env.ps1 -Service agents -Environment production
#   .\scripts\sync-railway-agent-env.ps1 -DryRun

param(
  [string]$EnvFile = ".env.local",
  [string]$Service = "",
  [string]$Environment = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$Keys = @(
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "POSTGRES_URL",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "EXA_API_KEY",
  "ATLAS5_ORCHESTRATOR_V1",
  "ATLAS5_HARMONIZED_EVIDENCE_V1",
  "ATLAS_V5_WEB_LANE"
)

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  Write-Error "Railway CLI not found. Install: npm i -g @railway/cli && railway login"
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envPath = Join-Path $root $EnvFile
if (-not (Test-Path $envPath)) {
  Write-Error "Missing $envPath"
}

Write-Host "Reading $envPath ..."
$lines = Get-Content $envPath
$vars = @{}
foreach ($line in $lines) {
  $t = $line.Trim()
  if (-not $t -or $t.StartsWith("#")) { continue }
  $eq = $t.IndexOf("=")
  if ($eq -lt 1) { continue }
  $name = $t.Substring(0, $eq).Trim()
  $value = $t.Substring($eq + 1).Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  $vars[$name] = $value
}

$serviceArgs = @()
if ($Service) { $serviceArgs += @("-s", $Service) }
$envArgs = @()
if ($Environment) { $envArgs += @("-e", $Environment) }

Write-Host ""
Write-Host "Railway variables page (after login): https://railway.com/dashboard"
Write-Host "Open your agents service → Variables tab, or run: railway open"
Write-Host ""

$set = 0
$skip = 0
foreach ($key in $Keys) {
  if (-not $vars.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($vars[$key])) {
    Write-Host "  skip $key (not in $EnvFile)"
    $skip++
    continue
  }
  if ($DryRun) {
    Write-Host "  would set $key"
    $set++
    continue
  }
  Write-Host "  setting $key ..."
  $args = @("variable", "set", "${key}=$($vars[$key])", "--skip-deploys") + $serviceArgs + $envArgs
  & railway @args
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set $key. Run 'railway login' and 'railway link' in repo root."
  }
  $set++
}

if (-not $DryRun -and $set -gt 0) {
  Write-Host ""
  Write-Host "Triggering redeploy ..."
  & railway up --detach 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  (redeploy manually from Railway dashboard if 'railway up' is not linked)"
  }
}

Write-Host ""
Write-Host "Done. Set $set, skipped $skip."
Write-Host "Verify: curl https://agents-production-d347.up.railway.app/health"
