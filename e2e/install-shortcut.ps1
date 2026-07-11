# e2e/install-shortcut.ps1 — legt EINMALIG die Desktop-Verknuepfung
# "Uri-Markt Verify" an, die e2e/run-verify.ps1 startet.
# Aufruf (aus Projekt-Root):
#   powershell -ExecutionPolicy Bypass -File e2e\install-shortcut.ps1

$repo = Split-Path -Parent $PSScriptRoot          # Projekt-Root (Elternordner von e2e)
$target = Join-Path $repo "e2e\run-verify.ps1"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "Uri-Markt Verify.lnk"

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = "powershell.exe"
$lnk.Arguments = "-ExecutionPolicy Bypass -NoExit -File `"$target`""
$lnk.WorkingDirectory = $repo
$lnk.IconLocation = "powershell.exe,0"
$lnk.Description = "Uri-Markt: build + E2E verifizieren (Fenster bleibt offen)"
$lnk.Save()

Write-Host "OK: Verknuepfung 'Uri-Markt Verify' liegt jetzt auf dem Desktop." -ForegroundColor Green
Write-Host "Ziel: $target" -ForegroundColor Green
