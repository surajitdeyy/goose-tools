#!/usr/bin/env bash
# uninstall.sh - Uninstall the unified diff display from goose Desktop
#
# This script reverts the diff-extension changes, restoring the original
# goose source files from the backup created during installation.
#
# Usage:
#   ./uninstall.sh [path-to-goose-repo]
#
# If no path is provided, the script looks for the goose repo in common locations.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Restore from backup
restore_from_backup() {
  local repo="$1"
  local backup_dir="${repo}/ui/desktop/.diff-extension-backup"

  if [ ! -d "$backup_dir" ]; then
    log_warn "No backup found at $backup_dir."
    log_info "Will restore from original files shipped with this extension instead."
    return 1
  fi

  log_info "Restoring from backup at $backup_dir..."

  cp "${backup_dir}/components/ToolCallWithResponse.tsx" "${repo}/ui/desktop/src/components/ToolCallWithResponse.tsx"
  cp "${backup_dir}/utils/toolIconMapping.tsx" "${repo}/ui/desktop/src/utils/toolIconMapping.tsx"
  cp "${backup_dir}/package.json" "${repo}/ui/desktop/package.json"

  log_info "  ✓ Restored ToolCallWithResponse.tsx"
  log_info "  ✓ Restored toolIconMapping.tsx"
  log_info "  ✓ Restored package.json"

  # Remove backup directory
  rm -rf "$backup_dir"
  log_info "  ✓ Removed backup directory"

  return 0
}

# Restore from shipped originals
restore_from_shipped() {
  local repo="$1"

  log_info "Restoring from shipped original files..."

  cp "${ORIGINAL_DIR}/ToolCallWithResponse.tsx" "${repo}/ui/desktop/src/components/ToolCallWithResponse.tsx"
  cp "${ORIGINAL_DIR}/toolIconMapping.tsx" "${repo}/ui/desktop/src/utils/toolIconMapping.tsx"
  cp "${ORIGINAL_DIR}/package.json" "${repo}/ui/desktop/package.json"

  log_info "  ✓ Restored ToolCallWithResponse.tsx"
  log_info "  ✓ Restored toolIconMapping.tsx"
  log_info "  ✓ Restored package.json"
}

# Remove DiffViewer files
remove_diffviewer() {
  local repo="$1"
  local components_dir="${repo}/ui/desktop/src/components"
  local tests_dir="${components_dir}/__tests__"

  log_info "Removing DiffViewer files..."

  if [ -f "${components_dir}/DiffViewer.tsx" ]; then
    rm "${components_dir}/DiffViewer.tsx"
    log_info "  ✓ Removed DiffViewer.tsx"
  else
    log_info "  - DiffViewer.tsx not found (already removed)"
  fi

  if [ -f "${tests_dir}/DiffViewer.test.tsx" ]; then
    rm "${tests_dir}/DiffViewer.test.tsx"
    log_info "  ✓ Removed DiffViewer.test.tsx"
  else
    log_info "  - DiffViewer.test.tsx not found (already removed)"
  fi
}

# Remove diff dependency from package.json
remove_dependency() {
  local repo="$1"
  local pkg_json="${repo}/ui/desktop/package.json"

  log_info "Removing 'diff' dependency from package.json..."

  if grep -q '"diff"' "$pkg_json"; then
    # Remove the line containing "diff": "9.0.0",
    sed -i '/"diff": "9\.0\.0",/d' "$pkg_json"
    log_info "  ✓ Removed diff dependency"
  else
    log_info "  - diff dependency not found (already removed)"
  fi
}

# Reinstall npm dependencies
reinstall_deps() {
  local repo="$1"
  local desktop_dir="${repo}/ui/desktop"

  log_info "Reinstalling npm dependencies..."
  log_info "Running: cd ${desktop_dir} && pnpm install"

  cd "$desktop_dir"
  if pnpm install 2>&1; then
    log_info "  ✓ Dependencies reinstalled successfully"
  else
    log_error "pnpm install failed. You may need to run it manually."
    log_error "  cd ${desktop_dir} && pnpm install"
  fi
}

# Print summary
print_summary() {
  echo ""
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN}  Diff Extension uninstalled successfully!${NC}"
  echo -e "${GREEN}============================================${NC}"
  echo ""
  echo "What was reverted:"
  echo "  • Removed: ui/desktop/src/components/DiffViewer.tsx"
  echo "  • Removed: ui/desktop/src/components/__tests__/DiffViewer.test.tsx"
  echo "  • Restored: ui/desktop/src/components/ToolCallWithResponse.tsx"
  echo "  • Restored: ui/desktop/src/utils/toolIconMapping.tsx"
  echo "  • Restored: ui/desktop/package.json"
  echo ""
  echo "To reinstall:"
  echo "  Run: ./install.sh [path-to-goose-repo]"
  echo ""
}

# Main
main() {
  echo ""
  echo -e "${YELLOW}╔══════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  Goose Diff Extension Uninstaller       ║${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════╝${NC}"
  echo ""

  local repo
  repo=$(find_goose_repo "${1:-}")

  if ! restore_from_backup "$repo"; then
    restore_from_shipped "$repo"
  fi

  remove_diffviewer "$repo"
  remove_dependency "$repo"
  reinstall_deps "$repo"
  print_summary
}

main "$@"
