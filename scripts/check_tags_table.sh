#!/usr/bin/env bash
# CI backstop for docs/agents/tag-mutations.md staleness. Dev tooling, run
# from the `build-and-release` CircleCI job (tag-push only) — NOT a skill
# script under <skill>/scripts/.
#
# Regenerates the table to a temp path via scripts/generate_tags_table.sh
# (default, non-interactive mode) and diffs it against the checked-in
# docs/agents/tag-mutations.md.
#
#   - Match: exit 0, silent.
#   - ARCANUM_SKIP_TAG_TABLE_CHECK set: skip the diff, print a loud notice
#     that the check was bypassed via the env var, exit 0.
#   - Mismatch: file (or update, deduped by the "Automated" label + exact
#     title match) a GitHub issue about it via curl + GH_TOKEN (same
#     REST-API convention as scripts/upload_release_asset.sh), print the
#     skip-var instructions, and exit 0 either way — this step must never
#     fail the CI job or block a release.
#
# Required env for the issue-filing path (only reached on mismatch):
#   GH_TOKEN — same token the job already uses for the release/upload steps.
# Optional env:
#   CIRCLE_BUILD_URL — linked in the filed/updated issue body, if set.
#
# Usage: scripts/check_tags_table.sh   (no arguments)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

OWNER_REPO="darthjee/arcanum"
API="https://api.github.com/repos/${OWNER_REPO}"
CHECKED_IN_TABLE="${REPO_ROOT}/docs/agents/tag-mutations.md"
ISSUE_TITLE="docs/agents/tag-mutations.md is out of date"

if [[ -n "${ARCANUM_SKIP_TAG_TABLE_CHECK:-}" ]]; then
  echo "############################################################"
  echo "# WARNING: docs/agents/tag-mutations.md staleness check was"
  echo "# SKIPPED because ARCANUM_SKIP_TAG_TABLE_CHECK is set."
  echo "# Unset it to re-enable this check."
  echo "############################################################"
  exit 0
fi

ORIGINAL_TABLE="$(mktemp)"
FRESH_TABLE="$(mktemp)"
cleanup() {
  # Always restore the checked-in file exactly as it was — this check must
  # never leave a side effect on the working tree, checked out fresh in CI
  # or not.
  [[ -f "$ORIGINAL_TABLE" ]] && cp "$ORIGINAL_TABLE" "$CHECKED_IN_TABLE" 2>/dev/null
  rm -f "$ORIGINAL_TABLE" "$FRESH_TABLE"
}
trap cleanup EXIT

cp "$CHECKED_IN_TABLE" "$ORIGINAL_TABLE" 2>/dev/null || true

if ! "${SCRIPT_DIR}/generate_tags_table.sh" > /dev/null; then
  echo "Warning: scripts/generate_tags_table.sh failed to run — cannot verify docs/agents/tag-mutations.md is current. Not blocking the release." >&2
  exit 0
fi
cp "$CHECKED_IN_TABLE" "$FRESH_TABLE"

DIFF_OUTPUT="$(diff -u "$ORIGINAL_TABLE" "$FRESH_TABLE" 2>&1 || true)"

if [[ -z "$DIFF_OUTPUT" ]]; then
  exit 0
fi

echo "docs/agents/tag-mutations.md is out of date. Diff:" >&2
echo "$DIFF_OUTPUT" >&2
echo "Run 'scripts/generate_tags_table.sh' and commit the result." >&2
echo "To bypass this check (not recommended), set ARCANUM_SKIP_TAG_TABLE_CHECK." >&2

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Warning: GH_TOKEN not set — cannot file/update the staleness issue. Not blocking the release." >&2
  exit 0
fi

auth_curl() {
  curl -s -u "x-access-token:${GH_TOKEN}" -H "Accept: application/vnd.github+json" "$@"
}

BUILD_LINK=""
[[ -n "${CIRCLE_BUILD_URL:-}" ]] && BUILD_LINK="Build: ${CIRCLE_BUILD_URL}"

ISSUE_BODY=$(cat <<EOF
docs/agents/tag-mutations.md no longer matches the output of \`scripts/generate_tags_table.sh\` at release time. This does not block the release, but the checked-in table is stale — run \`scripts/generate_tags_table.sh\` and commit the result.

${BUILD_LINK}

<details>
<summary>Diff</summary>

\`\`\`diff
${DIFF_OUTPUT}
\`\`\`

</details>
EOF
)

EXISTING_ISSUE_NUMBER="$(
  auth_curl "${API}/issues?labels=Automated&state=open" \
    | jq -r --arg title "$ISSUE_TITLE" '[.[] | select(.title == $title)] | .[0].number // empty'
)"

if [[ -n "$EXISTING_ISSUE_NUMBER" ]]; then
  echo "Updating existing staleness issue #${EXISTING_ISSUE_NUMBER}." >&2
  PAYLOAD="$(jq -n --arg body "$ISSUE_BODY" '{"body": $body}')"
  auth_curl -X PATCH -H "Content-Type: application/json" -d "$PAYLOAD" \
    "${API}/issues/${EXISTING_ISSUE_NUMBER}" > /dev/null
else
  echo "Filing a new staleness issue." >&2
  PAYLOAD="$(jq -n --arg title "$ISSUE_TITLE" --arg body "$ISSUE_BODY" \
    '{"title": $title, "body": $body, "labels": ["Automated"]}')"
  auth_curl -X POST -H "Content-Type: application/json" -d "$PAYLOAD" \
    "${API}/issues" > /dev/null
fi

# Never fail the build over a stale table — this is a backstop, not a gate.
exit 0
