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
} else {
  # Resolve "latest" to a concrete tag so the archive and its checksums come
  # from the same release even while a new one is being published.
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $latestResponse = Invoke-WebRequest -Uri "$repo/releases/latest" -Method Head -UseBasicParsing
  } catch {
    Write-Fail "Failed to resolve the latest release.`n`n  Possible causes:`n    - No internet connection`n    - GitHub is unreachable`n`n  URL: $repo/releases/latest"
    throw "Installation failed."
  }
  $base = $latestResponse.BaseResponse
  if ($base -is [System.Net.HttpWebResponse]) {
    $finalUrl = $base.ResponseUri.AbsoluteUri          # Windows PowerShell 5.1
  } else {
    $finalUrl = $base.RequestMessage.RequestUri.AbsoluteUri  # PowerShell 7+
  }
  if ($finalUrl -notmatch '/releases/tag/v(.+)$') {
    Write-Fail "Could not determine the latest version from: $finalUrl"
    throw "Installation failed."
  }
  $Version = $Matches[1]
}

$url = "$repo/releases/download/v$Version/resend-$target.zip"

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
    Write-Fail "Download failed.`n`n  Possible causes:`n    - No internet connection`n    - The version does not exist: $Version`n    - GitHub is unreachable`n`n  URL: $url"
    throw "Installation failed."
  }

  # --- Checksum verification ---------------------------------------------
  $archiveName  = "resend-$target.zip"
  $checksumsUrl = ($url.Substring(0, $url.LastIndexOf('/'))) + '/checksums.txt'
  $tmpChecksums = Join-Path $tmpDir 'checksums.txt'
  $expected     = $null
  $checksumsAvailable = $true

  try {
    Invoke-WebRequest -Uri $checksumsUrl -OutFile $tmpChecksums -UseBasicParsing
  } catch {
    # Releases up to v2.10.0 predate checksums.txt (404) -- warn and continue
    # so pinned old versions stay installable. Any other failure refuses to
    # install: a fetch error must not silently disable verification.
    $status = $null
    if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    }
    if ($status -eq 404) {
      Write-Info "This release has no published checksums -- skipping verification"
      $checksumsAvailable = $false
    } else {
      Write-Fail "Failed to download checksums.txt (HTTP $status).`n`n  Refusing to install without verification -- try again.`n`n  URL: $checksumsUrl"
      throw "Installation failed."
    }
  }

  if ($checksumsAvailable) {
    foreach ($line in Get-Content $tmpChecksums) {
      $parts = $line.Trim() -split '\s+'
      if ($parts.Length -eq 2 -and $parts[1] -eq $archiveName) {
        $expected = $parts[0].ToLower()
        break
      }
    }
    if (-not $expected) {
      Write-Fail "checksums.txt does not list $archiveName.`n`n  The release may be incomplete or tampered with. Please, try again.`n  Report it: https://github.com/resend/resend-cli/issues"
      throw "Installation failed."
    }
    $actual = (Get-FileHash -Path $tmpZip -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) {
      Write-Fail "Checksum verification failed for $archiveName.`n`n  Expected: $expected`n  Actual:   $actual`n`n  If the problem persists, report it: https://github.com/resend/resend-cli/issues"
      throw "Installation failed."
    }
    Write-Info "Checksum verified"
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
