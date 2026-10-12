#!/usr/bin/env bash
# Measures the per-call overhead of engine.mode=docker against
# engine.mode=native, through the real dispatch path
# (arcanum/_lib/engine_dispatch.sh), so the Docker availability check and
# the `docker run` argv construction count as overhead. See
# docs/agents/architecture/docker-engine.md#per-call-docker-run-and-when-to-revisit-it
# and docs/agents/architecture/docker-engine.md#testing. Local-only:
# it needs a Docker daemon and the runtime image (`make docker-benchmark`
# builds it first).
#
# Usage: docker_benchmark.sh [--runs N] [--cold]
#   --runs N  warm iterations per command and mode (default 20).
#   --cold    one run per command and mode, labeled `cold`. The script
#             does NOT restart Docker: restart Docker Desktop (or the
#             daemon) by hand right before running it with --cold.
#
# Env:
#   ARCANUM_BENCH_IMAGE     the image under test
#                           (default darthjee/arcanum:local-test).
#   ARCANUM_BENCH_GH_REPO   <owner>/<name> and
#   ARCANUM_BENCH_GH_ISSUE  <number>: opt in to the github-issue-info
#                           benchmark, which also needs GH_TOKEN set or
#                           resolvable through `gh auth token`. Otherwise
#                           it prints one `skipped:` line.
#
# Benchmarked commands (each called with its real shim's engine_dispatch
# flags, env allowlist and args): issue-state get, resolve-plan-paths,
# auto-fix-all-config-get and (opt-in) github-issue-info. They run
# against a throwaway fixture repo, removed on exit. A temporary
# migration-status map marks the four commands `docker`; production's
# map is never touched.
#
# Output: a header (platform, Docker server version, image), then one
# table per command: mode, runs, median and p95 in ms, and the docker
# minus native overhead. A non-zero exit, or any dispatch warning (e.g.
# a silent fallback to native), aborts the benchmark.
#
# Compatible with bash 3.2 (macOS's /bin/bash).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENGINE_DISPATCH_LIB="${INSTALL_ROOT}/arcanum/_lib/engine_dispatch.sh"
LIB_DIR="${INSTALL_ROOT}/arcanum/_lib"
AUTO_FIX_ALL_SCRIPTS_DIR="${INSTALL_ROOT}/auto-fix-all/scripts"

IMAGE="${ARCANUM_BENCH_IMAGE:-darthjee/arcanum:local-test}"
RUNS=20
COLD=false
MODES="native docker"
BENCH_COMMANDS="issue-state resolve-plan-paths auto-fix-all-config-get github-issue-info"

ISSUE_ID=1
ISSUES_FOLDER="docs/agents/issues"
PLANS_FOLDER="docs/agents/plans"
CONFIG_KEY="bench_key"
STATE_DIR=".claude/state"
REPO_CONFIG_FILE=".claude/configuration/arcanum-repo-config.json"
LOCAL_CONFIG_FILE="${STATE_DIR}/arcanum-config.json"

# Sources the dispatch lib, overrides the two sourced variables (never an
# env hook), then calls engine_dispatch with the rest of argv — the same
# shape as core/spec/support/utils/engineDispatchLib.js.
# shellcheck disable=SC2016  # expanded by the inner bash, not here
WRAPPER='source "$1"; _ENGINE_DISPATCH_MIGRATION_STATUS_FILE="$2"; _ENGINE_DISPATCH_DOCKER_IMAGE="$3"; shift 3; engine_dispatch "$@"'

usage() {
  sed -n '/^# Usage:/,/^# Compatible/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//' >&2
}

die() {
  echo "Error: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runs)
      [[ "${2:-}" =~ ^[1-9][0-9]*$ ]] || { usage; die "--runs needs a positive integer"; }
      RUNS="$2"
      shift 2
      ;;
    --cold) COLD=true; shift ;;
    -h | --help) usage; exit 0 ;;
    *) usage; die "unknown argument '$1'" ;;
  esac
