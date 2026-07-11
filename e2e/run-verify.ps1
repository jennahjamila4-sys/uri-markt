# e2e/run-verify.ps1 — Build + E2E mit grossem, farbigem Endergebnis.
# Wird von der Desktop-Verknuepfung "Uri-Markt Verify" aufgerufen.
# Optionaler Spec-Parameter, z.B.:  run-verify.ps1 block2-reviews.spec.ts
param([string]$Spec = "")

$ErrorActionPreference = "Continue"
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host ""
Write-Host "=== BUILD (npm run build) ===" -ForegroundColor Cyan
npm run build 2>&1 | Tee-Object -FilePath "e2e\_build.log"
$build = $LASTEXITCODE
$pw = -1

if ($build -eq 0) {
    Write-Host ""
    Write-Host "=== PLAYWRIGHT (npx playwright test $Spec) ===" -ForegroundColor Cyan
    if ($Spec -ne "") {
        npx playwright test $Spec 2>&1 | Tee-Object -FilePath "e2e\_pw.log"
    } else {
        npx playwright test 2>&1 | Tee-Object -FilePath "e2e\_pw.log"
    }
    $pw = $LASTEXITCODE
}

$ok = ($build -eq 0 -and $pw -eq 0)
if ($ok) { $label = "G R U E N"; $color = "Green" } else { $label = "R O T"; $color = "Red" }

Write-Host ""
Write-Host "##################################################" -ForegroundColor $color
Write-Host "#                                                #" -ForegroundColor $color
Write-Host ("#     ERGEBNIS:  {0,-32}#" -f $label) -ForegroundColor $color
Write-Host "#                                                #" -ForegroundColor $color
Write-Host ("#     BUILD_EXIT={0,-4}  PW_EXIT={1,-15}#" -f $build, $pw) -ForegroundColor $color
Write-Host "#                                                #" -ForegroundColor $color
Write-Host "##################################################" -ForegroundColor $color
Write-Host ""

if (-not $ok) {
    $log = if ($build -ne 0) { "e2e\_build.log" } else { "e2e\_pw.log" }
    Write-Host "--- letzte 30 Zeilen ($log) ---" -ForegroundColor Yellow
    Get-Content $log -Tail 30
    Write-Host ""
}

Read-Host "Fertig. Enter zum Schliessen druecken"
