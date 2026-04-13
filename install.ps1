# =============================================================================
# Chimedeck — Quick-Start Install Script (Windows)
#
# Usage (one-liner from landing page — run in PowerShell as Administrator):
#   $tmp = "$env:TEMP\chimedeck-install.ps1"; iwr -Uri https://your-site.com/install.ps1 -OutFile $tmp; & $tmp
#
# Note: Download-then-execute (above) is required so that Read-Host works
#       correctly. Inline pipe (irm | iex) suppresses interactive prompts.
# =============================================================================

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Config ────────────────────────────────────────────────────────────────────
# Replace this with your actual repository URL before hosting the script.
$REPO_URL   = "https://github.com/YOUR_ORG/YOUR_REPO.git"
$INSTALL_DIR = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "chimedeck" }

# ── Colour helpers ─────────────────────────────────────────────────────────────
function Write-Info   { param($msg) Write-Host "[OK] $msg"      -ForegroundColor Green  }
function Write-Warn   { param($msg) Write-Host "[!]  $msg"      -ForegroundColor Yellow }
function Write-Err    { param($msg) Write-Host "[!!] $msg"      -ForegroundColor Red    }
function Write-Section { param($msg) Write-Host "`n>>> $msg"    -ForegroundColor Cyan   }

# ── Docker check / install ─────────────────────────────────────────────────────
function Ensure-Docker {
  Write-Section "Checking Docker"

  $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue

  if (-not $dockerCmd) {
    Write-Warn "Docker not found — attempting to install Docker Desktop..."

    # Try winget first (available on Windows 10 1709+ and Windows 11)
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
      Write-Info "Installing Docker Desktop via winget..."
      winget install --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements --silent
    }
    else {
      # Fallback: Chocolatey
      $choco = Get-Command choco -ErrorAction SilentlyContinue
      if ($choco) {
        Write-Info "Installing Docker Desktop via Chocolatey..."
        choco install docker-desktop -y
      }
      else {
        Write-Err "Neither winget nor Chocolatey is available."
        Write-Err "Please install Docker Desktop manually:  https://docs.docker.com/desktop/install/windows-install/"
        exit 1
      }
    }

    # Re-check
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
      Write-Err "Docker installation did not complete successfully."
      Write-Err "Please install Docker Desktop manually:  https://docs.docker.com/desktop/install/windows-install/"
      Write-Err "After installation, restart this script."
      exit 1
    }
  }

  Write-Info "Docker found: $(& docker --version)"

  # ── Ensure daemon is running ─────────────────────────────────────────────────
  $daemonRunning = $false
  try {
    & docker info 2>$null | Out-Null
    $daemonRunning = $LASTEXITCODE -eq 0
  } catch { }

  if (-not $daemonRunning) {
    Write-Warn "Docker daemon is not running — attempting to start Docker Desktop..."

    # Start Docker Desktop
    $dockerDesktop = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktop) {
      Start-Process $dockerDesktop
    }
    else {
      Write-Err "Docker Desktop executable not found at '$dockerDesktop'."
      Write-Err "Please start Docker Desktop manually and re-run this script."
      exit 1
    }

    Write-Info "Waiting for Docker Desktop to start (up to 120 s)..."
    $deadline = (Get-Date).AddSeconds(120)
    $ready = $false

    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 3
      Write-Host "." -NoNewline
      try {
        & docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
      } catch { }
    }

    Write-Host ""

    if (-not $ready) {
      Write-Err "Docker Desktop did not start within 120 s."
      Write-Err "Please start Docker Desktop manually and re-run this script."
      exit 1
    }
  }

  Write-Info "Docker daemon is running."
}

# ── Docker Compose ─────────────────────────────────────────────────────────────
$script:ComposeCmd = @()

function Ensure-Compose {
  try {
    & docker compose version 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $script:ComposeCmd = @("docker", "compose")
      Write-Info "Compose command: docker compose"
      return
    }
  } catch { }

  $dockerCompose = Get-Command docker-compose -ErrorAction SilentlyContinue
  if ($dockerCompose) {
    $script:ComposeCmd = @("docker-compose")
    Write-Info "Compose command: docker-compose"
    return
  }

  Write-Err "Docker Compose is not available."
  Write-Err "Please install it:  https://docs.docker.com/compose/install/"
  exit 1
}

function Invoke-Compose {
  param([string[]]$Args)
  & $script:ComposeCmd[0] ($script:ComposeCmd[1..($script:ComposeCmd.Length - 1)] + $Args)
  if ($LASTEXITCODE -ne 0) { throw "docker compose failed with exit code $LASTEXITCODE" }
}

# ── JWT RS256 key generation ───────────────────────────────────────────────────
$script:JwtPrivateKey = ""
$script:JwtPublicKey  = ""

