# install-shortcut-stripe.ps1 - legt EINMALIG zwei Desktop-Verknuepfungen an:
#   "Uri-Markt Stripe Setup"    -> e2e\stripe-setup.ps1   (installieren + login)
#   "Uri-Markt Stripe Webhook"  -> e2e\stripe-webhook.ps1 (Listener + Secret, Fenster offen)
# Aufruf (aus Projekt-Root):
#   powershell -ExecutionPolicy Bypass -File install-shortcut-stripe.ps1

$repo = $PSScriptRoot                       # Projekt-Root (diese Datei liegt im Root)
$desktop = [Environment]::GetFolderPath("Desktop")
$ws = New-Object -ComObject WScript.Shell

function New-StripeShortcut($name, $scriptRel, $desc, $noExit) {
  $target = Join-Path $repo $scriptRel
  $lnkPath = Join-Path $desktop "$name.lnk"
  $lnk = $ws.CreateShortcut($lnkPath)
  $lnk.TargetPath = "powershell.exe"
  if ($noExit) {
    $lnk.Arguments = "-ExecutionPolicy Bypass -NoExit -File `"$target`""
  } else {
    $lnk.Arguments = "-ExecutionPolicy Bypass -File `"$target`""
  }
  $lnk.WorkingDirectory = $repo
  $lnk.IconLocation = "powershell.exe,0"
  $lnk.Description = $desc
  $lnk.Save()
  Write-Host "OK: '$name' -> $target" -ForegroundColor Green
}

New-StripeShortcut "Uri-Markt Stripe Setup"   "e2e\stripe-setup.ps1"   "Stripe CLI installieren + einloggen" $false
New-StripeShortcut "Uri-Markt Stripe Webhook" "e2e\stripe-webhook.ps1" "Stripe Webhook-Listener + Secret anzeigen" $true

Write-Host ""
Write-Host "Fertig. Zwei Verknuepfungen liegen jetzt auf dem Desktop." -ForegroundColor Green
Read-Host "Enter zum Schliessen druecken"
