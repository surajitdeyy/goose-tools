#!/usr/bin/env bash
# install.sh - Install the unified diff display for goose Desktop
#
# This script applies the diff-extension changes to your local goose source tree.
# It adds a DiffViewer component that renders unified diffs inline when the
# 'edit' tool is used, with syntax highlighting and character-level diff details.
#
# Usage:
#   ./install.sh [path-to-goose-repo]
#
# If no path is provided, the script looks for the goose repo in common locations.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_DIR="${SCRIPT_DIR}/../patches"
MODIFIED_DIR="${SCRIPT_DIR}/../modified"
ORIGINAL_DIR="${SCRIPT_DIR}/../original"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Find goose repo
find_goose_repo() {
  local provided="$1"

  if [ -n "$provided" ]; then
    if [ -d "$provided/ui/desktop/src/components" ]; then
      echo "$provided"
      return 0
    fi
    log_error "Provided path '$provided' does not appear to be a goose repo (missing ui/desktop/src/components)"
    exit 1
  fi

  # Check common locations
  local candidates=(
    "$HOME/Code/goose"
    "$HOME/goose"
    "$HOME/projects/goose"
    "$HOME/src/goose"
    "$HOME/Development/goose"
    "$(pwd)/../goose"
  )

  for candidate in "${candidates[@]}"; do
    if [ -d "$candidate/ui/desktop/src/components" ]; then
      log_info "Found goose repo at: $candidate"
      echo "$candidate"
      return 0
    fi
  done

  log_error "Could not find goose repo. Please provide the path as an argument."
  log_error "Usage: $0 [path-to-goose-repo]"
  exit 1
}