function Generate-JwtKeys {
  Write-Section "Generating RS256 JWT key pair"

  # Attempt 1: .NET RSA (available in PowerShell 7+ / .NET 5+)
  $netMethod = $null
  try {
    $rsa = [System.Security.Cryptography.RSA]::Create(2048)
    # ExportRSAPrivateKeyPem / ExportSubjectPublicKeyInfoPem require .NET 5+
    $privateKeyPem = $rsa.ExportRSAPrivateKeyPem()
    $publicKeyPem  = $rsa.ExportSubjectPublicKeyInfoPem()
    $rsa.Dispose()

    $script:JwtPrivateKey = [Convert]::ToBase64String(
      [System.Text.Encoding]::ASCII.GetBytes($privateKeyPem))
    $script:JwtPublicKey  = [Convert]::ToBase64String(
      [System.Text.Encoding]::ASCII.GetBytes($publicKeyPem))

    $netMethod = $true
  } catch {
    $netMethod = $false
  }

  if (-not $netMethod) {
    # Attempt 2: openssl.exe (bundled with Git for Windows; present in System32 on Win10+)
    $opensslCmd = Get-Command openssl -ErrorAction SilentlyContinue
    if (-not $opensslCmd) {
      Write-Err "Could not generate JWT keys: neither .NET 5+ RSA PEM export nor openssl is available."
      Write-Err "Please upgrade to PowerShell 7 (https://aka.ms/powershell) or install Git for Windows."
      exit 1
    }

    $tmpDir = Join-Path $env:TEMP "chimedeck-jwt-$([guid]::NewGuid())"
    New-Item -ItemType Directory -Path $tmpDir | Out-Null

    $privFile = Join-Path $tmpDir "private.pem"
    $pubFile  = Join-Path $tmpDir "public.pem"

    & openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out $privFile 2>$null
    & openssl rsa -pubout -in $privFile -out $pubFile 2>$null

    $script:JwtPrivateKey = [Convert]::ToBase64String(
      [System.Text.Encoding]::UTF8.GetBytes([System.IO.File]::ReadAllText($privFile)))
    $script:JwtPublicKey  = [Convert]::ToBase64String(
      [System.Text.Encoding]::UTF8.GetBytes([System.IO.File]::ReadAllText($pubFile)))

    Remove-Item -Recurse -Force $tmpDir
  }

  Write-Info "JWT key pair generated."
}

# ── Parse docker-compose.yml for DB / LocalStack values ───────────────────────
function Parse-ComposeValues {
  param([string]$ComposePath)

  $content = Get-Content $ComposePath -Raw

  # Extract POSTGRES_* values
  $pgUserMatch     = [regex]::Match($content, 'POSTGRES_USER:\s*(\S+)')
  $pgPassMatch     = [regex]::Match($content, 'POSTGRES_PASSWORD:\s*(\S+)')
  $pgDbMatch       = [regex]::Match($content, 'POSTGRES_DB:\s*(\S+)')

  $script:PgUser     = if ($pgUserMatch.Success)  { $pgUserMatch.Groups[1].Value.Trim('"', "'") } else { "chimedeck" }
  $script:PgPassword = if ($pgPassMatch.Success)  { $pgPassMatch.Groups[1].Value.Trim('"', "'") } else { "chimedeck" }
  $script:PgDb       = if ($pgDbMatch.Success)    { $pgDbMatch.Groups[1].Value.Trim('"', "'") }  else { "chimedeck_dev" }

  # Extract host port for LocalStack (pattern: "HOST:4566")
  $lsPortMatch = [regex]::Match($content, '"(\d+):4566"')
  $script:LsHostPort = if ($lsPortMatch.Success) { $lsPortMatch.Groups[1].Value } else { "4566" }

  if (-not $pgUserMatch.Success) {
    Write-Warn "Could not fully parse docker-compose.yml — using defaults."
  }
}

# ── Prompt helper ─────────────────────────────────────────────────────────────
function Prompt-Required {
  param([string]$Label)
  $val = ""
  while ([string]::IsNullOrWhiteSpace($val)) {
    $val = Read-Host "  $Label"
    if ([string]::IsNullOrWhiteSpace($val)) {
      Write-Warn "This field is required — please enter a value."
    }
  }
  return $val.Trim()
}

