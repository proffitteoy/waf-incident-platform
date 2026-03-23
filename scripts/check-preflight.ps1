param()

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$backendEnvPath = Join-Path $projectRoot "backend/.env"
$composePath = Join-Path $projectRoot "docker-compose.yml"

$passCount = 0
$warnCount = 0
$failCount = 0

function Write-CheckResult {
  param(
    [string]$Name,
    [ValidateSet("PASS", "WARN", "FAIL")]
    [string]$Status,
    [string]$Message
  )

  switch ($Status) {
    "PASS" {
      $script:passCount += 1
      Write-Host "[PASS] $Name - $Message" -ForegroundColor Green
    }
    "WARN" {
      $script:warnCount += 1
      Write-Host "[WARN] $Name - $Message" -ForegroundColor Yellow
    }
    "FAIL" {
      $script:failCount += 1
      Write-Host "[FAIL] $Name - $Message" -ForegroundColor Red
    }
  }
}

function Read-DotEnv {
  param([string]$Path)

  $map = @{}
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    if ($parts.Count -ne 2) {
      continue
    }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    $map[$key] = $value
  }

  return $map
}

Write-Host "=== project2 preflight check ===" -ForegroundColor Cyan
Write-Host "Project Root: $projectRoot"
Write-Host ""

# Docker CLI
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($null -eq $dockerCmd) {
  Write-CheckResult -Name "Docker CLI" -Status "FAIL" -Message "docker command not found."
} else {
  Write-CheckResult -Name "Docker CLI" -Status "PASS" -Message "docker command found."
}

# Docker daemon
$dockerDaemonOk = $false
if ($null -ne $dockerCmd) {
  try {
    docker info | Out-Null
    $dockerDaemonOk = $true
    Write-CheckResult -Name "Docker Daemon" -Status "PASS" -Message "daemon is running."
  } catch {
    Write-CheckResult -Name "Docker Daemon" -Status "FAIL" -Message "daemon is not available. Start Docker Desktop first."
  }
}

# docker-compose.yml
if (Test-Path $composePath) {
  Write-CheckResult -Name "Compose File" -Status "PASS" -Message "docker-compose.yml found."
} else {
  Write-CheckResult -Name "Compose File" -Status "FAIL" -Message "docker-compose.yml is missing."
}

# backend/.env
if (Test-Path $backendEnvPath) {
  Write-CheckResult -Name "backend/.env" -Status "PASS" -Message "file exists."

  $envMap = Read-DotEnv -Path $backendEnvPath
  $requiredKeys = @(
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "REDIS_HOST",
    "REDIS_PORT",
    "BACKEND_PORT",
    "JWT_SECRET",
    "FORENSICS_DOWNLOAD_SIGNING_SECRET"
  )

  $missing = @()
  foreach ($key in $requiredKeys) {
    if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
      $missing += $key
    }
  }

  if ($missing.Count -eq 0) {
    Write-CheckResult -Name "Required Config" -Status "PASS" -Message "all required keys are present."
  } else {
    Write-CheckResult -Name "Required Config" -Status "FAIL" -Message ("missing or empty: " + ($missing -join ", "))
  }

  if ($envMap.ContainsKey("POSTGRES_PORT") -and $envMap["POSTGRES_PORT"] -eq "55432") {
    Write-CheckResult -Name "POSTGRES_PORT" -Status "PASS" -Message "set to 55432 (recommended)."
  } else {
    Write-CheckResult -Name "POSTGRES_PORT" -Status "WARN" -Message "not 55432, may conflict with local PostgreSQL."
  }
} else {
  Write-CheckResult -Name "backend/.env" -Status "FAIL" -Message "missing. Copy from backend/.env.example first."
}

# Port checks
$portChecks = @(
  @{ Name = "PostgreSQL(55432)"; Port = 55432 },
  @{ Name = "Redis(6379)"; Port = 6379 }
)

foreach ($item in $portChecks) {
  try {
    $ok = Test-NetConnection -ComputerName localhost -Port $item.Port -WarningAction SilentlyContinue
    if ($ok.TcpTestSucceeded) {
      Write-CheckResult -Name $item.Name -Status "PASS" -Message "port is reachable."
    } else {
      Write-CheckResult -Name $item.Name -Status "WARN" -Message "port not reachable; dependency may be down."
    }
  } catch {
    Write-CheckResult -Name $item.Name -Status "WARN" -Message "port check failed."
  }
}

# Compose running services
if ($dockerDaemonOk -and (Test-Path $composePath)) {
  try {
    $running = docker compose -f $composePath ps --services --filter "status=running"
    $runningText = ($running -join ", ").Trim(", ")

    if ($running -contains "postgres" -and $running -contains "redis") {
      Write-CheckResult -Name "Dependency Containers" -Status "PASS" -Message "postgres and redis are running."
    } else {
      if ([string]::IsNullOrWhiteSpace($runningText)) {
        $runningText = "none"
      }
      Write-CheckResult -Name "Dependency Containers" -Status "WARN" -Message "running now: $runningText."
    }
  } catch {
    Write-CheckResult -Name "Dependency Containers" -Status "WARN" -Message "cannot read docker compose status."
  }
}

Write-Host ""
Write-Host "=== preflight summary ===" -ForegroundColor Cyan
Write-Host "PASS: $passCount"
Write-Host "WARN: $warnCount"
Write-Host "FAIL: $failCount"

if ($failCount -gt 0) {
  Write-Host "Result: blocking issues found. Fix FAIL items first." -ForegroundColor Red
  exit 1
}

if ($warnCount -gt 0) {
  Write-Host "Result: startup can continue, but WARN items should be checked." -ForegroundColor Yellow
  exit 0
}

Write-Host "Result: preflight checks passed." -ForegroundColor Green
exit 0
