# =====================================================================
# Uri-Markt -- Vercel Production Deploy (Block 8b)
# Zweck: Idempotentes One-Click-Deploy: Preflight -> Vercel-Link ->
#        Env-Vars -> Deploy -> Domain -> Stripe-Webhook -> Redeploy.
# Regeln: Lektion 14 (Preflight), Lektion 15 (try/finally, Transcript,
#         Exit-Code-Checks, kein stiller Weiterlauf), Secrets maskiert.
# Datei bewusst rein ASCII (PS 5.1 liest ps1 ohne BOM als ANSI).
# Aufruf: powershell.exe -ExecutionPolicy Bypass -NoExit -File deploy\deploy-vercel.ps1
# =====================================================================

$ErrorActionPreference = 'Continue'   # native stderr darf nicht terminieren
Set-StrictMode -Version 2.0

$RepoRoot    = Split-Path -Parent $PSScriptRoot   # deploy\ -> Repo-Root
$EnvFile     = Join-Path $RepoRoot '.env.local'
$LogFile     = Join-Path $PSScriptRoot '_deploy.log'
$ProjectName = 'uri-markt'
$TeamScope   = 'jennahjamila4-7437s-projects'
$WebhookPath = '/api/webhooks/stripe'

$script:Ok = $false

# ---------- Helfer -----------------------------------------------------

function Write-Rot([string]$msg)  { Write-Host $msg -ForegroundColor Red }
function Write-Gruen([string]$msg){ Write-Host $msg -ForegroundColor Green }
function Write-Info([string]$msg) { Write-Host $msg -ForegroundColor Cyan }

function Stop-Rot([string]$was, [string]$beheben) {
    Write-Rot ("FEHLT: {0} -- so beheben: {1}" -f $was, $beheben)
    throw ("ABBRUCH: {0}" -f $was)
}

# Maskiert einen Secret-Wert fuer jede Ausgabe (nie Klartext in Konsole/Transcript)
function Mask([string]$v) {
    if ([string]::IsNullOrEmpty($v)) { return '(leer)' }
    if ($v.Length -le 8) { return '****' }
    return $v.Substring(0, 4) + '****' + $v.Substring($v.Length - 2)
}

# Fuehrt ein natives Kommando aus, prueft Exit-Code, gibt stdout zurueck.
# -TolerateFailure: Exit-Code != 0 fuehrt NICHT zum Abbruch (Rueckgabe $null).
function Invoke-Cli {
    param(
        [string]$Label,
        [scriptblock]$Cmd,
        [switch]$TolerateFailure,
        [switch]$Quiet   # stdout nicht auf Konsole spiegeln (z.B. JSON)
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
        if ($Quiet -and $out) { $out | Select-Object -First 15 | ForEach-Object { Write-Rot ("   " + $_) } }
        throw ("ABBRUCH: {0} fehlgeschlagen" -f $Label)
    }
    return ($out -join "`n")
}

# Setzt eine Env-Var in Vercel (Production) idempotent und NON-INTERAKTIV.
# Doku-verifiziert (vercel.com/docs/cli/env): '--force' ueberschreibt eine
# bestehende Variable OHNE Rueckfrage; der Wert kommt per stdin (dokumentiertes
# Muster 'cat file | vercel env add NAME target'). Das fruehere rm+add ist
# damit ersatzlos gestrichen -- 'env rm' war der Haengepunkt (Zyklus 2) und
# wird nicht mehr gebraucht: --force ist in EINEM Aufruf idempotent, egal ob
# die Variable schon existiert oder nicht (Erstlauf-Problem 'not found' entfaellt).
function Set-VercelEnv([string]$name, [string]$value) {
    if ([string]::IsNullOrEmpty($value)) { Stop-Rot "$name (Wert leer)" "Wert in .env.local eintragen" }
    Write-Info (">> vercel env add $name production --force  (Wert: " + (Mask $value) + ")")
    $out = $value | vercel env add $name production --force 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) {
        # Ausgabe kann Secret-Echos enthalten -> nicht ungefiltert ausgeben
        $safe = $out | Where-Object { $_ -notmatch [regex]::Escape($value.Substring(0, [Math]::Min(8, $value.Length))) }
        $safe | Select-Object -First 10 | ForEach-Object { Write-Rot ("   " + $_) }
        throw ("ABBRUCH: vercel env add {0} fehlgeschlagen" -f $name)
    }
    Write-Host ("   OK: {0} gesetzt" -f $name)
}

