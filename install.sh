#!/usr/bin/env bash
# Resend CLI installer
# Usage:  curl -fsSL https://resend.com/install.sh | bash
#    or:  curl -fsSL https://resend.com/install.sh | bash -s v0.2.0
set -euo pipefail

# ─── Colors (only when outputting to a terminal) ─────────────────────────────

Color_Off='' Red='' Green='' Dim='' Bold='' Blue=''

if [[ -t 1 ]]; then
  Color_Off='\033[0m'
  Red='\033[0;31m'
  Green='\033[0;32m'
  Dim='\033[0;2m'
  Bold='\033[1m'
  Blue='\033[0;34m'
fi

# ─── Helpers ─────────────────────────────────────────────────────────────────

error() {
  printf "%b\n" "${Red}error${Color_Off}: $*" >&2
  exit 1
}

info() {
  printf "%b\n" "${Dim}$*${Color_Off}"
}

success() {
  printf "%b\n" "${Green}$*${Color_Off}"
}

bold() {
  printf "%b\n" "${Bold}$*${Color_Off}"
}

tildify() {
  if [[ $1 == "$HOME"/* ]]; then
    echo "~${1#"$HOME"}"
  else
    echo "$1"
  fi
}

# ─── Dependency checks ───────────────────────────────────────────────────────

command -v curl >/dev/null 2>&1 || error "curl is required but not found. Install it and try again."
command -v tar  >/dev/null 2>&1 || error "tar is required but not found. Install it and try again."

# ─── OS / Architecture detection ─────────────────────────────────────────────

platform=$(uname -ms)

case $platform in
  'Darwin x86_64')   target=darwin-x64 ;;
  'Darwin arm64')    target=darwin-arm64 ;;
  'Linux aarch64')   target=linux-arm64 ;;
  'Linux arm64')     target=linux-arm64 ;;
  'Linux x86_64')    target=linux-x64 ;;
  *)
    error "Unsupported platform: ${platform}. Resend CLI supports macOS (x64/arm64) and Linux (x64/arm64)."
    ;;
esac

# Detect Rosetta 2 on macOS — prefer native arm64 binary
if [[ $target == "darwin-x64" ]]; then
  if [[ $(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0) == "1" ]]; then
    target=darwin-arm64
    info "Rosetta 2 detected — installing native arm64 binary"
  fi
fi

# ─── Version + Download URL ──────────────────────────────────────────────────

GITHUB_BASE=${GITHUB_BASE:-"https://github.com"}
REPO="${GITHUB_BASE}/resend/resend-cli"
VERSION=${1:-}

if [[ -n $VERSION ]]; then
  # Strip leading 'v' if present, then re-add for the tag
  VERSION="${VERSION#v}"
  url="${REPO}/releases/download/v${VERSION}/resend-${target}.tar.gz"
else
  url="${REPO}/releases/latest/download/resend-${target}.tar.gz"
fi

# ─── Install directory ───────────────────────────────────────────────────────

install_dir="${RESEND_INSTALL:-$HOME/.resend}"
bin_dir="${install_dir}/bin"
exe="${bin_dir}/resend"

mkdir -p "$bin_dir" || error "Failed to create install directory: ${bin_dir}"

# ─── Download + Extract ──────────────────────────────────────────────────────

bold "Installing Resend CLI..."
echo ""

tmpfile=$(mktemp) || error "Failed to create temporary file"
trap 'rm -f "$tmpfile"' EXIT INT TERM

info "  Downloading from ${url}"
echo ""

curl --fail --location --progress-bar --output "$tmpfile" "$url" ||
  error "Download failed. Check your internet connection and try again.
       If you specified a version, make sure it exists: ${url}"

tar -xzf "$tmpfile" -C "$bin_dir" 2>/dev/null ||
  error "Failed to extract archive. The download may be corrupted — try again."

chmod +x "$exe" || error "Failed to make binary executable"

# ─── Verify installation ─────────────────────────────────────────────────────

installed_version=$("$exe" --version 2>/dev/null || echo "unknown")

echo ""
success "  Resend CLI v${installed_version} installed successfully!"
echo ""
info "  Binary:  $(tildify "$exe")"

# ─── PATH setup ──────────────────────────────────────────────────────────────

# Check if already on PATH
if command -v resend >/dev/null 2>&1; then
  existing=$(command -v resend)
  if [[ "$existing" == "$exe" ]]; then
    echo ""
    bold "  Run ${Blue}resend --help${Color_Off}${Bold} to get started${Color_Off}"
    echo ""
    exit 0
  else
    info "  Note: another 'resend' was found at ${existing}"
    info "  The new installation at $(tildify "$exe") may be shadowed."
  fi
fi

# Check if bin_dir is already in PATH
if echo "$PATH" | tr ':' '\n' | grep -qxF "${bin_dir}" 2>/dev/null; then
  echo ""
  bold "  Run ${Blue}resend --help${Color_Off}${Bold} to get started${Color_Off}"
  echo ""
  exit 0
fi

# Determine shell config file
shell_name=$(basename "${SHELL:-}")
config=""
shell_line=""

case $shell_name in
  zsh)
    config="${ZDOTDIR:-$HOME}/.zshrc"
    shell_line="export PATH=\"$(tildify "$bin_dir"):\$PATH\""
    ;;
  bash)
    if [[ -f "$HOME/.bashrc" ]]; then
      config="$HOME/.bashrc"
    elif [[ -f "$HOME/.bash_profile" ]]; then
      config="$HOME/.bash_profile"
    else
      config="$HOME/.bashrc"
    fi
    shell_line="export PATH=\"$(tildify "$bin_dir"):\$PATH\""
    ;;
  fish)
    config="${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"
    shell_line="set -gx PATH $(tildify "$bin_dir") \$PATH"
    ;;
esac

if [[ -n $config ]]; then
  # Check if PATH entry already exists in config (check both tildified and absolute)
  if [[ -f "$config" ]] && (grep -qF "$(tildify "$bin_dir")" "$config" 2>/dev/null || grep -qF "$bin_dir" "$config" 2>/dev/null); then
    info "  PATH already configured in $(tildify "$config")"
  elif [[ -w "${config%/*}" ]] || [[ -w "$config" ]]; then
    {
      echo ""
      echo "# Resend CLI"
      echo "$shell_line"
    } >> "$config"
    info "  Added $(tildify "$bin_dir") to \$PATH in $(tildify "$config")"
    echo ""
    info "  To start using Resend CLI, run:"
    echo ""
    bold "    source $(tildify "$config")"
    bold "    resend --help"
  else
    echo ""
    info "  Manually add to your shell config:"
    echo ""
    bold "    ${shell_line}"
  fi
else
  echo ""
  info "  Add to your shell config:"
  echo ""
  bold "    export PATH=\"$(tildify "$bin_dir"):\$PATH\""
fi

echo ""
