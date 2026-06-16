# Sync orchestrator env vars to Vercel project atlas-v0-5.
# Requires: vercel login (or VERCEL_TOKEN in environment)
# Usage: .\scripts\set-vercel-orchestrator-env.ps1

$ErrorActionPreference = "Stop"
$RailwayAgentsUrl = "https://agents-production-d347.up.railway.app"

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Error "vercel CLI not found. Run: npm i -g vercel && vercel login"
}

Write-Host "Linking atlas-v0-5 (if needed)..."
vercel link --yes --project atlas-v0-5 --scope dayoodunlamis-projects 2>$null

$vars = @{
  "ATLAS5_ORCHESTRATOR_V1" = "true"
  "NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1" = "true"
  "PYTHON_AGENTS_URL" = $RailwayAgentsUrl
}

foreach ($envName in $vars.Keys) {
  $value = $vars[$envName]
  Write-Host "Setting $envName for production, preview, development..."
  $value | vercel env add $envName production preview development --force 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  (may already exist — use Vercel dashboard to update if needed)"
  }
}

Write-Host "Done. Verify: vercel env ls production"
