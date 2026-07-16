# e2e/block7-commit-push.ps1 — Block 7 committen + pushen (Windows PowerShell)
# Push/Commit laufen nur auf JJs Maschine. Von JJ freigegeben (GRUEN + Push-OK).
# Aufruf: Rechtsklick auf die Datei -> "Mit PowerShell ausfuehren"
# oder:   powershell -ExecutionPolicy Bypass -File e2e\block7-commit-push.ps1

$ErrorActionPreference = "Continue"
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host ""
Write-Host "=== git add (nur Block-7-Dateien) ===" -ForegroundColor Cyan
git add `
  src `
  docs/database-schema.md `
  mvp-masterplan.md `
  uebergabe-2026-07-12-block7.md `
  e2e/block7-legal.spec.ts `
  e2e/lock-commit.ps1 `
  e2e/block7-commit-push.ps1

Write-Host ""
Write-Host "=== git status (kurz) ===" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "=== git commit ===" -ForegroundColor Cyan
git commit -m "feat(block7): 5-Taler-Texte, Rechtsseiten (Impressum/Datenschutz/AGB), Footer + Signup-Zustimmung"
$commit = $LASTEXITCODE
if ($commit -ne 0) {
    Write-Host "Hinweis: Kein neuer Commit noetig (nichts zu committen?)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== git push origin main ===" -ForegroundColor Cyan
git push origin main
$push = $LASTEXITCODE
Write-Output "PUSH_EXIT: $push"

$ok = ($push -eq 0)
if ($ok) { $label = "G R U E N"; $color = "Green" } else { $label = "R O T"; $color = "Red" }

Write-Host ""
Write-Host "##################################################" -ForegroundColor $color
Write-Host "#                                                #" -ForegroundColor $color
Write-Host ("#     PUSH-ERGEBNIS:  {0,-27}#" -f $label) -ForegroundColor $color
Write-Host "#                                                #" -ForegroundColor $color
Write-Host ("#     PUSH_EXIT={0,-33}#" -f $push) -ForegroundColor $color
Write-Host "#                                                #" -ForegroundColor $color
Write-Host "##################################################" -ForegroundColor $color
Write-Host ""

if (-not $ok) {
    Write-Host "Push fehlgeschlagen. Haeufige Ursachen:" -ForegroundColor Yellow
    Write-Host " - GitHub-Login/Token abgelaufen (Windows-Anmeldeinformationen pruefen)" -ForegroundColor Yellow
    Write-Host " - origin/main hat neue Commits -> zuerst 'git pull --rebase origin main'" -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Fertig. Enter zum Schliessen druecken"
