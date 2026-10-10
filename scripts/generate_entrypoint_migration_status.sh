#!/usr/bin/env bash
# Generates docs/agents/architecture/entrypoint-migration-status.md — a
# scannable table of every entry point tracked in
# arcanum/_lib/migration-status.json (see
# docs/agents/architecture/script-engine.md and
# docs/agents/specs/docker/dispatch.md), its raw docker-readiness status
# (`shell`, `native`, `docker` or `host-only`, printed as-is so a stray
# legacy boolean shows up rather than being hidden) and — where knowable —
# the issue whose commit introduced the key. Native-only commands are
# listed too. Dev tooling, alongside scripts/bump-version.sh
# and scripts/generate_tags_table.sh — NOT a skill script under
# <skill>/scripts/.
#
# Usage:
#   scripts/generate_entrypoint_migration_status.sh
#
# No repo_path argument, deliberately: like generate_tags_table.sh, this
# only ever analyzes arcanum's own git history and migration-status.json,
# never an arbitrary target repo. Self-locates via SCRIPT_DIR, the same
# convention as bump-version.sh/generate_tags_table.sh.
#
# How provenance is resolved:
#   For each command key, the file's own git history (`git log --follow`
#   on arcanum/_lib/migration-status.json, oldest first) is walked to
#   find the first commit whose snapshot of the file already contains
#   that key. That commit's subject is then scanned for a `#<digits>`
#   token (matches both "Fix #227 — ..." merge-commit subjects and
#   "... (issue #227)" specialist-commit subjects). A key with no
#   resolvable introducing commit, or no `#<digits>` token on it, gets a
#   blank issue column rather than a guess.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

STATUS_FILE="${REPO_ROOT}/arcanum/_lib/migration-status.json"
OUTPUT_FILE="${REPO_ROOT}/docs/agents/architecture/entrypoint-migration-status.md"

if [[ ! -f "$STATUS_FILE" ]]; then
  echo "Error: ${STATUS_FILE} not found." >&2
  exit 1
fi

cd "$REPO_ROOT"

# --- Resolve the introducing commit + issue number for a single key ---
issue_for_key() {
  local key="$1"
  local commit content issue=""

  while IFS= read -r commit; do
    content="$(git show "${commit}:arcanum/_lib/migration-status.json" 2>/dev/null || true)"
    [[ -n "$content" ]] || continue

    if jq -e --arg k "$key" 'has($k)' <<< "$content" > /dev/null 2>&1; then
      local subject
      subject="$(git log -1 --format=%s "$commit")"
      if [[ "$subject" =~ \#([0-9]+) ]]; then
        issue="${BASH_REMATCH[1]}"
      fi
      break
    fi
  done < <(git log --follow --format=%H -- arcanum/_lib/migration-status.json | tac)

  printf '%s' "$issue"
}

{
  echo "# Entry Point Migration Status"
  echo
  echo "<!-- AUTO-GENERATED, DO NOT EDIT BY HAND. Run scripts/generate_entrypoint_migration_status.sh to refresh. -->"
  echo
  echo "One row per entry point tracked in [\`arcanum/_lib/migration-status.json\`](../../../arcanum/_lib/migration-status.json) — see [Script Engine](script-engine.md) for the shell → Node.js migration this tracks. \`Status\` is the command's docker-readiness value (\`shell\`, \`native\`, \`docker\` or \`host-only\`; see [Docker-readiness source of truth](../specs/docker/dispatch.md#docker-readiness-source-of-truth)); \`Issue\` is the issue whose commit introduced the key, resolved from the file's own git history where knowable, blank otherwise (never a guess)."
  echo
  echo "Native-only commands (dispatched with \`engine_dispatch --native-only\`, e.g. \`arcanum-check-config\`) have no shell implementation but are listed here too, with a non-\`shell\` status."
  echo
  echo "| Command | Status | Issue |"
  echo "| --- | --- | --- |"

  jq -r 'keys[]' "$STATUS_FILE" | while IFS= read -r key; do
    status="$(jq -r --arg k "$key" '.[$k] | tostring' "$STATUS_FILE")"

    issue="$(issue_for_key "$key")"
    issue_display="-"
    [[ -n "$issue" ]] && issue_display="#${issue}"

    # Literal printf format string, not a shell expansion
    # shellcheck disable=SC2016
    printf '| `%s` | `%s` | %s |\n' "$key" "$status" "$issue_display"
  done
} > "$OUTPUT_FILE"

echo "Wrote $(jq 'keys | length' "$STATUS_FILE") entry point row(s) to ${OUTPUT_FILE#"${REPO_ROOT}"/}."
