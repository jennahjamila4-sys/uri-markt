# e2e/verify.ps1 — Verifikation fuer Uri-Markt (Windows PowerShell)
# Nutzung (aus Projekt-Root):
#   powershell -ExecutionPolicy Bypass -File e2e\verify.ps1                       # build + ALLE E2E
#   powershell -ExecutionPolicy Bypass -File e2e\verify.ps1 block2-reviews.spec.ts # build + nur dieser Spec
#
# Gibt am Ende genau eine Zeile aus:  BUILD_EXIT=<n> PW_EXIT=<n>
# Bei Rot zusaetzlich die letzten 30 Zeilen des betroffenen Logs.
param([string]$Spec = "")

$ErrorActionPreference = "Continue"
# In den Projekt-Root wechseln (ein Ordner ueber diesem Script)
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Output "=== BUILD (npm run build) ==="
npm run build 2>&1 | Tee-Object -FilePath "e2e\_build.log"
$build = $LASTEXITCODE

if ($build -ne 0) {
    Write-Output ""
    Write-Output "BUILD_EXIT=$build PW_EXIT=SKIPPED"
    Write-Output "--- letzte 30 Zeilen BUILD ---"
    Get-Content "e2e\_build.log" -Tail 30
    exit $build
}

Write-Output "=== PLAYWRIGHT (npx playwright test $Spec) ==="
if ($Spec -ne "") {
    npx playwright test $Spec 2>&1 | Tee-Object -FilePath "e2e\_pw.log"
} else {
    npx playwright test 2>&1 | Tee-Object -FilePath "e2e\_pw.log"
}
$pw = $LASTEXITCODE

Write-Output ""
Write-Output "BUILD_EXIT=$build PW_EXIT=$pw"
if ($pw -ne 0) {
    Write-Output "--- letzte 30 Zeilen PLAYWRIGHT ---"
    Get-Content "e2e\_pw.log" -Tail 30
}
exit $pw
