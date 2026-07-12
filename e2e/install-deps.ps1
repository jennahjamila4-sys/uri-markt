# e2e/install-deps.ps1 - installiert die Node-Abhaengigkeit 'stripe' (einmalig).
# Die Sandbox des Planungs-Chats kann die npm-Registry nicht erreichen (Proxy 403),
# deshalb muss die Installation hier auf deinem Rechner laufen.
# Aufruf: Rechtsklick auf diese Datei -> "Mit PowerShell ausfuehren"
#   oder: powershell -ExecutionPolicy Bypass -File e2e\install-deps.ps1

$ErrorActionPreference = "Continue"
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host "=== Installiere 'stripe' (npm) ===" -ForegroundColor Cyan
npm install stripe --no-audit --no-fund

# Erfolg an der realen Datei pruefen, NICHT am Exit-Code (npm ist da unzuverlaessig).
$ok = Test-Path "node_modules\stripe\package.json"

if ($ok) { $label = "G R U E N"; $color = "Green" } else { $label = "R O T"; $color = "Red" }
Write-Host ""
Write-Host "##################################################" -ForegroundColor $color
Write-Host ("#   {0,-44}#" -f $label) -ForegroundColor $color
if ($ok) {
  $ver = (Get-Content "node_modules\stripe\package.json" | ConvertFrom-Json).version
  Write-Host ("#   stripe {0,-37}#" -f $ver) -ForegroundColor $color
} else {
  Write-Host ("#   {0,-44}#" -f "stripe NICHT installiert") -ForegroundColor $color
}
Write-Host "##################################################" -ForegroundColor $color
Write-Host ""
Read-Host "Enter zum Schliessen druecken"
