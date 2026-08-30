# Thin engine_dispatch shim for the "permission-grant-add" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/236-migrate-permission-grant-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Appends a Bash-permission
# allowlist pattern into a Claude Code native settings file, via either
# the shell implementation (permission_grant_shell.sh) or the native
# one (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Used by:
#   - the local/repo/global `shipit`-merge-exemption migrations
#     (arcanum/migrations/repos/next/*.sh) — see issue #170. These
#     `source` this file for its `permission_grant_add` function (kept
#     working unchanged as pure shell, via the unconditional `source`
#     of permission_grant_shell.sh below) and call it directly,
#     in-process — never through engine_dispatch/native.
#   - init-claude/setup_permissions.md's onboarding step, which calls
#     this file's own CLI dispatcher directly (below), since it runs
#     as an agent issuing Bash-tool commands rather than a script that
#     can `source` a lib. Only THIS direct-invocation CLI path is
#     engine_dispatch-routed.
#
# Direct-invocation CLI usage:
#   permission_grant.sh <anchor> add <file> <pattern>
#   <anchor> — absolute path to the repo root the Claude config is
#              anchored at; forwarded to engine_dispatch and into the
#              native passthrough args. The `add` verb is consumed by
#              this file's `case` dispatcher and is NOT forwarded.
#              <file> may be repo-relative.
#
# This file is meant to be SOURCED for its `permission_grant_add`
# function (re-exported from permission_grant_shell.sh, unchanged); the
# CLI dispatcher at the bottom is a secondary, direct-invocation
# convenience that is engine_dispatch-routed.
#
# Purely filesystem-based — no environment dependency, so no extra
# env-var allowlist entries (beyond PATH, which engine_dispatch always
# includes) are needed for the native path.

_PERMISSION_GRANT_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=permission_grant_shell.sh
source "${_PERMISSION_GRANT_LIB_DIR}/permission_grant_shell.sh"

# Direct-invocation CLI dispatcher: `permission_grant.sh <anchor> add <file> <pattern>`.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  anchor="${1:-}"
  if [[ -z "$anchor" ]]; then
    echo "Usage: $0 <anchor> add <file> <pattern>" >&2
    exit 1
  fi
  shift
  case "${1:-}" in
    add)
      shift
      # shellcheck source=engine_dispatch.sh
      # shellcheck disable=SC1091
      source "${_PERMISSION_GRANT_LIB_DIR}/engine_dispatch.sh"
      engine_dispatch "$anchor" permission-grant-add "${_PERMISSION_GRANT_LIB_DIR}/permission_grant_shell.sh" -- "$anchor" "$@"
      ;;
    *)
      echo "Usage: $0 <anchor> add <file> <pattern>" >&2
      exit 1
      ;;
  esac
fi
