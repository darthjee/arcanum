#!/usr/bin/env bash
# Stamp this arcanum install's version into the repo being configured by
# init-claude, so arcanum/migrations/run.sh (used by /arcanum-migrate)
# can later tell which per-repo migrations are pending.
# Usage: stamp_arcanum_version.sh
#   Run from the target project root (the repo being configured), with
#   this script resolved relative to the init-claude skill folder
#   (i.e. the arcanum install this skill lives inside).
#
# Resolves the current arcanum install's version the same way
# arcanum-update/scripts/run_update.sh's resolve_target/current_version
# do (arcanum.json for a zip install, exact git tag for a git-clone
# install), relative to this script's own location
# (<script_dir>/../.. — the install this skill lives inside). If the
# version can't be resolved as valid semver (e.g. a git clone install
# not checked out on a release tag), this is a silent no-op — always
# exits 0, never blocks init-claude.
#
# On success, writes .version in
# .claude/configuration/arcanum-repo-config.json (relative to the
# current working directory — the repo being configured, not the
# arcanum install), via arcanum/_lib/repo_config.sh's
# repo_config_set_version.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"

# shellcheck source=../../arcanum/_lib/repo_config.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/repo_config.sh"

VERSION=""
if [[ -f "${INSTALL_ROOT}/arcanum.json" ]]; then
  VERSION="$(jq -r '.version // empty' "${INSTALL_ROOT}/arcanum.json" 2>/dev/null || true)"
elif [[ -d "${INSTALL_ROOT}/.git" ]]; then
  VERSION="$(git -C "$INSTALL_ROOT" describe --tags --exact-match 2>/dev/null || true)"
fi

if [[ -n "$VERSION" ]] && [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  repo_config_set_version "$CONFIG_FILE" "$VERSION"
fi

exit 0
