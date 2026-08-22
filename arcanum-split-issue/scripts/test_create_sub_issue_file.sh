#!/usr/bin/env bash
# Regression check for arcanum-split-issue/scripts/create_sub_issue_file.sh's
# sub-issue file naming/counting logic: fresh id starts at count 01,
# subsequent calls increment, out-of-band files are picked up, and gaps
# left by deleted files are never filled (mirrors
# arcanum/migrations/generate_next.sh's "never fills a gap" behavior).
#
# Usage: bash arcanum-split-issue/scripts/test_create_sub_issue_file.sh  (no arguments)
# Standalone — not wired into any skill's flow. Exit 0 on success, non-zero
# with a message on stderr on failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREATE_SUB_ISSUE_FILE="${SCRIPT_DIR}/create_sub_issue_file_shell.sh"

TMP_DIR=""
cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

TMP_DIR="$(mktemp -d)"
git -C "$TMP_DIR" init -q

ISSUE_ID="999"
ISSUES_DIR="${TMP_DIR}/docs/agents/issues"
BODY_FILE="${TMP_DIR}/body.md"
: > "$BODY_FILE"

# --- Assertion 1: fresh id, no existing files -> count 01 ---

OUTPUT=$("$CREATE_SUB_ISSUE_FILE" "$TMP_DIR" "$ISSUE_ID" "First Sub Issue" "$BODY_FILE") \
  || fail "create_sub_issue_file.sh exited non-zero on the first call"

FILE_LINE=$(printf '%s\n' "$OUTPUT" | grep '^FILE=' || true)
[[ -n "$FILE_LINE" ]] || fail "no FILE= line printed on the first call"

REL_FILE="${FILE_LINE#FILE=}"
[[ "$REL_FILE" == "docs/agents/issues/999_01_first_sub_issue.md" ]] \
  || fail "expected count 01 on the first call, got: $REL_FILE"

[[ -f "${TMP_DIR}/${REL_FILE}" ]] || fail "expected file does not exist on disk: ${TMP_DIR}/${REL_FILE}"
grep -q '^# First Sub Issue$' "${TMP_DIR}/${REL_FILE}" || fail "expected file to start with '# First Sub Issue'"

echo "OK: fresh id produces count 01 (${REL_FILE})"

# --- Assertion 2: second call, different title -> count 02 ---

OUTPUT=$("$CREATE_SUB_ISSUE_FILE" "$TMP_DIR" "$ISSUE_ID" "Second Sub Issue" "$BODY_FILE") \
  || fail "create_sub_issue_file.sh exited non-zero on the second call"

REL_FILE=$(printf '%s\n' "$OUTPUT" | grep '^FILE=' | sed 's/^FILE=//')
[[ "$REL_FILE" == "docs/agents/issues/999_02_second_sub_issue.md" ]] \
  || fail "expected count 02 on the second call, got: $REL_FILE"

echo "OK: second call increments to count 02 (${REL_FILE})"

# --- Assertion 3: manually-created out-of-band file -> next count is 04 ---

touch "${ISSUES_DIR}/999_03_manual.md"

OUTPUT=$("$CREATE_SUB_ISSUE_FILE" "$TMP_DIR" "$ISSUE_ID" "Fourth Sub Issue" "$BODY_FILE") \
  || fail "create_sub_issue_file.sh exited non-zero on the third call"

REL_FILE=$(printf '%s\n' "$OUTPUT" | grep '^FILE=' | sed 's/^FILE=//')
[[ "$REL_FILE" == "docs/agents/issues/999_04_fourth_sub_issue.md" ]] \
  || fail "expected count 04 after a manually-created 999_03_manual.md, got: $REL_FILE"

echo "OK: an out-of-band 999_03_manual.md file is picked up, next count is 04 (${REL_FILE})"

# --- Assertion 4: deleting 999_02_... leaves a gap -> next count is 05, not 02 ---

rm -f "${ISSUES_DIR}/999_02_second_sub_issue.md"

OUTPUT=$("$CREATE_SUB_ISSUE_FILE" "$TMP_DIR" "$ISSUE_ID" "Fifth Sub Issue" "$BODY_FILE") \
  || fail "create_sub_issue_file.sh exited non-zero on the fourth call"

REL_FILE=$(printf '%s\n' "$OUTPUT" | grep '^FILE=' | sed 's/^FILE=//')
[[ "$REL_FILE" == "docs/agents/issues/999_05_fifth_sub_issue.md" ]] \
  || fail "expected count 05 (gap-tolerant, never fills the deleted 02 slot), got: $REL_FILE"

echo "OK: deleting 999_02_... leaves a gap that is never filled, next count is 05 (${REL_FILE})"

# --- Assertion 5: snake_case title transformation ---

OUTPUT=$("$CREATE_SUB_ISSUE_FILE" "$TMP_DIR" "$ISSUE_ID" "Hello, World! Foo-Bar" "$BODY_FILE") \
  || fail "create_sub_issue_file.sh exited non-zero on the snake_case assertion call"

REL_FILE=$(printf '%s\n' "$OUTPUT" | grep '^FILE=' | sed 's/^FILE=//')
case "$REL_FILE" in
  *hello_world_foo_bar*) ;;
  *) fail "expected filename to contain 'hello_world_foo_bar', got: $REL_FILE" ;;
esac

echo "OK: snake_case title transformation produces 'hello_world_foo_bar' (${REL_FILE})"

echo "PASS: arcanum-split-issue/scripts/create_sub_issue_file.sh sub-issue file naming/counting logic"
exit 0
