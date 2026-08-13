#!/usr/bin/env bash
# Regression check for scripts/generate_tags_table.sh's parsing/table logic.
# Standalone — following the convention set by
# arcanum/_lib/test_origin_resolution.sh: a plain bash script with a
# fail() helper, exit non-zero on failure, not wired into any skill's flow
# or CI. Run by hand: bash scripts/test_generate_tags_table.sh
#
# Builds small fixture "repos" under a temp dir (each with its own
# scripts/generate_tags_table.sh copy, so the generator's self-locating
# SCRIPT_DIR/REPO_ROOT resolution naturally scopes it to the fixture,
# exactly like the real thing scopes to arcanum's own repo) and asserts:
#   1. A skill with "## Step N —" headings produces "N (<file>.md)".
#   2. A skill with no step headings (mirroring auto-rewrite-issue's shape)
#      produces "(<file>.md)" with no number.
#   3. A prose mention of a verb name with no script path and no args
#      (mirroring open_pr.md's Majora reference) is never matched.
#   4. An entry marked "ignored" in tag-mutations.review.json is excluded
#      from the generated table; an unclassified candidate still appears
#      (fail-open).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATOR="${SCRIPT_DIR}/generate_tags_table.sh"

TMP_DIR=""
cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

build_fixture_repo() {
  local repo="$1"
  mkdir -p "${repo}/scripts" "${repo}/docs/agents"
  cp "$GENERATOR" "${repo}/scripts/generate_tags_table.sh"
  chmod +x "${repo}/scripts/generate_tags_table.sh"
}

TMP_DIR="$(mktemp -d)"
REPO="${TMP_DIR}/fixture-repo"
build_fixture_repo "$REPO"

# --- Fixture 1: skill with "## Step N —" headings ---

mkdir -p "${REPO}/skill-with-steps/steps" "${REPO}/skill-with-steps/scripts"
touch "${REPO}/skill-with-steps/scripts/github.sh"

cat > "${REPO}/skill-with-steps/SKILL.md" <<'EOF'
---
name: skill-with-steps
description: fixture
---

## Step 1 — Do the thing

Read [steps/do_thing.md](steps/do_thing.md) and follow it.

## Step 2 — Something unrelated

Nothing to see here.
EOF

cat > "${REPO}/skill-with-steps/steps/do_thing.md" <<'EOF'
Do the thing.

```bash
scripts/github.sh add-tag "$REPO_PATH" <id> fetched
```
EOF

# --- Fixture 2: skill with no step headings (mirrors auto-rewrite-issue) ---

mkdir -p "${REPO}/skill-no-steps/steps" "${REPO}/skill-no-steps/scripts"
touch "${REPO}/skill-no-steps/scripts/github.sh"

cat > "${REPO}/skill-no-steps/SKILL.md" <<'EOF'
---
name: skill-no-steps
description: fixture
---

You are the coordinator. Delegate to the architect agent.

Spawn:

> Agent(subagent_type: "architect", prompt: "Read steps/run.md and follow it.")
EOF

cat > "${REPO}/skill-no-steps/steps/run.md" <<'EOF'
Drain the queue.

```bash
scripts/github.sh remove-tag "$REPO_PATH" <id> created
```
EOF

# --- Fixture 3: bare prose mention of a verb name, no script path/args ---

mkdir -p "${REPO}/skill-false-positive/steps"

cat > "${REPO}/skill-false-positive/SKILL.md" <<'EOF'
---
name: skill-false-positive
description: fixture
---

## Step 1 — Only step

Read [steps/only.md](steps/only.md) and follow it.
EOF

cat > "${REPO}/skill-false-positive/steps/only.md" <<'EOF'
This skill never replicates the metadata-file tracking used by an unrelated
system's `draft-pr`/`add-tag` (no equivalent state file here).
EOF

# --- Run 1: default mode, no review.json yet ---

OUTPUT_1="$("${REPO}/scripts/generate_tags_table.sh" 2>&1)" \
  || fail "generator exited non-zero on first run: ${OUTPUT_1}"

TABLE="${REPO}/docs/agents/tag-mutations.md"
[[ -f "$TABLE" ]] || fail "expected ${TABLE} to be written"

# Assertion 1: numbered step rendering.
grep -qF '1 (do_thing.md)' "$TABLE" \
  || fail "expected '1 (do_thing.md)' step rendering in table, got:\n$(cat "$TABLE")"

# Assertion 2: step-less rendering (no leading number).
grep -qF '| (run.md) |' "$TABLE" \
  || fail "expected '(run.md)' (no step number) rendering in table, got:\n$(cat "$TABLE")"

# Assertion 3: bare verb-name prose mention never matched.
grep -q 'skill-false-positive' "$TABLE" \
  && fail "expected no row for skill-false-positive (bare prose mention should never match), got:\n$(cat "$TABLE")"

echo "OK: numbered step, step-less step, and bare-prose-mention exclusion all render correctly"

# --- Run 2: mark the skill-with-steps candidate as "ignored" via review.json ---

REVIEW_JSON="${REPO}/docs/agents/tag-mutations.review.json"
cat > "$REVIEW_JSON" <<'EOF'
{
  "reviewed": [
    {
      "skill": "skill-with-steps",
      "step_file": "do_thing.md",
      "match": "scripts/github.sh add-tag \"$REPO_PATH\" <id> fetched",
      "status": "ignored",
      "reason": "test fixture — asserting exclusion"
    }
  ]
}
EOF

OUTPUT_2="$("${REPO}/scripts/generate_tags_table.sh" 2>&1)" \
  || fail "generator exited non-zero on second run: ${OUTPUT_2}"

grep -qF '1 (do_thing.md)' "$TABLE" \
  && fail "expected the 'ignored' candidate to be excluded from the table, got:\n$(cat "$TABLE")"

# The unclassified skill-no-steps candidate must still appear (fail-open).
grep -qF '| (run.md) |' "$TABLE" \
  || fail "expected the unclassified candidate to still appear (fail-open), got:\n$(cat "$TABLE")"

echo "OK: an 'ignored' review.json entry excludes its candidate; an unclassified candidate still appears (fail-open)"

echo "PASS: scripts/generate_tags_table.sh's parsing/table/review-json logic behaves as expected"
exit 0
