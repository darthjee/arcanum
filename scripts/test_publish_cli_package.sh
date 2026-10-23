#!/usr/bin/env bash
# Regression check for scripts/publish_cli_package.sh. Standalone, following
# the convention set by scripts/test_generate_tags_table.sh: a plain bash
# script with a fail() helper, exit non-zero on failure, not wired into CI.
# Run by hand:
#   bash scripts/test_publish_cli_package.sh
#
# Builds a fixture "repo" under a temp dir (with its own
# scripts/publish_cli_package.sh copy, so the script's self-locating
# REPO_ROOT scopes it to the fixture, and a minimal cli/package.json), and
# puts stub `npm`, `yarn` and `sleep` executables first on PATH. The stubs
# log every call and return scripted outputs; the real `node` is used.
# Cases:
#   1. Non-bare tag: exits 1.
#   2. Version mismatch: exits 1, nothing installed or published.
#   3. npm too old on a real publish: exits 1 (a dry run accepts it).
#   4. Token env var on a real publish: exits 1.
#   5. OIDC variable missing on a real publish: exits 1.
#   6. Already published: exits 0, no install and no publish.
#   7. Dry run: `npm publish --dry-run`, no `npm view`.
#   8. Wrong pack file list: exits 1 and prints both lists.
#   9. Happy path: publish called once, verify retried until visible.
#  10. Verify timeout: exits 1 with a registry-lag message.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLISH_SCRIPT="${SCRIPT_DIR}/publish_cli_package.sh"
VERSION="1.2.3"

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
REPO="${TMP_DIR}/repo"
BIN_DIR="${TMP_DIR}/bin"
CALL_LOG="${TMP_DIR}/calls.log"
VIEW_COUNT_FILE="${TMP_DIR}/view_count"
OUT="${TMP_DIR}/stdout"
ERR="${TMP_DIR}/stderr"

GOOD_PACK_JSON='[{"files":[{"path":"package.json"},{"path":"README.md"},{"path":"dist/arcanum.mjs"},{"path":"bin/arcanum"}]}]'
BAD_PACK_JSON='[{"files":[{"path":"package.json"},{"path":"README.md"},{"path":"dist/arcanum.mjs"},{"path":"bin/arcanum"},{"path":"lib/secret.js"}]}]'

mkdir -p "${REPO}/scripts" "${REPO}/cli" "$BIN_DIR"
cp "$PUBLISH_SCRIPT" "${REPO}/scripts/publish_cli_package.sh"
chmod +x "${REPO}/scripts/publish_cli_package.sh"
echo "{\"name\":\"arcanum-cli\",\"version\":\"${VERSION}\"}" > "${REPO}/cli/package.json"

# npm stub. Scripted through:
#   FAKE_NPM_VERSION       printed by `npm --version`
#   FAKE_VIEW_VISIBLE_FROM 1-based `npm view ... version` call from which the
#                          version is visible (0 = never)
#   FAKE_PACK_JSON         printed by `npm pack`
cat > "${BIN_DIR}/npm" <<EOF
#!/usr/bin/env bash
echo "npm \$*" >> "${CALL_LOG}"
case "\$1" in
  --version) echo "\${FAKE_NPM_VERSION}" ;;
  view)
    if [[ "\$3" == "version" ]]; then
      count=\$(( \$(cat "${VIEW_COUNT_FILE}" 2> /dev/null || echo 0) + 1 ))
      echo "\$count" > "${VIEW_COUNT_FILE}"
      if (( FAKE_VIEW_VISIBLE_FROM > 0 && count >= FAKE_VIEW_VISIBLE_FROM )); then
        echo "\${2#*@}"
      fi
    else
      echo "sha512-fakeintegrity"
    fi
    ;;
  pack) echo "\${FAKE_PACK_JSON}" ;;
esac
exit 0
EOF
for stub in yarn sleep; do
  cat > "${BIN_DIR}/${stub}" <<EOF
#!/usr/bin/env bash
echo "${stub} \$*" >> "${CALL_LOG}"
exit 0
EOF
done
chmod +x "${BIN_DIR}/"*

