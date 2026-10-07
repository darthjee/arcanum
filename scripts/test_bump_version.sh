#!/usr/bin/env bash
# Regression check for scripts/bump-version.sh's migration-reference guard
# and rewrite. Standalone — following the convention set by
# scripts/test_generate_tags_table.sh: a plain bash script with a fail()
# helper, exit non-zero on failure, not wired into CI. Run by hand:
#   bash scripts/test_bump_version.sh
#
# Builds fixture "repos" under a temp dir (each with its own
# scripts/bump-version.sh copy, so the script's self-locating REPO_ROOT
# scopes it to the fixture; the two generator scripts are stubbed as
# no-ops) and bumps each to 1.1.0, asserting:
#   1. Rewrite: in-scope repos/next/NNN references (core/spec, docs,
#      README.md) are rewritten to repos/1.1.0/NNN and the files moved.
#   2. Exclusions: docs/agents/issues/**, docs/agents/plans/** and
#      scripts/ are untouched, as is generic prose about repos/next/.
#   3. No partial match: repos/next/0010 neither trips the guard nor is
#      rewritten.
#   4. Empty next/: the bump succeeds and no doc changes.
#   5. Stale reference: the bump aborts (non-zero, file:line: match on
#      stderr) and nothing is written.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUMP_SCRIPT="${SCRIPT_DIR}/bump-version.sh"
NEW_VERSION="1.1.0"

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