done

LABEL="warm"
if [[ "$COLD" == "true" ]]; then
  RUNS=1
  LABEL="cold"
fi

for tool in docker git jq perl; do
  command -v "$tool" >/dev/null 2>&1 || die "'$tool' is not on the PATH"
done
docker image inspect "$IMAGE" >/dev/null 2>&1 \
  || die "image '$IMAGE' not found (run \`make core-build-runtime\` or \`make docker-benchmark\`)"

WORK_DIR="$(mktemp -d)"
WORK_DIR="$(cd "$WORK_DIR" && pwd -P)"
trap 'rm -rf "$WORK_DIR"' EXIT

FIXTURE_REPO="${WORK_DIR}/repo"
STATUS_MAP="${WORK_DIR}/migration-status.json"
RUN_STDERR="${WORK_DIR}/stderr"

# --- Fixture ---

now_ms() {
  perl -MTime::HiRes=time -e 'printf "%d\n", time() * 1000'
}

setup_fixture() {
  mkdir -p "$FIXTURE_REPO"
  (
    cd "$FIXTURE_REPO"
    git init -q
    git config user.name "arcanum benchmark"
    git config user.email "benchmark@example.invalid"
    mkdir -p "$ISSUES_FOLDER" "$PLANS_FOLDER" "$STATE_DIR" "$(dirname "$REPO_CONFIG_FILE")"
    echo "# Benchmark issue" > "${ISSUES_FOLDER}/${ISSUE_ID}-benchmark.md"
    mkdir -p "${PLANS_FOLDER}/${ISSUE_ID}-benchmark"
    echo "# Benchmark plan" > "${PLANS_FOLDER}/${ISSUE_ID}-benchmark/plan.md"
    echo '{"status":"benchmark"}' > "${STATE_DIR}/issue-${ISSUE_ID}.json"
    jq -n --arg k "$CONFIG_KEY" '{"auto-fix-all": {($k): true}}' > "$REPO_CONFIG_FILE"
    if [[ -n "${ARCANUM_BENCH_GH_REPO:-}" ]]; then
      git remote add origin "https://github.com/${ARCANUM_BENCH_GH_REPO}.git"
    fi
    git add -A
    git -c commit.gpgsign=false commit -q --no-verify -m "benchmark fixture"
  )
  jq -n --arg cmds "$BENCH_COMMANDS" \
    '[$cmds | split(" ")[] | {key: ., value: "docker"}] | from_entries' > "$STATUS_MAP"
}

set_mode() {
  jq -n --arg mode "$1" '{engine: {mode: $mode}}' > "${FIXTURE_REPO}/${LOCAL_CONFIG_FILE}"
}

# --- Dispatch calls (mirroring each command's real shim) ---

# dispatch_args <command>
#   Prints, one per line, engine_dispatch's arguments for <command>,
#   exactly as its shim passes them.
dispatch_args() {
  local repo="$FIXTURE_REPO"
  case "$1" in
    issue-state)
      # arcanum/_lib/issue_state.sh <repo_path> get <id> <field>
      printf '%s\n' "$repo" issue-state "${LIB_DIR}/issue_state_shell.sh" -- \
        "$repo" get "$ISSUE_ID" status
      ;;
    resolve-plan-paths)
      # arcanum/_lib/resolve_plan_paths.sh <repo_path> <issues> <plans> <id>
      printf '%s\n' "$repo" resolve-plan-paths "${LIB_DIR}/resolve_plan_paths_shell.sh" -- \
        "$repo" "$ISSUES_FOLDER" "$PLANS_FOLDER" "$ISSUE_ID"
      ;;
    auto-fix-all-config-get)
      # auto-fix-all/scripts/config.sh get <repo_path> <key>
      printf '%s\n' "$repo" auto-fix-all-config-get "${AUTO_FIX_ALL_SCRIPTS_DIR}/config_get_shell.sh" -- \
        "$repo" "$CONFIG_KEY"
      ;;
    github-issue-info)
      # arcanum/_lib/github_issue.sh info <repo_path>
      printf '%s\n' "$repo" github-issue-info "${LIB_DIR}/github_issue_info_shell.sh" HOME -- \
        "$repo"
      ;;
    *) die "unknown benchmark command '$1'" ;;
  esac
}

