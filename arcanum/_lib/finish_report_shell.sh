#!/usr/bin/env bash
# Shell implementation of the "finish-report" migrated entrypoint —
# see docs/agents/architecture/script-engine.md,
# docs/agents/specs/skill-finish.md and
# docs/agents/plans/660-skill-finish-discuss-issue/plan.md for the full
# design/shared contracts. Invoked either directly (when
# engine.mode=shell) or as the fallback for engine.mode=native without
# a native implementation yet, via arcanum/_lib/finish_report.sh's
# engine_dispatch shim — never called directly by skills.
#
# Renders the standard closing report of an issue skill.
#
# Usage:
#   finish_report_shell.sh <repo_path> --skill <name> --status success|declined|failed \
#     --summary "<text>" [--issue <id>] [--pr <number>] [--sub-issue <id>]... \
#     [--label-change <before_tag>:<after_tag>]... [--next "<command>"]... \
#     [--merge "<nested block>"]... [--nested]
#
# Flags may appear in any order after <repo_path>. Repeatable flags keep
# their order; a repeated single-value flag (--skill, --status, --summary,
# --issue, --pr) keeps its last value.
#
# Output (stdout, exit 0), one line each:
#   == <skill>: <STATUS> ==
#   <summary>
#   Issue: #<id> https://<web-domain>/<owner>/<repo>/issues/<id>      (only when set)
#   PR: #<n> https://<web-domain>/<owner>/<repo>/pull/<n>              (only when set)
#   Sub-issues: #<a> #<b>                                              (only when set)
#   Labels: <BeforeLabel> -> <AfterLabel>                              (one per label change)
#   Next: <command>                                                    (one per --next)
#
# With --nested, prints instead (optional keys only when set, repeated per value;
# --next is ignored and label changes stay canonical tags):
#   FINISH_SKILL=<skill>
#   FINISH_STATUS=<status>
#   FINISH_SUMMARY=<summary>
#   FINISH_ISSUE=<id>
#   FINISH_PR=<n>
#   FINISH_SUB_ISSUE=<id>
#   FINISH_LABEL_CHANGE=<before_tag>:<after_tag>
#
# --merge "<block>" merges a nested run's --nested output: the caller's
# skill/status/summary are kept; Issue/PR are filled only when the caller
# did not pass them; nested sub-issues and label changes are appended
# after the caller's own, dropping exact duplicates; unknown lines are
# ignored. A nested FINISH_STATUS=failed with the caller's --status
# success is a usage error.
#
# The web domain is the origin domain (arcanum/_lib/origin.sh), except
# ssh.github.com, which maps to github.com. The origin is read only when
# an Issue or PR URL has to be printed. No network call is made.
#
# Usage errors (missing/invalid flag, bad status, non-numeric id, unknown
# tag, repo with no origin) print nothing on stdout, an error on stderr,
# and exit 1.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=origin.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/origin.sh"
# shellcheck source=tags.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/tags.sh"

_usage_error() {
  echo "Error: $1" >&2
  echo "Usage: $0 <repo_path> --skill <name> --status success|declined|failed --summary \"<text>\" [--issue <id>] [--pr <number>] [--sub-issue <id>]... [--label-change <before_tag>:<after_tag>]... [--next \"<command>\"]... [--merge \"<nested block>\"]... [--nested]" >&2
  exit 1
}

_require_numeric() {
  local what="$1" value="$2"
  [[ "$value" =~ ^[0-9]+$ ]] || _usage_error "$what must be numeric, got '$value'"
}

_trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# _validate_label_change <value>
#   Splits <value> on its first ':' and checks that every non-empty side is
#   a known canonical tag and that at least one side is non-empty.
_validate_label_change() {
  local value="$1"
  [[ "$value" == *:* ]] || _usage_error "--label-change must be <before_tag>:<after_tag>, got '$value'"
  local before="${value%%:*}"
  local after="${value#*:}"
  [[ -n "$before" || -n "$after" ]] || _usage_error "--label-change needs at least one tag, got '$value'"
  if [[ -n "$before" && -z "$(_tag_label_for "$before")" ]]; then
    _usage_error "unknown tag '$before' in label change '$value'"
  fi
  if [[ -n "$after" && -z "$(_tag_label_for "$after")" ]]; then
    _usage_error "unknown tag '$after' in label change '$value'"
  fi
  return 0
}

_label_or_none() {
  if [[ -z "$1" ]]; then
    printf '(none)'
  else
    _tag_label_for "$1"
  fi
}

