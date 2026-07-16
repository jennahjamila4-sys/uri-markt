# e2e/block8-commit.ps1 — Block 7 + Block 8 lokal committen (KEIN Push!)
# Aufruf: Rechtsklick -> "Mit PowerShell ausfuehren"
# oder:   powershell -ExecutionPolicy Bypass -File e2e\block8-commit.ps1
# Ausgabe landet IMMER auch in e2e\_commit.log (Transcript).

$ErrorActionPreference = "Continue"
$exitCode = 0

try {
    Start-Transcript -Path (Join-Path $PSScriptRoot "_commit.log") -Force | Out-Null

    Set-Location -Path (Join-Path $PSScriptRoot "..")
    Write-Host "Arbeitsverzeichnis: $(Get-Location)"

    # --- Vorbedingung 1: Laeuft noch ein git-Prozess? Dann NICHTS loeschen (Lektion 15) ---
    $gitProc = @(Get-Process -Name git -ErrorAction SilentlyContinue)
    if ($gitProc.Count -gt 0) {
        Write-Host ""
        Write-Host "R O T - Git-Prozess laeuft noch (PID: $(($gitProc | ForEach-Object { $_.Id }) -join ', '))." -ForegroundColor Red
        Write-Host "Ursache: Ein anderes Programm (Editor, anderes Terminal) haelt git offen." -ForegroundColor Yellow
        Write-Host "Behebung: Das Fenster/Programm schliessen, dann dieses Skript erneut starten." -ForegroundColor Yellow
        $exitCode = 1
        return
    }

    # --- Vorbedingung 2: ALLE stale Git-Locks entfernen (ganze Fehlerklasse, Lektion 15) ---
    $locks = @()
    foreach ($fixed in @(".git\index.lock", ".git\HEAD.lock")) {
        if (Test-Path $fixed) { $locks += $fixed }
    }
    if (Test-Path ".git\refs") {
        $refLocks = @(Get-ChildItem ".git\refs" -Recurse -Filter "*.lock" -File -ErrorAction SilentlyContinue)
        foreach ($rl in $refLocks) { $locks += $rl.FullName }
    }
    if ($locks.Count -eq 0) {
        Write-Host "Keine stale Locks gefunden."
    }
    foreach ($lock in $locks) {
        Remove-Item $lock -Force -ErrorAction Continue
        if (Test-Path $lock) {
            Write-Host "R O T - Lock konnte nicht entfernt werden: $lock" -ForegroundColor Red
            Write-Host "Behebung: Datei-Explorer/Antivirus pruefen, Datei manuell loeschen, erneut starten." -ForegroundColor Yellow
            $exitCode = 1
            return
        }
        Write-Host "Stale Lock entfernt: $lock" -ForegroundColor Yellow
    }

    # --- Commit 1: Block 7 (nur falls noch nicht committet - idempotent) ---
    Write-Host ""
    Write-Host "=== Commit 1: Block 7 (bereits gestagte Dateien) ===" -ForegroundColor Cyan
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit -m "feat(block7): 5-Taler-Texte, Rechtsseiten (Impressum/Datenschutz/AGB), Footer + Signup-Zustimmung"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "R O T - Block-7-Commit fehlgeschlagen. Ausgabe oben / e2e\_commit.log pruefen." -ForegroundColor Red
            $exitCode = 1
            return
        }
    } else {
        Write-Host "Block 7 bereits committet (nichts gestaged) - uebersprungen." -ForegroundColor Yellow
    }

    # --- Commit 2: Block 8 (Deploy-Vorbereitung + Lektion 15) ---
    Write-Host ""
    Write-Host "=== Commit 2: Block 8 (Deploy-Vorbereitung) ===" -ForegroundColor Cyan
    git add `
      CLAUDE.md `
      src/components/auth/AuthModal.tsx `
      vercel.json `
      docs/deploy-vercel.md `
      uebergabe-2026-07-16.md `
      e2e/block8-commit.ps1

    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit -m "feat(block8): Vercel-Deploy-Vorbereitung (deploy-vercel.md, vercel.json cdg1, emailRedirectTo-Fallback) + Lektion 15"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "R O T - Block-8-Commit fehlgeschlagen. Ausgabe oben / e2e\_commit.log pruefen." -ForegroundColor Red
            $exitCode = 1
            return
        }
    } else {
        Write-Host "Block 8 bereits committet (nichts zu tun)." -ForegroundColor Yellow
    }

    Write-Host ""
    git status --short
    git log --oneline -3

    Write-Host ""
    Write-Host "COMMIT-ERGEBNIS: G R U E N  (KEIN Push ausgefuehrt)" -ForegroundColor Green
    Write-Host ""
}
catch {
    # Terminating Errors sichtbar machen statt Fenster-Sofortschluss
    Write-Host ""
    Write-Host "R O T - Unerwarteter Fehler:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Yellow
    $exitCode = 1
}
finally {
    try { Stop-Transcript | Out-Null } catch { }
    Write-Host "Log: e2e\_commit.log"
    Read-Host "Fertig. Enter zum Schliessen druecken"
}

exit $exitCode