# ---------- Hauptablauf ------------------------------------------------

try {
    Start-Transcript -Path $LogFile -Append | Out-Null
    Set-Location $RepoRoot
    Write-Host ""
    Write-Info  "=== Uri-Markt Deploy $(Get-Date -Format 'dd.MM.yyyy HH:mm') ==="
    Write-Host  ("Repo: " + $RepoRoot)

    # ----- PREFLIGHT (Lektion 14) --------------------------------------
    Write-Info "--- Preflight ---"

    if (-not (Test-Path $EnvFile)) {
        Stop-Rot ".env.local" "Datei .env.local im Projekt-Root anlegen (Vorlage: CLAUDE.md, Abschnitt Umgebungsvariablen)"
    }

    # .env.local parsen (Werte NIE ausgeben)
    $EnvVars = @{}
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $EnvVars[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }

    $Required = @('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY')
    foreach ($k in $Required) {
        if (-not $EnvVars.ContainsKey($k) -or [string]::IsNullOrEmpty($EnvVars[$k])) {
            Stop-Rot "$k in .env.local" "Wert in .env.local eintragen (Zeile: $k=...)"
        }
        Write-Host ("   OK: {0} = {1}" -f $k, (Mask $EnvVars[$k]))
    }

    foreach ($tool in @('node','npm')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            Stop-Rot $tool "Node.js von https://nodejs.org installieren (LTS), danach neue Konsole oeffnen"
        }
    }
    Write-Host "   OK: node/npm verfuegbar"

    if (-not (Get-Command stripe -ErrorAction SilentlyContinue)) {
        Stop-Rot "Stripe-CLI" "Installieren: https://docs.stripe.com/stripe-cli (Windows: scoop install stripe oder Installer), danach 'stripe login'"
    }
    $stripeCfg = Invoke-Cli -Label "stripe config --list (Login-Check)" -TolerateFailure -Quiet -Cmd { stripe config --list }
    if ([string]::IsNullOrWhiteSpace($stripeCfg)) {
        Stop-Rot "Stripe-CLI-Login" "In dieser Konsole 'stripe login' ausfuehren und im Browser bestaetigen, dann Script erneut starten"
    }
    Write-Host "   OK: Stripe-CLI installiert und eingeloggt"

    # Stripe-API-Calls laufen mit dem App-Key aus .env.local (gleicher Modus
    # test/live wie die App -- verhindert Webhook-Secret im falschen Modus).
    # Als Env-Var uebergeben, nie als Kommandozeilen-Argument (Prozessliste).
    $env:STRIPE_API_KEY = $EnvVars['STRIPE_SECRET_KEY']

    # ----- a) Vercel-CLI -----------------------------------------------
    if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
        Invoke-Cli -Label "npm i -g vercel (Vercel-CLI installieren)" -Cmd { npm i -g vercel } | Out-Null
        if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
            Stop-Rot "Vercel-CLI nach Installation nicht im PATH" "Neue Konsole oeffnen und Script erneut starten"
        }
    }
    Write-Host "   OK: Vercel-CLI verfuegbar"

    # ----- b) Login -----------------------------------------------------
    $who = Invoke-Cli -Label "vercel whoami" -TolerateFailure -Quiet -Cmd { vercel whoami }
    if ($null -eq $who) {
        Write-Info "Nicht eingeloggt -- Browser-Login startet (bitte bestaetigen)..."
        # Interaktiv: NICHT capturen, sonst sieht JJ den Login-Prompt nicht
        vercel login
        if ($LASTEXITCODE -ne 0) {
            Stop-Rot "Vercel-Login" "'vercel login' manuell ausfuehren und im Browser bestaetigen, dann Script erneut starten"
        }
        $who = Invoke-Cli -Label "vercel whoami (erneut)" -Quiet -Cmd { vercel whoami }
    }
    Write-Host ("   OK: eingeloggt als " + $who.Trim())

    # ----- c) Projekt verlinken (NUR bestehendes Projekt, NIE erstellen) -
    # Ist-Zustand (16.07.2026, Dashboard-verifiziert): Projekt 'uri-markt'
    # existiert bereits im Team $TeamScope, ist git-connected und deployt
    # automatisch bei jedem Push. 'vercel link --yes' ohne --project ging in
    # den Create-Pfad -> 409 "already exists". Deshalb explizit auf das
    # BESTEHENDE Projekt verlinken (Syntax laut vercel-Doku: link --yes
    # --project <name>; --scope ist globale Option).
    if (Test-Path (Join-Path $RepoRoot '.vercel\project.json')) {
        Write-Host "   OK: Projekt bereits verlinkt (.vercel/project.json vorhanden)"
    } else {
        Invoke-Cli -Label "vercel link (bestehendes Projekt $ProjectName, Team $TeamScope)" -Cmd {
            vercel link --yes --project $ProjectName --scope $TeamScope
        } | Out-Null
        if (-not (Test-Path (Join-Path $RepoRoot '.vercel\project.json'))) {
            Stop-Rot "Vercel-Link" "Bestehendes Projekt '$ProjectName' im Team '$TeamScope' konnte nicht verlinkt werden -- im Vercel-Dashboard pruefen und JJ melden. Es wird bewusst KEIN neues Projekt erstellt."
        }
    }

    # ----- d) Env-Vars nach Vercel (Production) -------------------------
    Write-Info "--- Env-Vars nach Vercel (Production) ---"
    foreach ($k in $Required) { Set-VercelEnv $k $EnvVars[$k] }
    if ($EnvVars.ContainsKey('NEXT_PUBLIC_APP_URL') -and $EnvVars['NEXT_PUBLIC_APP_URL']) {
        Set-VercelEnv 'NEXT_PUBLIC_APP_URL' $EnvVars['NEXT_PUBLIC_APP_URL']
    }

    # ----- e) Produktions-Deploy ----------------------------------------
    # --yes: beantwortet alle Setup-Fragen mit Defaults (Doku: cli/deploy),
    # damit der Deploy nie auf eine unsichtbare Eingabe warten kann.
    Write-Info "--- Deploy (vercel --prod --yes) -- Build-Log folgt ---"
    # stdout (= Deployment-URL) einfangen, stderr (= Build-Log) bleibt sichtbar
    $deployUrl = (vercel --prod --yes)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace("$deployUrl")) {
        Stop-Rot "Produktions-Deploy" "Build-Log oben pruefen (haeufig: ESLint/tsc-Fehler -- lokal 'npm run build' ausfuehren)"
    }
    $deployUrl = ("$deployUrl".Trim() -split "`n" | Select-Object -Last 1).Trim()
    Write-Host ("   Deployment: " + $deployUrl)

    # Produktions-Domain ermitteln (Alias des Deployments, kuerzester *.vercel.app)
    $insp = Invoke-Cli -Label "vercel inspect (Domain ermitteln)" -Quiet -Cmd { vercel inspect $deployUrl }
    $deployHost = ([uri]$deployUrl).Host
    $aliases = [regex]::Matches($insp, '[a-z0-9][a-z0-9.-]*\.vercel\.app') |
        ForEach-Object { $_.Value } | Where-Object { $_ -ne $deployHost } |
        Sort-Object Length, { $_ } -Unique
    if (-not $aliases) {
        Stop-Rot "Produktions-Domain nicht ermittelbar" "Im Vercel-Dashboard unter Projekt '$ProjectName' -> Domains nachsehen und JJ melden"
    }
    $Domain = $aliases | Select-Object -First 1
    $AppUrl = "https://$Domain"   # ohne Slash am Ende
    Write-Gruen ("   Produktions-Domain: " + $AppUrl)

    # ----- f) NEXT_PUBLIC_APP_URL auf Produktions-Domain ----------------
    Set-VercelEnv 'NEXT_PUBLIC_APP_URL' $AppUrl

    # ----- g) Stripe-Webhook (idempotent) --------------------------------
    Write-Info "--- Stripe-Webhook ---"
    $whUrl = "$AppUrl$WebhookPath"
    $listJson = Invoke-Cli -Label "Webhook-Endpoints listen" -Quiet -Cmd {
        stripe get /v1/webhook_endpoints -d limit=100
    }
    $existing = $null
    try {
        $parsed = $listJson | ConvertFrom-Json
        $existing = @($parsed.data) | Where-Object { $_.url -eq $whUrl } | Select-Object -First 1
    } catch {
        Stop-Rot "Webhook-Liste nicht parsbar (JSON)" "Stripe-CLI-Ausgabe in deploy\_deploy.log pruefen, JJ melden"
    }

    if ($existing) {
        Write-Host ("   OK: Webhook-Endpoint existiert bereits (" + $existing.id + ") -- wird NICHT neu angelegt.")
        Write-Host  "   Hinweis: STRIPE_WEBHOOK_SECRET in Vercel bleibt unveraendert."
    } else {
        $createJson = Invoke-Cli -Label "Webhook-Endpoint anlegen ($whUrl)" -Quiet -Cmd {
            stripe post /v1/webhook_endpoints -d "url=$whUrl" -d "enabled_events[]=checkout.session.completed"
        }
        $created = $createJson | ConvertFrom-Json
        $whSecret = $created.secret
        if ([string]::IsNullOrEmpty($whSecret) -or -not $whSecret.StartsWith('whsec_')) {
            Stop-Rot "Webhook-Secret nicht in Stripe-Antwort" "deploy\_deploy.log pruefen, JJ melden"
        }
        Write-Host ("   OK: Webhook angelegt (" + $created.id + "), Secret: " + (Mask $whSecret))
        # ACHTUNG: das lokale whsec_ aus .env.local ist NUR lokal (stripe listen)
        # gueltig und wird NIE nach Vercel uebertragen -- nur das neue Endpoint-Secret.
        Set-VercelEnv 'STRIPE_WEBHOOK_SECRET' $whSecret
    }

    # ----- h) Redeploy (Env-Werte wirken erst mit neuem Deploy) ----------
    Write-Info "--- Redeploy (vercel --prod --yes) ---"
    $redeploy = (vercel --prod --yes)
    if ($LASTEXITCODE -ne 0) {
        Stop-Rot "Redeploy" "Build-Log oben pruefen; Env-Vars sind gesetzt, 'vercel --prod' manuell wiederholen"
    }
    Write-Host ("   Redeploy OK: " + ("$redeploy".Trim() -split "`n" | Select-Object -Last 1).Trim())

    # (ehem. Schritt i "vercel git connect" ersatzlos gestrichen:
    #  Repo ist laut Dashboard bereits git-connected, Auto-Deploy aktiv.)

    $script:Ok = $true

    # ----- i) Endausgabe --------------------------------------------------
    Write-Host ""
    Write-Gruen "====================================================="
    Write-Gruen "   DEPLOY GRUEN"
    Write-Gruen ("   >>>  " + $AppUrl + "  <<<")
    Write-Gruen "====================================================="
    Write-Host ""
    Write-Info "JJ-Restschritte:"
    Write-Host ("  1. Supabase Auth URL Configuration:")
    Write-Host ("     Site URL      = " + $AppUrl)
    Write-Host ("     Redirect URLs = " + $AppUrl + "/auth/callback")
    Write-Host ("                     http://localhost:3000/auth/callback")
    Write-Host ("  2. Smoke-Test laut docs/deploy-vercel.md Abschnitt 5")
}
catch {
    Write-Host ""
    Write-Rot "====================================================="
    Write-Rot "   DEPLOY ROT -- abgebrochen"
    Write-Rot ("   Grund: " + $_.Exception.Message)
    Write-Rot ("   Log:   " + $LogFile)
    Write-Rot "====================================================="
}
finally {
    $env:STRIPE_API_KEY = $null
    try { Stop-Transcript | Out-Null } catch { }
    Read-Host "Fertig -- Enter zum Beenden"
}