# run_publish [VAR=value...] -- <args...>
# Runs the fixture script with a clean token/OIDC environment, the defaults
# below, and any VAR=value overrides. Sets RUN_STATUS.
run_publish() {
  local overrides=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    overrides+=("$1")
    shift
  done
  shift
  : > "$CALL_LOG"
  rm -f "$VIEW_COUNT_FILE"
  env -u NPM_TOKEN -u NODE_AUTH_TOKEN -u CIRCLE_OIDC_TOKEN -u CIRCLE_OIDC_TOKEN_V2 \
    PATH="${BIN_DIR}:${PATH}" \
    FAKE_NPM_VERSION="11.5.1" \
    FAKE_VIEW_VISIBLE_FROM="0" \
    FAKE_PACK_JSON="$GOOD_PACK_JSON" \
    CIRCLE_OIDC_TOKEN_V2="fake-oidc" \
    ${overrides[@]+"${overrides[@]}"} \
    "${REPO}/scripts/publish_cli_package.sh" "$@" > "$OUT" 2> "$ERR"
  RUN_STATUS=$?
}

assert_status() {
  local expected="$1" label="$2"
  [[ "$RUN_STATUS" == "$expected" ]] \
    || fail "${label}: expected exit ${expected}, got ${RUN_STATUS}; stdout: $(cat "$OUT"); stderr: $(cat "$ERR")"
}

assert_contains() {
  local file="$1" text="$2" label="$3"
  grep -qF -- "$text" "$file" || fail "${label}: expected ${file} to contain '${text}', got: $(cat "$file")"
}

assert_not_contains() {
  local file="$1" text="$2" label="$3"
  ! grep -qF -- "$text" "$file" || fail "${label}: expected ${file} NOT to contain '${text}', got: $(cat "$file")"
}

count_calls() {
  grep -cxF -- "$1" "$CALL_LOG"
}

# --- Case 1: non-bare tag ---
for tag in "v${VERSION}" "${VERSION}-rc.1" "1.2"; do
  run_publish -- "$tag"
  assert_status 1 "non-bare tag ${tag}"
  assert_contains "$ERR" "not a bare X.Y.Z" "non-bare tag ${tag}"
  assert_not_contains "$CALL_LOG" "npm publish" "non-bare tag ${tag}"
done

# --- Case 2: version mismatch ---
run_publish -- "9.9.9"
assert_status 1 "version mismatch"
assert_contains "$ERR" "does not match tag 9.9.9" "version mismatch"
assert_not_contains "$CALL_LOG" "yarn install" "version mismatch"
assert_not_contains "$CALL_LOG" "npm publish" "version mismatch"

# --- Case 3: npm too old on a real publish ---
run_publish FAKE_NPM_VERSION="11.4.9" -- "$VERSION"
assert_status 1 "npm too old"
assert_contains "$ERR" "npm 11.4.9 is too old" "npm too old"
assert_not_contains "$CALL_LOG" "npm publish" "npm too old"

# Numeric (not lexical) comparison: 11.10.0 >= 11.5.1.
run_publish FAKE_NPM_VERSION="11.10.0" FAKE_VIEW_VISIBLE_FROM=1 -- "$VERSION"
assert_status 0 "npm 11.10.0"

# The npm floor is for trusted publishing only: a dry run accepts npm 10.
run_publish FAKE_NPM_VERSION="10.9.9" -- "$VERSION" --dry-run
assert_status 0 "dry run with npm 10"

# --- Case 4: token env var on a real publish ---
for var in NPM_TOKEN NODE_AUTH_TOKEN; do
  run_publish "${var}=secret" -- "$VERSION"
  assert_status 1 "${var} set"
  assert_contains "$ERR" "OIDC-only" "${var} set"
  assert_not_contains "$CALL_LOG" "npm publish" "${var} set"
  assert_not_contains "$OUT" "secret" "${var} set"
  assert_not_contains "$ERR" "secret" "${var} set"
done

