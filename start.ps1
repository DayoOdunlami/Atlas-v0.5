# Atlas 5 — start everything from the right directory.
# Run from the repo root: .\start.ps1
#
# Starts:
#   - Next.js UI on http://localhost:3005
#   - Python agents (FastAPI) on http://localhost:8000
#
# Both processes share this terminal via concurrently.
# Ctrl+C stops both.

Set-Location $PSScriptRoot
npm run dev