# _contains <needle> <haystack...>
_contains() {
  local needle="$1" item
  shift
  for item in "$@"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

REPO_PATH="${1:-}"
[[ -n "$REPO_PATH" && "$REPO_PATH" != --* ]] || _usage_error "<repo_path> is required as the first argument"
shift

SKILL=""
STATUS=""
SUMMARY=""
SUMMARY_SET=false
ISSUE=""
PR=""
NESTED=false
SUB_ISSUES=()
LABEL_CHANGES=()
NEXTS=()
MERGES=()

while [[ $# -gt 0 ]]; do
  flag="$1"
  case "$flag" in
    --nested)
      NESTED=true
      shift
      continue
      ;;
    --skill|--status|--summary|--issue|--pr|--sub-issue|--label-change|--next|--merge)
      [[ $# -ge 2 ]] || _usage_error "$flag requires a value"
      value="$2"
      shift 2
      ;;
    *)
      _usage_error "unknown argument '$flag'"
      ;;
  esac

  case "$flag" in
    --skill)        SKILL="$value" ;;
    --status)       STATUS="$value" ;;
    --summary)      SUMMARY="$value"; SUMMARY_SET=true ;;
    --issue)        _require_numeric "--issue" "$value"; ISSUE="$value" ;;
    --pr)           _require_numeric "--pr" "$value"; PR="$value" ;;
    --sub-issue)    _require_numeric "--sub-issue" "$value"; SUB_ISSUES+=("$value") ;;
    --label-change) _validate_label_change "$value"; LABEL_CHANGES+=("$value") ;;
    --next)         NEXTS+=("$value") ;;
    --merge)        MERGES+=("$value") ;;
  esac
done

[[ -n "$SKILL" ]] || _usage_error "--skill is required"
[[ -n "$STATUS" ]] || _usage_error "--status is required"
case "$STATUS" in
  success|declined|failed) ;;
  *) _usage_error "--status must be one of success, declined, failed; got '$STATUS'" ;;
esac
[[ "$SUMMARY_SET" == true ]] || _usage_error "--summary is required"
SUMMARY="$(_trim "$SUMMARY")"
[[ -n "$SUMMARY" ]] || _usage_error "--summary must not be empty"
[[ "$SUMMARY" != *$'\n'* ]] || _usage_error "--summary must be a single line"

# --- Merge nested result blocks ---

for block in ${MERGES[@]+"${MERGES[@]}"}; do
  while IFS= read -r line || [[ -n "$line" ]]; do
    key="${line%%=*}"
    [[ "$line" == *=* ]] || continue
    val="${line#*=}"
    case "$key" in
      FINISH_STATUS)
        if [[ "$val" == "failed" && "$STATUS" == "success" ]]; then
          _usage_error "a nested run failed; the caller must report --status failed, not success"
        fi
        ;;
      FINISH_ISSUE)
        _require_numeric "merged FINISH_ISSUE" "$val"
        [[ -n "$ISSUE" ]] || ISSUE="$val"
        ;;
      FINISH_PR)
        _require_numeric "merged FINISH_PR" "$val"
        [[ -n "$PR" ]] || PR="$val"
        ;;
      FINISH_SUB_ISSUE)
        _require_numeric "merged FINISH_SUB_ISSUE" "$val"
        _contains "$val" ${SUB_ISSUES[@]+"${SUB_ISSUES[@]}"} || SUB_ISSUES+=("$val")
        ;;
      FINISH_LABEL_CHANGE)
        _validate_label_change "$val"
        _contains "$val" ${LABEL_CHANGES[@]+"${LABEL_CHANGES[@]}"} || LABEL_CHANGES+=("$val")
        ;;
    esac
  done <<< "$block"
done

# --- Render ---

OUTPUT=""
_emit() {
  OUTPUT+="$1"$'\n'
}

if [[ "$NESTED" == true ]]; then
  _emit "FINISH_SKILL=$SKILL"
  _emit "FINISH_STATUS=$STATUS"
  _emit "FINISH_SUMMARY=$SUMMARY"
  [[ -z "$ISSUE" ]] || _emit "FINISH_ISSUE=$ISSUE"
  [[ -z "$PR" ]] || _emit "FINISH_PR=$PR"
  for id in ${SUB_ISSUES[@]+"${SUB_ISSUES[@]}"}; do
    _emit "FINISH_SUB_ISSUE=$id"
  done
  for change in ${LABEL_CHANGES[@]+"${LABEL_CHANGES[@]}"}; do
    _emit "FINISH_LABEL_CHANGE=$change"
  done
  printf '%s' "$OUTPUT"
  exit 0
fi

BASE_URL=""
if [[ -n "$ISSUE" || -n "$PR" ]]; then
  domain="$(get_domain "$REPO_PATH")" || exit 1
  repo="$(get_repo_path "$REPO_PATH")" || exit 1
  [[ "$domain" == "ssh.github.com" ]] && domain="github.com"
  BASE_URL="https://${domain}/${repo}"
fi

_emit "== ${SKILL}: $(printf '%s' "$STATUS" | tr '[:lower:]' '[:upper:]') =="
_emit "$SUMMARY"
[[ -z "$ISSUE" ]] || _emit "Issue: #${ISSUE} ${BASE_URL}/issues/${ISSUE}"
[[ -z "$PR" ]] || _emit "PR: #${PR} ${BASE_URL}/pull/${PR}"
if [[ ${#SUB_ISSUES[@]} -gt 0 ]]; then
  line="Sub-issues:"
  for id in "${SUB_ISSUES[@]}"; do
    line+=" #${id}"
  done
  _emit "$line"
fi
for change in ${LABEL_CHANGES[@]+"${LABEL_CHANGES[@]}"}; do
  _emit "Labels: $(_label_or_none "${change%%:*}") -> $(_label_or_none "${change#*:}")"
done
for cmd in ${NEXTS[@]+"${NEXTS[@]}"}; do
  _emit "Next: $cmd"
done

printf '%s' "$OUTPUT"