# --- Case 5: OIDC variable missing on a real publish ---
run_publish CIRCLE_OIDC_TOKEN_V2= -- "$VERSION"
assert_status 1 "OIDC missing"
assert_contains "$ERR" "No CircleCI OIDC token" "OIDC missing"
assert_contains "$ERR" "trusted-publisher bootstrap" "OIDC missing"
assert_not_contains "$CALL_LOG" "npm publish" "OIDC missing"

# The legacy CIRCLE_OIDC_TOKEN is accepted too.
run_publish CIRCLE_OIDC_TOKEN_V2= CIRCLE_OIDC_TOKEN="fake-oidc" FAKE_VIEW_VISIBLE_FROM=1 -- "$VERSION"
assert_status 0 "legacy OIDC variable"

# --- Case 6: already published ---
run_publish FAKE_VIEW_VISIBLE_FROM=1 -- "$VERSION"
assert_status 0 "already published"
assert_contains "$OUT" "already published" "already published"
assert_not_contains "$CALL_LOG" "yarn install" "already published"
assert_not_contains "$CALL_LOG" "npm publish" "already published"

# --- Case 7: dry run (no token/OIDC requirement, no registry lookups) ---
run_publish CIRCLE_OIDC_TOKEN_V2= NPM_TOKEN=secret -- "$VERSION" --dry-run
assert_status 0 "dry run"
[[ "$(count_calls "npm publish --dry-run")" == 1 ]] || fail "dry run: expected one npm publish --dry-run: $(cat "$CALL_LOG")"
[[ "$(count_calls "npm publish")" == 0 ]] || fail "dry run: real npm publish called: $(cat "$CALL_LOG")"
assert_not_contains "$CALL_LOG" "npm view" "dry run"
for call in "yarn install --frozen-lockfile" "yarn lint" "yarn build" "yarn test"; do
  [[ "$(count_calls "$call")" == 1 ]] || fail "dry run: expected '${call}' once: $(cat "$CALL_LOG")"
done

# --- Case 8: wrong pack file list ---
run_publish FAKE_PACK_JSON="$BAD_PACK_JSON" -- "$VERSION"
assert_status 1 "wrong pack list"
assert_contains "$ERR" "Unexpected package contents" "wrong pack list"
assert_contains "$ERR" "Expected:" "wrong pack list"
assert_contains "$ERR" "lib/secret.js" "wrong pack list"
assert_not_contains "$CALL_LOG" "npm publish" "wrong pack list"

# --- Case 9: happy path, verify retried until visible ---
# View call 1 is the already-published check; calls 2 and 3 miss; call 4 hits.
run_publish FAKE_VIEW_VISIBLE_FROM=4 -- "$VERSION"
assert_status 0 "happy path"
[[ "$(count_calls "npm publish")" == 1 ]] || fail "happy path: expected one npm publish: $(cat "$CALL_LOG")"
[[ "$(count_calls "npm view arcanum-cli@${VERSION} version")" == 4 ]] \
  || fail "happy path: expected 4 version lookups: $(cat "$CALL_LOG")"
[[ "$(count_calls "sleep 5")" == 2 ]] || fail "happy path: expected 2 sleeps: $(cat "$CALL_LOG")"
assert_contains "$CALL_LOG" "npm view arcanum-cli@${VERSION} dist.integrity" "happy path"
assert_contains "$OUT" "sha512-fakeintegrity" "happy path"
order="$(grep -E '^(yarn|npm (pack|publish))' "$CALL_LOG" | tr '\n' '|')"
[[ "$order" == "yarn install --frozen-lockfile|yarn lint|yarn build|yarn test|npm pack --dry-run --json --ignore-scripts|npm publish|" ]] \
  || fail "happy path: unexpected step order: ${order}"

# --- Case 10: verify timeout ---
run_publish FAKE_VIEW_VISIBLE_FROM=0 -- "$VERSION"
assert_status 1 "verify timeout"
assert_contains "$ERR" "registry lag" "verify timeout"
[[ "$(count_calls "npm publish")" == 1 ]] || fail "verify timeout: expected one npm publish: $(cat "$CALL_LOG")"
[[ "$(count_calls "sleep 5")" == 12 ]] || fail "verify timeout: expected 12 sleeps: $(cat "$CALL_LOG")"

echo "OK: all publish_cli_package.sh checks passed"
