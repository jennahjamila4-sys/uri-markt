# e2e/lock-commit.ps1 — package-lock.json sauber committen + pushen (Windows PowerShell)
# Hintergrund: nach "npm install stripe" liegt package-lock.json nur bei JJ nativ korrekt
# vor; der Sandbox-Mount liest sie abgeschnitten. Dieser eine Commit ist von JJ vorab
# freigegeben. Vercel (npm ci, Block 8) braucht package-lock.json in sync.
#
# Aufruf: Rechtsklick auf die Datei -> "Mit PowerShell ausfuehren"
# oder:   powershell -ExecutionPolicy Bypass -File e2e\lock-commit.ps1

$ErrorActionPreference = "Continue"
# In den Projekt-Root wechseln (ein Ordner ueber diesem Script)
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host ""
Write-Host "=== npm install (schreibt package-lock.json nativ) ===" -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "=== git add package-lock.json ===" -ForegroundColor Cyan
git add package-lock.json

Write-Host ""
Write-Host "=== git commit ===" -ForegroundColor Cyan
git commit -m "chore: package-lock nach stripe-Install"
$commit = $LASTEXITCODE
if ($commit -ne 0) {
    Write-Host "Hinweis: Kein neuer Commit noetig (package-lock war bereits committet)." -ForegroundColor Yellow
    Write-Host "Es wird trotzdem gepusht, falls der Commit nur noch nicht auf GitHub ist." -ForegroundColor Yellow
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