# build_fixture_repo <repo> <migrations.json content> [migration files...]
build_fixture_repo() {
  local repo="$1" manifest="$2"
  shift 2
  local next_dir="${repo}/arcanum/migrations/repos/next"
  mkdir -p "${repo}/scripts" "${repo}/arcanum/install" "$next_dir" \
    "${repo}/core/spec" "${repo}/docs/agents/issues" "${repo}/docs/agents/plans/1-x"
  cp "$BUMP_SCRIPT" "${repo}/scripts/bump-version.sh"
  local stub
  for stub in generate_tags_table.sh generate_entrypoint_migration_status.sh; do
    printf '#!/usr/bin/env bash\nexit 0\n' > "${repo}/scripts/${stub}"
  done
  chmod +x "${repo}/scripts/"*.sh
  echo "1.0.0" > "${repo}/arcanum.version"
  echo 'DEFAULT_VERSION="1.0.0"' > "${repo}/arcanum/install/bootstrap.sh"
  cat > "${repo}/README.md" <<'EOF'
**Current Version:** [1.0.0](https://github.com/darthjee/arcanum/releases/tag/1.0.0)
**Next Release:** [1.0.1](https://github.com/darthjee/arcanum/compare/1.0.0...main)
EOF
  echo "$manifest" > "${next_dir}/migrations.json"
  local f
  for f in "$@"; do
    echo "# ${f}" > "${next_dir}/${f}"
  done
}

run_bump() {
  local repo="$1"
  BUMP_STDOUT="${TMP_DIR}/stdout"
  BUMP_STDERR="${TMP_DIR}/stderr"
  "${repo}/scripts/bump-version.sh" "$NEW_VERSION" >"$BUMP_STDOUT" 2>"$BUMP_STDERR"
}

assert_contains() {
  local file="$1" text="$2"
  grep -qF -- "$text" "$file" || fail "expected ${file} to contain '${text}', got: $(cat "$file")"
}

assert_not_contains() {
  local file="$1" text="$2"
  ! grep -qF -- "$text" "$file" || fail "expected ${file} NOT to contain '${text}', got: $(cat "$file")"
}

# --- Cases 1-3: rewrite, exclusions, no partial match ---

REPO="${TMP_DIR}/rewrite-repo"
build_fixture_repo "$REPO" '[{"id":"001"},{"id":"002"}]' \
  001.sh 001.md 002.md 002.instructions.md

SPEC="${REPO}/core/spec/x_spec.js"
DOC="${REPO}/docs/a.md"
README="${REPO}/README.md"
ISSUE="${REPO}/docs/agents/issues/1-x.md"
PLAN="${REPO}/docs/agents/plans/1-x/plan.md"
OTHER_SCRIPT="${REPO}/scripts/other.sh"

echo "const f = 'arcanum/migrations/repos/next/001.sh';" > "$SPEC"
cat > "$DOC" <<'EOF'
See `arcanum/migrations/repos/next/002` for details.
`arcanum/migrations/repos/next/` holds unreleased migrations.
Not a reference: arcanum/migrations/repos/next/0010
Instructions: arcanum/migrations/repos/next/002.instructions.md
End of line: arcanum/migrations/repos/next/001
EOF
echo "Pending: arcanum/migrations/repos/next/001.md" >> "$README"
for f in "$ISSUE" "$PLAN" "$OTHER_SCRIPT"; do
  echo "ref arcanum/migrations/repos/next/001.sh" > "$f"
done

run_bump "$REPO" || fail "rewrite case: bump exited non-zero: $(cat "$BUMP_STDERR")"

assert_contains "$SPEC" "'arcanum/migrations/repos/${NEW_VERSION}/001.sh'"
assert_not_contains "$SPEC" "repos/next/"
assert_contains "$DOC" "\`arcanum/migrations/repos/${NEW_VERSION}/002\`"
assert_contains "$DOC" "arcanum/migrations/repos/${NEW_VERSION}/002.instructions.md"
assert_contains "$DOC" "End of line: arcanum/migrations/repos/${NEW_VERSION}/001"
assert_contains "$README" "arcanum/migrations/repos/${NEW_VERSION}/001.md"
assert_contains "$README" "**Current Version:** [${NEW_VERSION}]"

for f in 001.sh 001.md 002.md 002.instructions.md migrations.json; do
  [[ -f "${REPO}/arcanum/migrations/repos/${NEW_VERSION}/${f}" ]] \
    || fail "rewrite case: expected repos/${NEW_VERSION}/${f} to exist"
done
[[ "$(cat "${REPO}/arcanum/migrations/repos/next/migrations.json")" == "[]" ]] \
  || fail "rewrite case: expected an empty next/migrations.json"
assert_contains "$BUMP_STDOUT" "Rewrote repos/next/NNN references in 3 file(s)."

# Exclusions
for f in "$ISSUE" "$PLAN" "$OTHER_SCRIPT"; do
  assert_contains "$f" "ref arcanum/migrations/repos/next/001.sh"
done
assert_contains "$DOC" "\`arcanum/migrations/repos/next/\` holds unreleased migrations."

# No partial match
assert_contains "$DOC" "Not a reference: arcanum/migrations/repos/next/0010"

# No sed backups left behind
if find "$REPO" -name '*.bak' | grep -q .; then
  fail "rewrite case: leftover .bak files: $(find "$REPO" -name '*.bak')"
fi

# --- Case 4: empty next/ ---

REPO="${TMP_DIR}/empty-repo"
build_fixture_repo "$REPO" '[]'
DOC="${REPO}/docs/a.md"
cat > "$DOC" <<'EOF'
`arcanum/migrations/repos/next/` holds unreleased migrations.
EOF
cp "$DOC" "${TMP_DIR}/empty-doc.orig"

run_bump "$REPO" || fail "empty case: bump exited non-zero: $(cat "$BUMP_STDERR")"
cmp -s "$DOC" "${TMP_DIR}/empty-doc.orig" || fail "empty case: doc changed: $(cat "$DOC")"
[[ "$(cat "${REPO}/arcanum.version")" == "$NEW_VERSION" ]] \
  || fail "empty case: arcanum.version not bumped"
[[ ! -d "${REPO}/arcanum/migrations/repos/${NEW_VERSION}" ]] \
  || fail "empty case: repos/${NEW_VERSION}/ should not be created"

# --- Case 5: stale reference aborts with nothing written ---

REPO="${TMP_DIR}/stale-repo"
build_fixture_repo "$REPO" '[{"id":"001"}]' 001.sh
DOC="${REPO}/docs/b.md"
printf 'line one\nSee arcanum/migrations/repos/next/005.sh\n' > "$DOC"

if run_bump "$REPO"; then
  fail "stale case: bump should have exited non-zero"
fi
assert_contains "$BUMP_STDERR" "docs/b.md:2: repos/next/005"
[[ "$(cat "${REPO}/arcanum.version")" == "1.0.0" ]] \
  || fail "stale case: arcanum.version was modified"
assert_contains "${REPO}/arcanum/install/bootstrap.sh" 'DEFAULT_VERSION="1.0.0"'
assert_contains "${REPO}/README.md" "**Current Version:** [1.0.0]"
[[ -f "${REPO}/arcanum/migrations/repos/next/001.sh" ]] \
  || fail "stale case: next/ was moved"
[[ ! -d "${REPO}/arcanum/migrations/repos/${NEW_VERSION}" ]] \
  || fail "stale case: repos/${NEW_VERSION}/ should not exist"
assert_contains "$DOC" "arcanum/migrations/repos/next/005.sh"

echo "OK: all bump-version.sh checks passed"
