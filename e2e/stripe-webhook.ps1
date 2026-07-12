# e2e/stripe-webhook.ps1 - startet den lokalen Stripe-Webhook-Listener und zeigt das
# Webhook-Signing-Secret (whsec_...) gross an. Fenster bleibt offen (Listener laeuft).
# Aufruf per Desktop-Verknuepfung "Uri-Markt Stripe Webhook" oder:
#   powershell -ExecutionPolicy Bypass -NoExit -File e2e\stripe-webhook.ps1
#
# Wichtig: --forward-to braucht eine VOLLSTAENDIGE URL inkl. http:// (Stripe-Doku),
# sonst startet der Listener nicht.
param(
  [int]$Port = 3000,
  [string]$Path = "/api/webhooks/stripe"
)

$ErrorActionPreference = "Continue"
$target = "http://localhost:$Port$Path"

$stripeCmd = Get-Command stripe -ErrorAction SilentlyContinue
if (-not $stripeCmd) {
  Write-Host "Stripe CLI nicht gefunden. Zuerst 'Uri-Markt Stripe Setup' ausfuehren." -ForegroundColor Red
  Read-Host "Enter zum Schliessen druecken"
  exit 1
}

# Secret abfragen: '--print-secret' druckt nur das Secret und beendet sich (Stripe-Doku).
# Beide Streams einsammeln und das whsec_-Token per Regex herausziehen (robust).
Write-Host "Frage Webhook-Signing-Secret ab..." -ForegroundColor Cyan
$raw = (& stripe listen --print-secret 2>&1 | Out-String)
$m = [regex]::Match($raw, 'whsec_[A-Za-z0-9]+')

if ($m.Success) {
  $secret = $m.Value
  Write-Host ""
  Write-Host "##################################################" -ForegroundColor Green
  Write-Host "#   WEBHOOK SIGNING SECRET fuer .env.local:       #" -ForegroundColor Green
  Write-Host "##################################################" -ForegroundColor Green
  Write-Host ""
  Write-Host "   STRIPE_WEBHOOK_SECRET=$secret" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Diesen Wert in .env.local eintragen (Notepad): die Zeile" -ForegroundColor Cyan
  Write-Host "STRIPE_WEBHOOK_SECRET=  ersetzen, speichern. Dann Dev-Server (Port 3000) neu starten." -ForegroundColor Cyan
  Write-Host ""
} else {
  Write-Host "Konnte das Secret nicht lesen. Rohausgabe zur Diagnose:" -ForegroundColor Red
  Write-Host $raw -ForegroundColor DarkGray
  Write-Host "Bist du eingeloggt? Zuerst 'Uri-Markt Stripe Setup' ausfuehren." -ForegroundColor Red
  Write-Host ""
}

Write-Host "Starte Listener - Forward an $target" -ForegroundColor Cyan
Write-Host "Fenster offen lassen, solange du testest. Beenden: Fenster schliessen oder Strg+C." -ForegroundColor DarkGray
Write-Host ""
stripe listen --forward-to $target
