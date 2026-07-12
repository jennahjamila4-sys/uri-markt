# e2e/push.ps1 — git push fuer Uri-Markt (Windows PowerShell)
# Push geht nur von JJs Maschine (die Sandbox-Umgebung sperrt GitHub per Proxy).
# Wird von der Desktop-Verknuepfung "Uri-Markt Push" aufgerufen.
# Aufruf (aus Projekt-Root):
#   powershell -ExecutionPolicy Bypass -File e2e\push.ps1

$ErrorActionPreference = "Continue"
# In den Projekt-Root wechseln (ein Ordner ueber diesem Script)
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host ""
Write-Host "=== git status (kurz) ===" -ForegroundColor Cyan
git status --short

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
