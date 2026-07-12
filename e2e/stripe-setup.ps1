# e2e/stripe-setup.ps1 - EINMALIG: Stripe CLI installieren (falls noetig) + einloggen.
# Aufruf per Desktop-Verknuepfung "Uri-Markt Stripe Setup" oder:
#   powershell -ExecutionPolicy Bypass -File e2e\stripe-setup.ps1
#
# WICHTIG: winget/stripe setzen $LASTEXITCODE NICHT zuverlaessig. Erfolg wird deshalb
# an der realen Ausgabe geprueft (Get-Command bzw. 'stripe config --list'), nie am Exit-Code.

$ErrorActionPreference = "Continue"

function Show-Result($ok, $msg) {
  if ($ok) { $label = "G R U E N"; $color = "Green" } else { $label = "R O T"; $color = "Red" }
  Write-Host ""
  Write-Host "##################################################" -ForegroundColor $color
  Write-Host ("#   {0,-44}#" -f $label) -ForegroundColor $color
  Write-Host ("#   {0,-44}#" -f $msg)   -ForegroundColor $color
  Write-Host "##################################################" -ForegroundColor $color
  Write-Host ""
}

Write-Host "=== Uri-Markt: Stripe CLI Setup ===" -ForegroundColor Cyan

# 1) Ist die Stripe CLI installiert?  (Erfolg = Get-Command findet sie, NICHT der Exit-Code)
$stripeCmd = Get-Command stripe -ErrorAction SilentlyContinue
if ($stripeCmd) {
  Write-Host "Stripe CLI gefunden:" -ForegroundColor Green
  stripe --version
} else {
  Write-Host "Stripe CLI nicht gefunden. Installiere per winget..." -ForegroundColor Yellow
  winget install --id Stripe.StripeCli -e --source winget --accept-source-agreements --accept-package-agreements
  # PATH im laufenden Fenster nachladen (winget aendert nur den kuenftigen PATH)
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  $stripeCmd = Get-Command stripe -ErrorAction SilentlyContinue
  if (-not $stripeCmd) {
    Show-Result $false "Installiert, aber noch nicht im PATH."
    Write-Host "Bitte dieses Fenster schliessen, neu oeffnen und 'Uri-Markt Stripe Setup' nochmal starten." -ForegroundColor Yellow
    Read-Host "Enter zum Schliessen druecken"
    exit 1
  }
  Write-Host "Stripe CLI installiert:" -ForegroundColor Green
  stripe --version
}

# 2) Login - voll interaktiv lassen (Browser-Flow), Ausgabe NICHT abfangen.
Write-Host ""
Write-Host "Jetzt Login. Es oeffnet sich der Browser - dort mit deinem Stripe-Konto bestaetigen." -ForegroundColor Cyan
stripe login

# 3) Erfolg an der realen Config pruefen (nach erfolgreichem Login steht ein API-Key drin).
Write-Host ""
Write-Host "Pruefe Anmeldung..." -ForegroundColor Cyan
$cfg = (& stripe config --list 2>&1 | Out-String)
$ok = ($cfg -match 'mode_api_key')

if ($ok) {
  Show-Result $true "Stripe CLI installiert und eingeloggt."
  Write-Host "Naechster Schritt: Verknuepfung 'Uri-Markt Stripe Webhook' starten." -ForegroundColor Cyan
} else {
  Show-Result $false "Anmeldung nicht bestaetigt - bitte nochmal starten."
  Write-Host "Config-Ausgabe zur Diagnose:" -ForegroundColor DarkGray
  Write-Host $cfg -ForegroundColor DarkGray
}

Read-Host "Enter zum Schliessen druecken"