# time_call <command>
#   Runs one dispatch call from the fixture repo and prints its wall time
#   in ms. Output is discarded; a non-zero exit or any warning on stderr
#   (a fallback means the wrong path was measured) aborts the benchmark.
time_call() {
  local command="$1" args=() line start end code=0
  while IFS= read -r line; do
    args+=("$line")
  done < <(dispatch_args "$command")

  start=$(now_ms)
  (cd "$FIXTURE_REPO" && bash -c "$WRAPPER" _ "$ENGINE_DISPATCH_LIB" "$STATUS_MAP" "$IMAGE" "${args[@]}") \
    >/dev/null 2>"$RUN_STDERR" || code=$?
  end=$(now_ms)

  if [[ $code -ne 0 ]]; then
    cat "$RUN_STDERR" >&2
    die "'${command}' exited ${code}"
  fi
  if grep -q '^Warning:' "$RUN_STDERR"; then
    cat "$RUN_STDERR" >&2
    die "'${command}' printed a dispatch warning — the benchmark did not measure the intended path"
  fi
  echo $((end - start))
}

# percentile <p> <values...>
#   Nearest-rank percentile (p in 1..100) of the given integers.
percentile() {
  local p="$1"
  shift
  local n=$# rank
  rank=$(((p * n + 99) / 100))
  [[ $rank -lt 1 ]] && rank=1
  printf '%s\n' "$@" | sort -n | sed -n "${rank}p"
}

# --- Gating ---

# gh_skip_reason
#   Prints why github-issue-info is skipped, or nothing when it runs.
gh_skip_reason() {
  if [[ -z "${ARCANUM_BENCH_GH_REPO:-}" || -z "${ARCANUM_BENCH_GH_ISSUE:-}" ]]; then
    echo "set ARCANUM_BENCH_GH_REPO and ARCANUM_BENCH_GH_ISSUE"
    return 0
  fi
  if [[ -z "${GH_TOKEN:-}" ]] && ! { command -v gh >/dev/null 2>&1 && gh auth token >/dev/null 2>&1; }; then
    echo "no GitHub token: set GH_TOKEN or log in with gh auth login"
  fi
  return 0
}

# --- Main ---

setup_fixture

echo "# arcanum docker benchmark — platform: $(uname -sm), docker server: $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo unknown), image: ${IMAGE}"

for command in $BENCH_COMMANDS; do
  if [[ "$command" == "github-issue-info" ]]; then
    reason="$(gh_skip_reason)"
    if [[ -n "$reason" ]]; then
      echo
      echo "skipped: github-issue-info (${reason})"
      continue
    fi
  fi

  echo
  echo "## ${command}"
  printf '%-8s %-6s %6s %10s %10s\n' mode label runs median_ms p95_ms
  native_median=""
  native_p95=""
  for mode in $MODES; do
    set_mode "$mode"
    durations=()
    for ((i = 0; i < RUNS; i++)); do
      durations+=("$(time_call "$command")")
    done
    median=$(percentile 50 "${durations[@]}")
    p95=$(percentile 95 "${durations[@]}")
    printf '%-8s %-6s %6s %10s %10s\n' "$mode" "$LABEL" "$RUNS" "$median" "$p95"
    if [[ "$mode" == "native" ]]; then
      native_median="$median"
      native_p95="$p95"
    else
      printf '%-8s %-6s %6s %10s %10s\n' overhead "$LABEL" "" \
        "$((median - native_median))" "$((p95 - native_p95))"
    fi
  done
done
