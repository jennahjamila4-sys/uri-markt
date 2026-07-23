# =====================================================================
# Uri-Markt -- Vercel Env-Push (Block 13)
# Zweck: Nicht-Stripe-Umgebungsvariablen aus .env.local nach Vercel
#        pushen. STRIPE-Secrets gehen NUR nach Preview/Development (Test-
#        Keys), NIE nach Production -- die Live-Werte (rk_live_/whsec_)
#        traegt JJ dort manuell ein (Block-MD Schritt 5D/E).
# Regeln: Lektion 14 (Preflight), Lektion 15 (try/finally, Transcript,
#         Exit-Code-Checks, Non-Interactive-Flags), Lektion 16 (nur
#         BESTEHENDES Projekt verlinken, nie erstellen). Secrets maskiert.
# Datei bewusst rein ASCII (PS 5.1 liest ps1 ohne BOM als ANSI).
# Aufruf: powershell.exe -ExecutionPolicy Bypass -NoExit -File deploy\vercel-env-push.ps1
# =====================================================================

$ErrorActionPreference = 'Continue'   # native stderr darf nicht terminieren
Set-StrictMode -Version 2.0

$RepoRoot    = Split-Path -Parent $PSScriptRoot   # deploy\ -> Repo-Root
$EnvFile     = Join-Path $RepoRoot '.env.local'
$LogFile     = Join-Path $PSScriptRoot '_env-push.log'
$ProjectName = 'uri-markt'
$TeamScope   = 'jennahjamila4-7437s-projects'

# Ziel-Environments:
#   Standard-Variablen  -> production, preview, development
#   STRIPE_*  (Sonderregel) -> NUR preview, development  (Test-Keys, nie Prod)
$AllEnvs    = @('production','preview','development')
$NonProdEnvs= @('preview','development')

# Rein lokale Test-/Tooling-Variablen, die NIE nach Vercel gehoeren.
# E2E_* wird zusaetzlich per Praefix gefiltert (siehe unten).
$LocalOnly  = @('SUPABASE_ACCESS_TOKEN')

$script:Ok = $false

# ---------- Helfer -----------------------------------------------------

function Write-Rot([string]$msg)  { Write-Host $msg -ForegroundColor Red }
function Write-Gruen([string]$msg){ Write-Host $msg -ForegroundColor Green }
function Write-Info([string]$msg) { Write-Host $msg -ForegroundColor Cyan }

function Stop-Rot([string]$was, [string]$beheben) {
    Write-Rot ("FEHLT: {0} -- so beheben: {1}" -f $was, $beheben)
    throw ("ABBRUCH: {0}" -f $was)
}

# Maskiert einen Secret-Wert fuer jede Ausgabe (nie Klartext).
function Mask([string]$v) {
    if ([string]::IsNullOrEmpty($v)) { return '(leer)' }
    if ($v.Length -le 8) { return '****' }
    return $v.Substring(0, 4) + '****' + $v.Substring($v.Length - 2)
}

# Fuehrt ein natives Kommando aus, prueft Exit-Code, gibt stdout zurueck.
function Invoke-Cli {
    param(
        [string]$Label,
        [scriptblock]$Cmd,
        [switch]$TolerateFailure,
        [switch]$Quiet
    )
    Write-Info (">> " + $Label)
    $out = & $Cmd 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    if (-not $Quiet -and $out) { $out | ForEach-Object { Write-Host ("   " + $_) } }
    if ($code -ne 0) {
        if ($TolerateFailure) {
            Write-Host ("   (Exit-Code {0} -- toleriert: {1})" -f $code, $Label)
            return $null
        }
        Write-Rot ("FEHLER (Exit-Code {0}) bei: {1}" -f $code, $Label)
        throw ("ABBRUCH: {0} fehlgeschlagen" -f $Label)
    }
    return ($out -join "`n")
}

