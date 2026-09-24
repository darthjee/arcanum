#!/usr/bin/env bash
# Thin engine_dispatch shim for the "init-claude-write-label-config-replace",
# "init-claude-write-label-config-remove" and
# "init-claude-write-label-config-add" migrated entrypoints (one command
# name per subcommand) — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/594-migrate-init-claude-label-commands-write-label-config-sync-labels-to-native-node-js/plan.md
# for the full design/shared contracts. Runs either the per-subcommand
# shell implementation (write_label_config_<sub>_shell.sh) or the native
# one (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Like monitor-issues/scripts/config.sh, this entrypoint never took a
# <repo_path> argument: it is run from the target project root. The
# literal "$PWD" (NOT `git rev-parse --show-toplevel`, which would break
# parity when run from a subdirectory or a non-git dir) is passed as
# engine_dispatch's <repo_path> with --prepend-repo-path, so only the
# native invocation receives it as its leading positional (the
# Dispatcher strips it into RepoContext.repoPath; native code never
# reads process.cwd() — see docs/agents/architecture/repo-path-threading.md),
# while the shell implementation's own args stay untouched.
#
# <config_path> is made absolute against $PWD here (left as-is when it
# already starts with '/'), so both implementations receive the same
# absolute path (issue #594).
#
# No env vars are forwarded to the native path's allowlist — this
# entrypoint only reads/writes the label-config file.
#
# All usage/arity validation below lives here, before engine_dispatch,
# so usage errors (usage block on stderr, exit 2) are identical in both
# modes and never reach either implementation.
#
# Mutate a label-config JSON file via one of three subcommands.
# Usage:
#   write_label_config.sh replace <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
#   write_label_config.sh remove  <config_path> <Label1> [<Label2> ...]
#   write_label_config.sh add     <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
#
#   config_path is mandatory (no default) for every subcommand.
#
#   replace: requires at least one <name>:<color> pair. Validates every
#     pair before writing anything; on the first invalid pair, prints a
#     usage-style error to stderr and exits 2 without touching the file.
#     On success, replaces the config's whole "labels" array with exactly
#     the given pairs (atomically) and exits 0.
#
#   remove: requires at least one bare <Label> name (no ":color" suffix —
#     any argument containing a ':' is rejected as a usage error, exit 2,
#     without touching the file). Removes entries matching the given names
#     from the config's "labels" array (names not currently present are
#     silently ignored); a missing/empty config is a no-op that still
#     succeeds. Writes the remaining array back (even if it ends up empty)
#     and exits 0.
#
#   add: requires at least one <name>:<color> pair, validated the same way
#     `replace` validates pairs (first invalid pair rejects before writing
#     anything, exit 2). Upserts each pair into the config's "labels" array
#     by name: replaces the color if the name already exists (preserving
#     its position), appends it if it's new. A missing/empty config starts
#     from an empty array. Writes the merged array back and exits 0.
#
# Each pair is <label name>:<hex color>, color without a leading '#' (e.g.
# Bug:b60205). See lib/label_config.sh for the JSON schema and the
# underlying label_config_write/label_config_remove/label_config_add
# functions. An unknown or missing subcommand is a usage error, exit 2.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

usage() {
  echo "Usage: $0 replace <config_path> <Label1>:<color1> [<Label2>:<color2> ...]" >&2
  echo "       $0 remove  <config_path> <Label1> [<Label2> ...]" >&2
  echo "       $0 add     <config_path> <Label1>:<color1> [<Label2>:<color2> ...]" >&2
  echo "  Each pair is <label name>:<hex color>, color without a leading '#' (e.g. Bug:b60205)." >&2
  exit 2
}

SUBCOMMAND="${1:-}"
case "$SUBCOMMAND" in
  replace|remove|add)
    ;;
  *)
    usage
    ;;
esac
shift

CONFIG_PATH="${1:-}"
[[ -n "$CONFIG_PATH" ]] || usage
shift

[[ $# -ge 1 ]] || usage

if [[ "$CONFIG_PATH" == /* ]]; then
  ABS_CONFIG_PATH="$CONFIG_PATH"
else
  ABS_CONFIG_PATH="$PWD/$CONFIG_PATH"
fi

REPO_PATH="$PWD"

engine_dispatch "$REPO_PATH" "init-claude-write-label-config-${SUBCOMMAND}" "${SCRIPT_DIR}/write_label_config_${SUBCOMMAND}_shell.sh" --prepend-repo-path -- "$ABS_CONFIG_PATH" "$@"
