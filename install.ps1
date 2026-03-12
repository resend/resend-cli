#!/usr/bin/env pwsh
# Resend CLI installer for Windows
#
# Usage (PowerShell):
#   irm https://resend.com/install.ps1 | iex
#
# Pin a version:
#   $env:RESEND_VERSION = 'v0.1.0'; irm https://resend.com/install.ps1 | iex
#
# Environment variables:
#   RESEND_INSTALL  - Custom install directory (default: $HOME\.resend)
#   RESEND_VERSION  - Version to install (default: latest)

param(
  [string]$Version = $env:RESEND_VERSION
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- Helpers -----------------------------------------------------------------

function Write-Info { param($msg) Write-Host "  $msg" -ForegroundColor DarkGray }
function Write-Ok   { param($msg) Write-Host "  $msg" -ForegroundColor Green }

function Write-Fail {
  param($msg)
  Write-Host "  error: $msg" -ForegroundColor Red
}

# --- Architecture detection --------------------------------------------------

if ($env:PROCESSOR_ARCHITECTURE -notin @('AMD64', 'EM64T')) {
  Write-Fail "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE`n`n  Resend CLI currently supports Windows x64 only."
  throw "Installation failed."
}

# --- Version + Download URL --------------------------------------------------

$repo = 'https://github.com/resend/resend-cli'
$target = 'windows-x64'

if ($Version) {
  $Version = $Version.TrimStart('v')
  if ($Version -notmatch '^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$') {
    Write-Fail "Invalid version format: $Version`n`n  Expected: semantic version like 0.1.0 or 1.2.3-beta.1`n  Usage:    `$env:RESEND_VERSION = 'v0.1.0'; irm https://resend.com/install.ps1 | iex"
    throw "Installation failed."
  }
  $url = "$repo/releases/download/v$Version/resend-$target.zip"
} else {
  $url = "$repo/releases/latest/download/resend-$target.zip"
}

# --- Install directory -------------------------------------------------------

if ($env:RESEND_INSTALL) { $installDir = $env:RESEND_INSTALL } else { $installDir = Join-Path $HOME '.resend' }
$binDir     = Join-Path $installDir 'bin'
$exe        = Join-Path $binDir 'resend.exe'

if (-not (Test-Path $binDir)) {
  New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

# --- Download + Extract ------------------------------------------------------

Write-Host ""
Write-Host "  Installing Resend CLI..." -ForegroundColor White
Write-Host ""
Write-Info "Downloading from $url"
Write-Host ""

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "resend-$([System.Guid]::NewGuid())"
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
$tmpZip = Join-Path $tmpDir 'resend.zip'

try {
  try {
    # Force TLS 1.2 for Windows PowerShell 5.1 (no-op on PowerShell 7+ where it is the default)
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'  # Invoke-WebRequest is ~10x faster without progress bar
    Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing
  } catch {
    if ($Version) { $ver = $Version } else { $ver = 'latest' }
    Write-Fail "Download failed.`n`n  Possible causes:`n    - No internet connection`n    - The version does not exist: $ver`n    - GitHub is unreachable`n`n  URL: $url"
    throw "Installation failed."
  }

  try {
    Expand-Archive -Path $tmpZip -DestinationPath $binDir -Force
  } catch {
    Write-Fail "Failed to extract archive: $_"
    throw "Installation failed."
  }
} finally {
  Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}

if (-not (Test-Path $exe)) {
  Write-Fail "Binary not found after extraction. The download may be corrupted -- try again."
  throw "Installation failed."
}

# --- Verify installation -----------------------------------------------------

try {
  $installedVersion = (& $exe --version 2>$null).Trim()
} catch {
  $installedVersion = 'unknown'
}

Write-Host ""
Write-Ok "Resend CLI $installedVersion installed successfully!"
Write-Host ""
Write-Info "Binary:  $exe"

# --- PATH setup --------------------------------------------------------------

$userPath    = [Environment]::GetEnvironmentVariable('PATH', 'User')
if (-not $userPath) { $userPath = '' }
$pathEntries = $userPath -split ';' | Where-Object { $_ -ne '' }

if ($pathEntries -contains $binDir) {
  # Already on PATH -- just print the getting-started line
  Write-Host ""
  Write-Host "  Run " -NoNewline
  Write-Host "resend --help" -ForegroundColor Cyan -NoNewline
  Write-Host " to get started"
  Write-Host ""
  return
}

# Add to user PATH (persists across sessions -- no admin rights needed)
$newPath = ($pathEntries + $binDir) -join ';'
[Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')
$env:PATH = "$env:PATH;$binDir"  # Also update the current session

Write-Info "Added $binDir to PATH (User scope)"
Write-Host ""
Write-Info "Restart your terminal, then:"
Write-Host ""
Write-Info "Next steps:"
Write-Host ""
Write-Host "    `$env:RESEND_API_KEY = 're_...'" -ForegroundColor Cyan
Write-Host "    resend --help" -ForegroundColor Cyan
Write-Host ""
return
