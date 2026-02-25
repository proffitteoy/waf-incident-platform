param(
  [string]$CorazaSource = "..\coraza-main",
  [string]$CrsSource = "..\coreruleset-main"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$runtimeDir = Join-Path $projectRoot "infrastructure\waf\runtime"
$rulesDir = Join-Path $runtimeDir "rules"

$corazaPath = Resolve-Path (Join-Path $projectRoot $CorazaSource)
$crsPath = Resolve-Path (Join-Path $projectRoot $CrsSource)

New-Item -ItemType Directory -Force -Path $rulesDir | Out-Null

Copy-Item -Force (Join-Path $corazaPath "coraza.conf-recommended") (Join-Path $runtimeDir "coraza.conf")
Copy-Item -Force (Join-Path $crsPath "crs-setup.conf.example") (Join-Path $runtimeDir "crs-setup.conf")
Copy-Item -Force (Join-Path $crsPath "rules\*.conf") $rulesDir
Copy-Item -Force (Join-Path $crsPath "rules\REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf.example") (Join-Path $rulesDir "REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf")
Copy-Item -Force (Join-Path $crsPath "rules\RESPONSE-999-EXCLUSION-RULES-AFTER-CRS.conf.example") (Join-Path $rulesDir "RESPONSE-999-EXCLUSION-RULES-AFTER-CRS.conf")

Write-Host "Imported Coraza+CRS runtime assets into: $runtimeDir"