# Setzt eine Env-Var in EINEM Environment idempotent und NON-INTERAKTIV.
# '--force' ueberschreibt eine bestehende Variable ohne Rueckfrage; der Wert
# kommt per stdin (nie als Argument -> nicht in der Prozessliste sichtbar).
function Set-VercelEnv([string]$name, [string]$value, [string]$env) {
    if ([string]::IsNullOrEmpty($value)) { Stop-Rot "$name (Wert leer)" "Wert in .env.local eintragen" }
    Write-Info (">> vercel env add $name $env --force  (Wert: " + (Mask $value) + ")")
    $out = $value | vercel env add $name $env --force 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) {
        $safe = $out | Where-Object { $_ -notmatch [regex]::Escape($value.Substring(0, [Math]::Min(8, $value.Length))) }
        $safe | Select-Object -First 10 | ForEach-Object { Write-Rot ("   " + $_) }
        throw ("ABBRUCH: vercel env add {0} ({1}) fehlgeschlagen" -f $name, $env)
    }
    Write-Host ("   OK: {0} -> {1} gesetzt" -f $name, $env)
}

# Entscheidet die Ziel-Environments fuer eine Variable oder $null (= filtern).
function Get-Targets([string]$name) {
    if ($name -match '^E2E_')            { return $null }         # Test-Konten, nie zu Vercel
    if ($LocalOnly -contains $name)      { return $null }         # lokales Tooling
    if ($name -match '^STRIPE')          { return $NonProdEnvs }  # Sonderregel: nie Production
    return $AllEnvs
}

# ---------- Hauptablauf ------------------------------------------------

