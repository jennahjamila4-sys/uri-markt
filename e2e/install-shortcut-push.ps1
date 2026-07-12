# e2e/install-shortcut-push.ps1 — legt EINMALIG die Desktop-Verknuepfung
# "Uri-Markt Push" an, die e2e/push.ps1 startet.
# Aufruf (aus Projekt-Root):
#   powershell -ExecutionPolicy Bypass -File e2e\install-shortcut-push.ps1

$repo = Split-Path -Parent $PSScriptRoot          # Projekt-Root (Elternordner von e2e)
$target = Join-Path $repo "e2e\push.ps1"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "Uri-Markt Push.lnk"

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = "powershell.exe"
$lnk.Arguments = "-ExecutionPolicy Bypass -NoExit -File `"$target`""
$lnk.WorkingDirectory = $repo
$lnk.IconLocation = "powershell.exe,0"
$lnk.Description = "Uri-Markt: git push origin main (Fenster bleibt offen)"
$lnk.Save()

Write-Host "OK: Verknuepfung 'Uri-Markt Push' liegt jetzt auf dem Desktop." -ForegroundColor Green
Write-Host "Ziel: $target" -ForegroundColor Green