# Verify goose version compatibility
check_version() {
  local repo="$1"
  local pkg_json="${repo}/ui/desktop/package.json"

  if [ ! -f "$pkg_json" ]; then
    log_error "package.json not found at $pkg_json"
    exit 1
  fi

  local version
  version=$(grep '"version"' "$pkg_json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
  log_info "Goose version detected: $version"

  # Check for required dependencies
  if ! grep -q '"prismjs"' "$pkg_json" 2>/dev/null; then
    log_warn "prismjs not found in package.json. Syntax highlighting may not work."
    log_warn "The DiffViewer component requires prismjs for syntax highlighting."
  fi
}

# Create backup of original files
create_backup() {
  local repo="$1"
  local backup_dir="${repo}/ui/desktop/.diff-extension-backup"

  if [ -d "$backup_dir" ]; then
    log_warn "Backup already exists at $backup_dir. Overwriting..."
    rm -rf "$backup_dir"
  fi

  mkdir -p "$backup_dir/components" "$backup_dir/utils"

  cp "${repo}/ui/desktop/src/components/ToolCallWithResponse.tsx" "$backup_dir/components/"
  cp "${repo}/ui/desktop/src/utils/toolIconMapping.tsx" "$backup_dir/utils/"
  cp "${repo}/ui/desktop/package.json" "$backup_dir/"

  log_info "Backup created at $backup_dir"
}

# Install the DiffViewer component
install_diffviewer() {
  local repo="$1"
  local components_dir="${repo}/ui/desktop/src/components"
  local tests_dir="${components_dir}/__tests__"

  log_info "Installing DiffViewer component..."

  # Copy DiffViewer.tsx
  cp "${MODIFIED_DIR}/DiffViewer.tsx" "${components_dir}/DiffViewer.tsx"
  log_info "  ✓ Copied DiffViewer.tsx to ${components_dir}/"

  # Copy test file
  mkdir -p "$tests_dir"
  cp "${MODIFIED_DIR}/DiffViewer.test.tsx" "${tests_dir}/DiffViewer.test.tsx"
  log_info "  ✓ Copied DiffViewer.test.tsx to ${tests_dir}/"
}

# Apply patches to existing files
apply_patches() {
  local repo="$1"

  log_info "Applying patches..."

  # Patch ToolCallWithResponse.tsx
  local toolcall_file="${repo}/ui/desktop/src/components/ToolCallWithResponse.tsx"
  cp "${MODIFIED_DIR}/ToolCallWithResponse.tsx" "$toolcall_file"
  log_info "  ✓ Updated ToolCallWithResponse.tsx"

  # Patch toolIconMapping.tsx
  local icon_file="${repo}/ui/desktop/src/utils/toolIconMapping.tsx"
  cp "${MODIFIED_DIR}/toolIconMapping.tsx" "$icon_file"
  log_info "  ✓ Updated toolIconMapping.tsx"
}

# Add diff dependency to package.json
add_dependency() {
  local repo="$1"
  local pkg_json="${repo}/ui/desktop/package.json"

  log_info "Adding 'diff' dependency to package.json..."

  # Check if diff is already present
  if grep -q '"diff"' "$pkg_json"; then
    log_warn "'diff' already in package.json. Skipping."
    return 0
  fi

  # Insert "diff": "9.0.0", after "date-fns" line
  if grep -q '"date-fns"' "$pkg_json"; then
    sed -i 's/"date-fns": "\^4\.1\.0",/"date-fns": "^4.1.0",\n    "diff": "9.0.0",/' "$pkg_json"
    log_info "  ✓ Added diff@9.0.0 to dependencies"
  else
    log_error "Could not find 'date-fns' in package.json. Please add 'diff' manually."
    log_error "Add this line to the dependencies section: \"diff\": \"9.0.0\","
    exit 1
  fi
}

# Install the diff npm package
# Tries pnpm first, falls back to direct npm pack + extract if pnpm fails
install_diff_package() {
  local repo="$1"
  local desktop_dir="${repo}/ui/desktop"
  local node_modules="${desktop_dir}/node_modules"

  log_info "Installing 'diff' npm package..."

  # Check if diff is already installed in node_modules
  if [ -f "${node_modules}/diff/package.json" ]; then
    local installed_ver
    installed_ver=$(grep '"version"' "${node_modules}/diff/package.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    if [ "$installed_ver" = "9.0.0" ]; then
      log_info "  ✓ diff@9.0.0 already installed in node_modules"
      return 0
    else
      log_warn "  diff@${installed_ver} found, replacing with 9.0.0..."
      rm -rf "${node_modules}/diff"
    fi
  fi

  # Method 1: Try pnpm install (the proper way)
  if command -v pnpm &>/dev/null; then
    log_info "  Trying pnpm install..."
    if (cd "$desktop_dir" && pnpm install --no-frozen-lockfile 2>&1) | tail -5; then
      if [ -f "${node_modules}/diff/package.json" ]; then
        log_info "  ✓ diff installed via pnpm"
        return 0
      fi
    fi
    log_warn "  pnpm install did not install diff (may have pre-existing issues in the goose repo)"
  else
    log_warn "  pnpm not found in PATH"
  fi

  # Method 2: Install diff directly using npm pack + extract
  # This bypasses pnpm entirely and only installs the one package we need
  log_info "  Installing diff directly into node_modules..."

  # Find a working npm/npx
  local npm_cmd=""
  if command -v npm &>/dev/null; then
    npm_cmd="npm"
  elif command -v npx &>/dev/null; then
    npm_cmd="npx"
  else
    # Try hermit-managed node (goose's own node distribution)
    if [ -f "$HOME/.config/goose/mcp-hermit/bin/npm" ]; then
      npm_cmd="$HOME/.config/goose/mcp-hermit/bin/npm"
    elif [ -f "$HOME/.config/goose/mcp-hermit/bin/npx" ]; then
      npm_cmd="$HOME/.config/goose/mcp-hermit/bin/npx"
    fi
  fi

  if [ -z "$npm_cmd" ]; then
    log_error "  No npm/npx found. Cannot install diff package."
    log_error "  Please install Node.js and run: cd ${desktop_dir} && npm install diff@9.0.0"
    exit 1
  fi

  log_info "  Using: $npm_cmd"

  # Download and extract diff package directly
  local tmp_dir=$(mktemp -d)
  trap "rm -rf $tmp_dir" EXIT

  if "$npm_cmd" pack diff@9.0.0 --pack-destination "$tmp_dir" 2>&1 | grep -v "^npm notice"; then
    local tarball=$(ls "$tmp_dir"/diff-*.tgz 2>/dev/null | head -1)
    if [ -n "$tarball" ]; then
      mkdir -p "${node_modules}/diff"
      tar xzf "$tarball" -C "${node_modules}/diff" --strip-components=1
      if [ -f "${node_modules}/diff/package.json" ]; then
        log_info "  ✓ diff@9.0.0 installed directly into node_modules"
        return 0
      fi
    fi
  fi

  log_error "  Failed to install diff package."
  log_error "  Please install it manually: cd ${desktop_dir} && npm install diff@9.0.0"
  exit 1
}

# Print summary
print_summary() {
  echo ""
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN}  Diff Extension installed successfully!${NC}"
  echo -e "${GREEN}============================================${NC}"
  echo ""
  echo "What was changed:"
  echo "  • Added:   ui/desktop/src/components/DiffViewer.tsx"
  echo "  • Added:   ui/desktop/src/components/__tests__/DiffViewer.test.tsx"
  echo "  • Updated: ui/desktop/src/components/ToolCallWithResponse.tsx"
  echo "  • Updated: ui/desktop/src/utils/toolIconMapping.tsx"
  echo "  • Updated: ui/desktop/package.json (added 'diff' dependency)"
  echo ""
  echo "To see diffs in action:"
  echo "  1. Rebuild goose Desktop"
  echo "  2. When goose uses the 'edit' tool, expand the tool call"
  echo "  3. You'll see a unified diff with syntax highlighting"
  echo ""
  echo "To uninstall:"
  echo "  Run: ./uninstall.sh [path-to-goose-repo]"
  echo ""
}

# Main
main() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  Goose Diff Extension Installer         ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ""

  local repo
  repo=$(find_goose_repo "${1:-}")

  check_version "$repo"
  create_backup "$repo"
  install_diffviewer "$repo"
  apply_patches "$repo"
  add_dependency "$repo"
  install_diff_package "$repo"
  print_summary
}

main "$@"