try {
    Start-Transcript -Path $LogFile -Append | Out-Null
    Set-Location $RepoRoot
    Write-Host ""
    Write-Info  "=== Uri-Markt Vercel Env-Push $(Get-Date -Format 'dd.MM.yyyy HH:mm') ==="
    Write-Host  ("Repo: " + $RepoRoot)

    # ----- PREFLIGHT (Lektion 14) --------------------------------------
    Write-Info "--- Preflight ---"

    # Hard-Guard: .env.local muss existieren
    if (-not (Test-Path $EnvFile)) {
        Stop-Rot ".env.local" "Datei .env.local im Projekt-Root anlegen (Vorlage: CLAUDE.md, Abschnitt Umgebungsvariablen)"
    }
    Write-Host "   OK: .env.local vorhanden"

    # Vercel-CLI vorhanden?
    if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
        Stop-Rot "Vercel-CLI" "In PowerShell 'npm i -g vercel' ausfuehren, danach neue Konsole oeffnen"
    }
    Write-Host "   OK: Vercel-CLI verfuegbar"

    # Login (vercel whoami)
    $who = Invoke-Cli -Label "vercel whoami" -TolerateFailure -Quiet -Cmd { vercel whoami }
    if ([string]::IsNullOrWhiteSpace("$who")) {
        Stop-Rot "Vercel-Login" "'vercel login' ausfuehren und im Browser bestaetigen, dann Script erneut starten"
    }
    Write-Host ("   OK: eingeloggt als " + "$who".Trim())

    # Projekt-Link (Lektion 16: NUR bestehendes Projekt, nie erstellen)
    if (-not (Test-Path (Join-Path $RepoRoot '.vercel\project.json'))) {
        Stop-Rot "Vercel-Projekt-Link" "Einmalig 'vercel link --yes --project $ProjectName --scope $TeamScope' ausfuehren (bestehendes Projekt), dann Script erneut starten. Es wird bewusst KEIN neues Projekt erstellt."
    }
    Write-Host "   OK: Projekt verlinkt (.vercel/project.json vorhanden)"

    # ----- .env.local parsen (Werte NIE ausgeben) ----------------------
    $EnvVars = [ordered]@{}
    Get-Content $EnvFile | ForEach-Object {
        $line = $_
        if ($line -match '^\s*#') { return }                     # Kommentarzeile
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $EnvVars[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    if ($EnvVars.Count -eq 0) {
        Stop-Rot "Keine Variablen in .env.local" "Mindestens die NEXT_PUBLIC_SUPABASE_*-Variablen eintragen"
    }

    # ----- Plan bauen (Namen + Ziele, KEINE Werte) ---------------------
    $Plan     = @()   # @{ Name; Targets }
    $Skipped  = @()   # nur Namen
    foreach ($name in $EnvVars.Keys) {
        $targets = Get-Targets $name
        if ($null -eq $targets) { $Skipped += $name; continue }
        if ([string]::IsNullOrEmpty($EnvVars[$name])) {
            # Leere Werte nicht pushen (kaputte Env verhindern), aber sichtbar machen.
            Write-Rot ("   WARNUNG: {0} ist leer -- wird NICHT gepusht" -f $name)
            $Skipped += "$name (leer)"
            continue
        }
        $Plan += [pscustomobject]@{ Name = $name; Targets = $targets }
    }

    if ($Plan.Count -eq 0) {
        Stop-Rot "Nichts zu pushen" "Alle Variablen wurden gefiltert -- .env.local pruefen"
    }

    # ----- Namen-Vorschau + Bestaetigung (KEINE Werte) -----------------
    Write-Host ""
    Write-Info "--- Vorschau: diese Variablen werden gepusht (NUR Namen + Ziel-Environments) ---"
    foreach ($p in $Plan) {
        $stripeHinweis = ''
        if ($p.Name -match '^STRIPE') { $stripeHinweis = '   [Sonderregel: NIE Production]' }
        Write-Host ("   {0,-32} -> {1}{2}" -f $p.Name, ($p.Targets -join ', '), $stripeHinweis)
    }
    if ($Skipped.Count -gt 0) {
        Write-Host ""
        Write-Host ("   Gefiltert (nicht gepusht): " + ($Skipped -join ', ')) -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Rot   "WICHTIG: STRIPE-Secrets gehen NIE nach Production. Die Live-Keys"
    Write-Rot   "         (rk_live_/whsec_) traegst du dort manuell im Dashboard ein."
    Write-Host ""
    $answer = Read-Host "Push jetzt ausfuehren? Tippe JA (alles andere bricht ab)"
    if ($answer -ne 'JA') {
        Write-Info "Abgebrochen auf Wunsch -- nichts wurde gepusht."
        $script:Ok = $true   # sauberer, gewollter Abbruch -> nicht ROT
        return
    }

    # ----- Push (einzeln, je Environment) ------------------------------
    Write-Info "--- Push nach Vercel ---"
    foreach ($p in $Plan) {
        foreach ($env in $p.Targets) {
            Set-VercelEnv $p.Name $EnvVars[$p.Name] $env
        }
    }

    $script:Ok = $true
    Write-Host ""
    Write-Gruen "====================================================="
    Write-Gruen "   ENV-PUSH GRUEN"
    Write-Gruen ("   {0} Variablen gesetzt (Stripe nur Preview/Development)" -f $Plan.Count)
    Write-Gruen "====================================================="
    Write-Host ""
    Write-Info "JJ-Restschritte:"
    Write-Host "  1. Stripe LIVE-Werte manuell in Vercel -> Production eintragen:"
    Write-Host "     STRIPE_SECRET_KEY = rk_live_...   STRIPE_WEBHOOK_SECRET = whsec_..."
    Write-Host "  2. Danach Redeploy (deploy\deploy-vercel.ps1), damit Env greift."
}
catch {
    Write-Host ""
    Write-Rot "====================================================="
    Write-Rot "   ENV-PUSH ROT -- abgebrochen"
    Write-Rot ("   Grund: " + $_.Exception.Message)
    Write-Rot ("   Log:   " + $LogFile)
    Write-Rot "====================================================="
}
finally {
    try { Stop-Transcript | Out-Null } catch { }
    Read-Host "Fertig -- Enter zum Beenden"
}
