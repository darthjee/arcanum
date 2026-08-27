#!/usr/bin/env bash
# Create a brand-new GitHub issue on demand ("spawn" it) from a scratch
# body file, with a label set safely derived (allow-list) from a parent
# issue, tag it with the permanent `Spawned` label, and link it back to
# the parent — always via a lightweight comment cross-reference, and
# optionally as a formal native GitHub sub-issue.
#
# Usage: spawn_issue.sh <repo_path> <parent_id> <title> <body_file> [--as-subissue]
#
# <body_file> is passed straight through to github_issue.sh's existing
# `create <repo_path> <title> <file>`, which writes its own scratch copy
# to docs/agents/issues/<id>-slug.md purely as create-call input — this
# script deletes THAT file (not the caller-supplied <body_file>, which
# remains the caller's own responsibility) once every step below
# succeeds, so nothing survives locally to be accidentally committed.
#
# Operation order: create (retried) -> fetch/apply labels (best-effort)
# -> linking/comments (best-effort) -> delete scratch file. Everything
# after the create call is best-effort: a failure there logs a warning
# to stderr but does not fail the whole call, since the primary outcome
# (the issue exists on GitHub) has already been achieved.
#
#   1. Create: calls github_issue.sh create <repo_path> <title>
#      <body_file>, wrapped in a retry loop (max-retry-count/
#      error-sleep-time read via config_chain.sh's config_chain_read from
#      the "plan-issues" namespace — local state, then repo config, then
#      global config — default 5 retries / 5s sleep). On exhausted
#      retries: prints STATUS=failed, exits 1 (nothing to clean up — the
#      create command only writes its scratch file on a successful
#      call).
#   2. Labels: fetches <parent_id>'s current labels, strips any label
#      that maps to a canonical pipeline tag (tags.sh's _tag_for_label),
#      keeps everything else, then always adds Spawned. Applied via
#      `gh issue edit --add-label`. If the parent lookup itself fails,
#      falls back to applying just Spawned alone.
#   3. Linking back: always posts a comment on the parent
#      ("Spawned issue #<new_id>: <title>") and on the new issue
#      ("Spawned from #<parent_id>"). With --as-subissue, additionally
#      runs the addSubIssue GraphQL mutation to link the new issue as a
#      native GitHub sub-issue of the parent, with a "created but not
#      linked; link it manually on GitHub" warning fallback.
#   4. Cleanup: removes the scratch file written by step 1. On failure,
#      prints a *loud* warning (an un-removed file under
#      docs/agents/issues/ is exactly the failure mode this script
#      exists to prevent) but still exits 0 — the issue itself was
#      created successfully.
#
# On success prints:
#   STATUS=ok
#   ID=<new_id>
#   URL=<url>
# and exits 0. On failure (create exhausts its retry budget) prints:
#   STATUS=failed
# and exits 1.

set -euo pipefail

REPO_PATH="${1:-}"
PARENT_ID="${2:-}"
TITLE="${3:-}"
BODY_FILE="${4:-}"

[[ -n "$REPO_PATH" && -n "$PARENT_ID" && -n "$TITLE" && -n "$BODY_FILE" ]] || {
  echo "Usage: $0 <repo_path> <parent_id> <title> <body_file> [--as-subissue]" >&2
  exit 1
}

AS_SUBISSUE=0
if [[ "${5:-}" == "--as-subissue" ]]; then
  AS_SUBISSUE=1
elif [[ -n "${5:-}" ]]; then
  echo "Usage: $0 <repo_path> <parent_id> <title> <body_file> [--as-subissue]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=repo_path.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/repo_path.sh"
# shellcheck source=origin.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/origin.sh"
# shellcheck source=config_chain.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/config_chain.sh"
# shellcheck source=tags.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/tags.sh"

repo_path_enter "$REPO_PATH"

[[ -f "$BODY_FILE" ]] || { echo "Error: file not found: $BODY_FILE" >&2; exit 1; }

_load_origin "$REPO_PATH"
repo_ref="$_ORIGIN_REPO_PATH"
domain="$_ORIGIN_DOMAIN"

# --- Retry config ---

max_retry=$(config_chain_read "$REPO_PATH" "plan-issues" "max-retry-count")
max_retry="${max_retry//\"/}"
[[ -n "$max_retry" ]] || max_retry=5

error_sleep=$(config_chain_read "$REPO_PATH" "plan-issues" "error-sleep-time")
error_sleep="${error_sleep//\"/}"
[[ -n "$error_sleep" ]] || error_sleep=5

# --- Retry loop around github_issue.sh create ---

