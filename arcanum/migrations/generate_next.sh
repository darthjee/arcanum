#!/usr/bin/env bash
# Scaffold the next pending-migration entry under
# arcanum/migrations/repos/next/.
# Usage: generate_next.sh --type script|instructions
#
# Reads repos/next/migrations.json (always present — an empty array
# when nothing is pending yet) and computes the next id, zero-padded to
# 3 digits: "001" if the array is empty, otherwise (highest existing
# "id" across all entries, any type) + 1. Never fills a gap left by a
# deleted/skipped entry. Both types share this single id sequence, not
# a separate counter per type — consistent with the manifest array
# already being the single source of run order.
#
# Appends the new entry to repos/next/migrations.json and creates that
# type's skeleton files in repos/next/, then prints the new id to
# stdout:
#
#   --type script       -> appends
#                           {"id": "<id>", "type": "script",
#                            "file": "<id>.sh", "skippable": true,
#                            "applies_to": "local"}, creates <id>.sh
#                           (config/run skeleton, matching the existing
#                           NNN.sh shape) and <id>.md (empty description
#                           template).
#   --type instructions -> appends
#                           {"id": "<id>", "type": "instructions",
#                            "description_file": "<id>.md",
#                            "instructions_file": "<id>.instructions.md",
#                            "skippable": true, "applies_to": "local"},
#                           creates <id>.md (empty description template)
#                           and <id>.instructions.md (empty AI-
#                           instructions template).
#
# "skippable": true / "applies_to": "local" are scaffolded defaults —
# a placeholder for the author to adjust by hand, same spirit as
# today's script skeleton being a stub to fill in. "applies_to" also
# accepts "repo" or "global" (the latter satisfied once the global,
# cross-project version pointer advances — see
# arcanum/_lib/global_config.sh and docs/guides/arcanum-repo-version.md)
# — this script never validates the value against that enum, it's
# always the author's to set by hand after generation.
#
# Exits 0 on success. Fails (exit 1) if a file it would create already
# exists, rather than silently overwriting it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEXT_DIR="${SCRIPT_DIR}/repos/next"
NEXT_MANIFEST="${NEXT_DIR}/migrations.json"

USAGE="Usage: $0 --type script|instructions"

TYPE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      TYPE="${2:?$USAGE}"
      shift 2
      ;;
    *)
      echo "$USAGE" >&2
      exit 1
      ;;
  esac
done

case "$TYPE" in
  script|instructions) ;;
  *)
    echo "$USAGE" >&2
    exit 1
    ;;
esac

HIGHEST=0
if [[ -f "$NEXT_MANIFEST" ]]; then
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    num=$((10#$id))
    if (( num > HIGHEST )); then
      HIGHEST=$num
    fi
  done < <(jq -r '.[].id' "$NEXT_MANIFEST")
fi

ID="$(printf '%03d' "$((HIGHEST + 1))")"

mkdir -p "$NEXT_DIR"
if [[ ! -f "$NEXT_MANIFEST" ]]; then
  echo "[]" > "$NEXT_MANIFEST"
fi

SKIPPABLE_DEFAULT=true
APPLIES_TO_DEFAULT="local"

DESCRIPTION_FILE="${NEXT_DIR}/${ID}.md"

if [[ "$TYPE" == "script" ]]; then
  SCRIPT_FILE="${NEXT_DIR}/${ID}.sh"

  [[ -e "$SCRIPT_FILE" ]] && { echo "Error: ${SCRIPT_FILE} already exists." >&2; exit 1; }
  [[ -e "$DESCRIPTION_FILE" ]] && { echo "Error: ${DESCRIPTION_FILE} already exists." >&2; exit 1; }

  jq --arg id "$ID" --argjson skippable "$SKIPPABLE_DEFAULT" --arg applies_to "$APPLIES_TO_DEFAULT" \
    '. + [{id: $id, type: "script", file: ($id + ".sh"), skippable: $skippable, applies_to: $applies_to}]' \
    "$NEXT_MANIFEST" > "${NEXT_MANIFEST}.tmp"
  mv "${NEXT_MANIFEST}.tmp" "$NEXT_MANIFEST"

  cat > "$SCRIPT_FILE" <<EOF
#!/usr/bin/env bash
# Migration ${ID} (next): TODO summarize what this migration does.
# See ${ID}.md for a human-readable summary.
#
# Usage: ${ID}.sh config
#        ${ID}.sh run

set -euo pipefail

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

cmd_config() {
  echo '{"skippable": true}'
}

cmd_run() {
  echo "TODO: implement migration ${ID}" >&2
  exit 1
}

case "\${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: \$0 {config|run}" >&2
    exit 1
    ;;
esac
EOF
  chmod +x "$SCRIPT_FILE"

  cat > "$DESCRIPTION_FILE" <<EOF
# Migration ${ID} (next) — TODO title

TODO: describe what this migration does, why it's needed, and whether
it's safe to re-run.
EOF
else
  INSTRUCTIONS_FILE="${NEXT_DIR}/${ID}.instructions.md"

  [[ -e "$DESCRIPTION_FILE" ]] && { echo "Error: ${DESCRIPTION_FILE} already exists." >&2; exit 1; }
  [[ -e "$INSTRUCTIONS_FILE" ]] && { echo "Error: ${INSTRUCTIONS_FILE} already exists." >&2; exit 1; }

  jq --arg id "$ID" --argjson skippable "$SKIPPABLE_DEFAULT" --arg applies_to "$APPLIES_TO_DEFAULT" \
    '. + [{id: $id, type: "instructions", description_file: ($id + ".md"), instructions_file: ($id + ".instructions.md"), skippable: $skippable, applies_to: $applies_to}]' \
    "$NEXT_MANIFEST" > "${NEXT_MANIFEST}.tmp"
  mv "${NEXT_MANIFEST}.tmp" "$NEXT_MANIFEST"

  cat > "$DESCRIPTION_FILE" <<EOF
# Migration ${ID} (next) — TODO title

TODO: describe, for a human reading this at the [R]un/[S]kip/[C]hat
prompt, what this migration does and why it's needed.
EOF

  cat > "$INSTRUCTIONS_FILE" <<EOF
TODO: AI-facing instructions for migration ${ID}. Never printed to the
terminal — only handed to the AI once [R]un is chosen (or under
--no-confirm). Describe the work to perform, precisely enough for the
AI to carry it out autonomously.
EOF
fi

echo "$ID"
