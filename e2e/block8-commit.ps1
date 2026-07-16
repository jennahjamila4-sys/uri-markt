# e2e/block8-commit.ps1 — Block 7 + Block 8 lokal committen (KEIN Push!)
# Aufruf: Rechtsklick -> "Mit PowerShell ausfuehren"
# oder:   powershell -ExecutionPolicy Bypass -File e2e\block8-commit.ps1

$ErrorActionPreference = "Continue"
Set-Location -Path (Join-Path $PSScriptRoot "..")

# Stale Lock aus der Sandbox-Session entfernen (dort nicht loeschbar)
if (Test-Path ".git\index.lock") {
    Remove-Item ".git\index.lock" -Force
    Write-Host "Stale .git\index.lock entfernt." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Commit 1: Block 7 (bereits gestagte Dateien) ===" -ForegroundColor Cyan
git commit -m "feat(block7): 5-Taler-Texte, Rechtsseiten (Impressum/Datenschutz/AGB), Footer + Signup-Zustimmung"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Hinweis: Block 7 war evtl. schon committet - weiter mit Block 8." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Commit 2: Block 8 (Deploy-Vorbereitung) ===" -ForegroundColor Cyan
git add `
  src/components/auth/AuthModal.tsx `
  vercel.json `
  docs/deploy-vercel.md `
  uebergabe-2026-07-16.md `
  e2e/block8-commit.ps1

git commit -m "feat(block8): Vercel-Deploy-Vorbereitung (deploy-vercel.md, vercel.json cdg1, emailRedirectTo-Fallback)"
$commit = $LASTEXITCODE

Write-Host ""
git status --short
git log --oneline -3

if ($commit -eq 0) { $label = "G R U E N"; $color = "Green" } else { $label = "R O T"; $color = "Red" }
Write-Host ""
Write-Host ("COMMIT-ERGEBNIS: {0}  (KEIN Push ausgefuehrt)" -f $label) -ForegroundColor $color
Write-Host ""
Read-Host "Fertig. Enter zum Schliessen druecken"