new_id=""
new_file=""
attempt=0
success=0
while (( attempt < max_retry )); do
  attempt=$((attempt + 1))
  echo "Spawning issue from #${PARENT_ID}: ${TITLE} (attempt ${attempt}/${max_retry})"

  err_output=""
  if create_output=$("${SCRIPT_DIR}/github_issue.sh" create "$REPO_PATH" "$TITLE" "$BODY_FILE" 2>/tmp/spawn_issue.err.$$); then
    rm -f /tmp/spawn_issue.err.$$
    new_id=$(grep '^ID=' <<< "$create_output" | head -1 | cut -d= -f2-)
    new_file=$(grep '^FILE=' <<< "$create_output" | head -1 | cut -d= -f2-)
    success=1
    break
  else
    err_output=$(cat /tmp/spawn_issue.err.$$ 2>/dev/null || true)
    rm -f /tmp/spawn_issue.err.$$
    echo "Warning: github_issue.sh create failed (attempt ${attempt}/${max_retry}): ${err_output}" >&2
    if (( attempt < max_retry )); then
      sleep "$error_sleep"
    fi
  fi
done

if [[ "$success" -ne 1 ]]; then
  echo "STATUS=failed"
  exit 1
fi

# --- Labels (best-effort): parent's labels, pipeline tags stripped, plus Spawned ---

labels_to_apply=()

parent_labels=""
if parent_labels=$(gh issue view "$PARENT_ID" -R "$repo_ref" --json labels -q '.labels[].name' 2>/tmp/spawn_issue.labels.err.$$); then
  rm -f /tmp/spawn_issue.labels.err.$$
  while IFS= read -r label; do
    [[ -n "$label" ]] || continue
    tag=$(_tag_for_label "$label")
    [[ -z "$tag" ]] && labels_to_apply+=("$label")
  done <<< "$parent_labels"
else
  labels_err=$(cat /tmp/spawn_issue.labels.err.$$ 2>/dev/null || true)
  rm -f /tmp/spawn_issue.labels.err.$$
  echo "Warning: could not fetch labels from parent issue #${PARENT_ID} on ${repo_ref}: ${labels_err} — applying only 'Spawned'" >&2
fi

labels_to_apply+=("Spawned")

label_args=()
for label in "${labels_to_apply[@]}"; do
  label_args+=(--add-label "$label")
done

gh issue edit "$new_id" -R "$repo_ref" "${label_args[@]}" >/dev/null 2>&1 \
  || echo "Warning: could not apply labels to issue #${new_id} on ${repo_ref}" >&2

# --- Linking back (best-effort) ---

gh issue comment "$PARENT_ID" -R "$repo_ref" --body "Spawned issue #${new_id}: ${TITLE}" >/dev/null 2>&1 \
  || echo "Warning: could not comment on parent issue #${PARENT_ID} on ${repo_ref}" >&2

gh issue comment "$new_id" -R "$repo_ref" --body "Spawned from #${PARENT_ID}" >/dev/null 2>&1 \
  || echo "Warning: could not comment on issue #${new_id} on ${repo_ref}" >&2

if [[ "$AS_SUBISSUE" -eq 1 ]]; then
  parent_node_id=$(gh issue view "$PARENT_ID" -R "$repo_ref" --json id -q .id 2>/dev/null || true)
  sub_node_id=$(gh issue view "$new_id" -R "$repo_ref" --json id -q .id 2>/dev/null || true)

  if [[ -n "$parent_node_id" && -n "$sub_node_id" ]] && gh api graphql -f query='mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(input:{issueId:$issueId,subIssueId:$subIssueId}){subIssue{id}}}' -F issueId="$parent_node_id" -F subIssueId="$sub_node_id" >/dev/null 2>&1; then
    :
  else
    echo "Warning: could not link issue #${new_id} as a native sub-issue of #${PARENT_ID} — created but not linked; link it manually on GitHub" >&2
  fi
fi

# --- Cleanup: delete the scratch file created by github_issue.sh create ---

if [[ -n "$new_file" ]]; then
  if ! rm -f "$new_file" 2>/tmp/spawn_issue.rm.err.$$; then
    rm_err=$(cat /tmp/spawn_issue.rm.err.$$ 2>/dev/null || true)
    rm -f /tmp/spawn_issue.rm.err.$$
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >&2
    echo "WARNING: failed to delete scratch file '${new_file}': ${rm_err}" >&2
    echo "This file must NOT be committed — delete it manually right away." >&2
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >&2
  fi
fi

url="https://${domain}/${repo_ref}/issues/${new_id}"

echo "STATUS=ok"
echo "ID=$new_id"
echo "URL=$url"
