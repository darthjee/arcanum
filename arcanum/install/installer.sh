#!/usr/bin/env bash
# Installer stage — ships inside the release zip (and alongside
# bootstrap.sh in a full git clone). Prompts for a target directory,
# places the unzipped release tree there, and writes arcanum.json
# (version/repo/manifest) so a later arcanum/update/bootstrap.sh run can
# reconcile the install against a newer release.
#
# Not meant to be curl | bash'd directly: bootstrap.sh execs this from
# inside the unzipped release tree, so relative paths resolve correctly.
# Requires REPO/VERSION to be set in the environment (bootstrap.sh
# exports both before exec'ing here) and jq to be installed.
#
# As its last step, once arcanum.json is written, it runs the arcanum-cli
# client step through arcanum/_lib/install_cli.sh, pinned to VERSION (see
# docs/agents/architecture/cli-install.md, "Callers" -> "Installer"). That
# step asks a [Y/n] prompt on the TTY and never fails the arcanum install.
#
# Environment:
#   ARCANUM_SKIP_CLI    — any non-empty value skips the client step.
#   ARCANUM_TTY_DEVICE  — TEST-ONLY: device/file read instead of /dev/tty.
#
# Usage: arcanum/install/installer.sh   (no arguments)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

: "${REPO:?REPO must be set (exported by bootstrap.sh)}"
: "${VERSION:?VERSION must be set (exported by bootstrap.sh)}"

DEFAULT_TARGET="${HOME}/.claude/skills"

# TEST-ONLY override of the TTY device (same seam as arcanum/_lib/install_cli.sh).
TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"

expand_path() {
  local path="$1"
  # The literal "~" / "~/" prefixes are matched on purpose (read does not
  # tilde-expand user input).
  # shellcheck disable=SC2088
  case "$path" in
    "~") echo "$HOME" ;;
    "~/"*) echo "${HOME}/${path#\~/}" ;;
    *) echo "$path" ;;
  esac
}

echo "Where should arcanum be installed?" >&2
echo "  Press Enter to use the default (${DEFAULT_TARGET})," >&2
echo "  or type '.' for the current folder, or a custom path." >&2
printf "Target directory [%s]: " "$DEFAULT_TARGET" >&2
read -r input < "$TTY_DEVICE"

if [[ -z "$input" ]]; then
  TARGET="$DEFAULT_TARGET"
else
  TARGET="$(expand_path "$input")"
fi

if [[ "$TARGET" != "$DEFAULT_TARGET" ]]; then
  echo "You chose: ${TARGET}" >&2
  printf "Press Enter to confirm, or anything else to abort: " >&2
  read -r confirm < "$TTY_DEVICE"
  if [[ -n "$confirm" ]]; then
    echo "Aborted: installation not confirmed." >&2
    exit 1
  fi
fi

if [[ -f "${TARGET}/arcanum.json" ]]; then
  echo "Error: an arcanum install already exists at ${TARGET}." >&2
  echo "Run the update script instead: bash ${TARGET}/arcanum/update/bootstrap.sh" >&2
  exit 1
fi

mkdir -p "$TARGET"
cp -R "${RELEASE_ROOT}/." "$TARGET/"

MANIFEST_JSON="$(jq -R . "${RELEASE_ROOT}/MANIFEST" | jq -s .)"
jq -n --arg version "$VERSION" --arg repo "$REPO" --argjson manifest "$MANIFEST_JSON" \
  '{version: $version, repo: $repo, manifest: $manifest}' > "${TARGET}/arcanum.json"

echo "arcanum installed to ${TARGET}" >&2

# Client step (docs/agents/architecture/cli-install.md, "Callers" ->
# "Installer"): installs or updates arcanum-cli@$VERSION. Never fails the install: install_cli.sh
# exits 0 on every outcome, `|| true` covers a usage error, and
# ARCANUM_CLI_PROMPT is cleared because the installer has no chat to
# fall back to (no exit 4 / FALLBACK=chat).
ARCANUM_CLI_PROMPT='' "${SCRIPT_DIR}/../_lib/install_cli.sh" "$VERSION" || true