# ── Main ───────────────────────────────────────────────────────────────────────
function Main {
  Write-Host ""
  Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "║        Chimedeck — Quick-Start Installer             ║" -ForegroundColor Cyan
  Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host ""

  Ensure-Docker
  Ensure-Compose

  # ── Clone or update repo ────────────────────────────────────────────────────
  Write-Section "Setting up project files"

  if (Test-Path (Join-Path $INSTALL_DIR ".git")) {
    Write-Info "Directory '.\$INSTALL_DIR' already exists — pulling latest changes..."
    & git -C $INSTALL_DIR pull --ff-only
  }
  else {
    Write-Info "Cloning repository into '.\$INSTALL_DIR'..."
    & git clone $REPO_URL $INSTALL_DIR
    if ($LASTEXITCODE -ne 0) { Write-Err "git clone failed."; exit 1 }
  }

  Set-Location $INSTALL_DIR

  # ── Collect required user input ─────────────────────────────────────────────
  Write-Section "Configuration"
  Write-Host ""
  Write-Host "  Please enter the platform administrator emails."
  Write-Host "  These accounts will have full admin access to Chimedeck."
  Write-Host ""

  $platformAdminEmails = Prompt-Required "Admin emails (comma-separated, e.g. admin@example.com,cto@example.com)"

  # ── Parse compose file ──────────────────────────────────────────────────────
  Parse-ComposeValues "docker-compose.yml"

  $databaseUrl = "postgresql://$($script:PgUser):$($script:PgPassword)@postgres:5432/$($script:PgDb)"
  $redisUrl    = "redis://redis:6379"
  $s3Endpoint  = "http://localstack:$($script:LsHostPort)"
  $s3Bucket    = $script:PgUser   # bucket name mirrors the project slug

  # ── Generate JWT keys ───────────────────────────────────────────────────────
  Generate-JwtKeys

  # ── Write .env ──────────────────────────────────────────────────────────────
  Write-Section "Writing .env"

  $timestamp  = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ" -AsUTC)
  $envContent = @"
# Auto-generated by install.ps1 — $timestamp
# Edit this file to customise your deployment.

# -- Database --------------------------------------------------------------
# Host is the docker-compose service name "postgres" (resolved inside Docker network).
DATABASE_URL=$databaseUrl

# -- JWT (RS256) -----------------------------------------------------------
JWT_PRIVATE_KEY=$($script:JwtPrivateKey)
JWT_PUBLIC_KEY=$($script:JwtPublicKey)

# -- S3 / LocalStack -------------------------------------------------------
# LocalStack runs inside the Docker network -- host is the service name "localstack".
S3_BUCKET=$s3Bucket
S3_REGION=us-east-1
S3_ENDPOINT=$s3Endpoint
S3_AWS_ACCESS_KEY_ID=test
S3_AWS_SECRET_ACCESS_KEY=test
FLAG_USE_LOCAL_STORAGE=true

# -- Redis -----------------------------------------------------------------
# Host is the docker-compose service name "redis" (resolved inside Docker network).
REDIS_URL=$redisUrl
FLAG_USE_REDIS=true

# -- App -------------------------------------------------------------------
APP_PORT=3000
NODE_ENV=production

# -- Feature flags ---------------------------------------------------------
FLAG_VIRUS_SCAN_ENABLED=false
FLAG_EMAIL_VERIFICATION_ENABLED=false
FLAG_SES_ENABLED=false
FLAG_OAUTH_GOOGLE_ENABLED=false
FLAG_OAUTH_GITHUB_ENABLED=false
AUTOMATION_SCHEDULER_ENABLED=true
HEALTH_CHECK_ENABLED=true

# -- Email domain restriction ----------------------------------------------
# Set to false to allow any email to self-register.
EMAIL_DOMAIN_RESTRICTION_ENABLED=false

# -- Platform admin --------------------------------------------------------
PLATFORM_ADMIN_EMAILS=$platformAdminEmails
VITE_PLATFORM_ADMIN_EMAILS=$platformAdminEmails

# -- Seed ------------------------------------------------------------------
SEED_TRELLO=false
"@

  [System.IO.File]::WriteAllText((Join-Path $PWD ".env"), $envContent, [System.Text.Encoding]::UTF8)
  Write-Info ".env written."

  # ── Launch services ─────────────────────────────────────────────────────────
  Write-Section "Starting services"
  Write-Info "Running: docker compose --profile redis up -d --build"
  Invoke-Compose @("--profile", "redis", "up", "-d", "--build")

  # ── Wait for health endpoint ────────────────────────────────────────────────
  Write-Section "Waiting for app to become ready"
  $appPort = 3000
  $deadline = (Get-Date).AddSeconds(120)
  $healthy  = $false

  while ((Get-Date) -lt $deadline) {
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 3
    try {
      $resp = Invoke-WebRequest -Uri "http://localhost:$appPort/health" -UseBasicParsing -TimeoutSec 3
      if ($resp.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
  }

  Write-Host ""

  if (-not $healthy) {
    Write-Warn "App did not respond within 120 s."
    Write-Warn "Check logs:  docker compose logs -f app"
  }

  # ── Done ───────────────────────────────────────────────────────────────────
  Write-Host ""
  Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
  Write-Host "║  Chimedeck is ready!                                            ║" -ForegroundColor Green
  Write-Host "║                                                                 ║" -ForegroundColor Green
  Write-Host "║  Open:   http://localhost:$appPort                               ║" -ForegroundColor Green
  Write-Host "║                                                                 ║" -ForegroundColor Green
  Write-Host "║  Useful commands (run from the '$INSTALL_DIR\' directory):       ║" -ForegroundColor Green
  Write-Host "║    Logs:   docker compose logs -f app                           ║" -ForegroundColor Green
  Write-Host "║    Stop:   docker compose --profile redis down                  ║" -ForegroundColor Green
  Write-Host "║    Start:  docker compose --profile redis up -d                 ║" -ForegroundColor Green
  Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
  Write-Host ""
}

Main
