#!/usr/bin/env bash
# Generates docs/agents/tag-mutations.md — a scannable, per-skill reference
# table of every call site in arcanum's own skills that mutates a GitHub
# issue tag/label (mark-* semantic wrappers, and generic add-tag/remove-tag
# calls). Dev tooling, alongside scripts/bump-version.sh and
# scripts/build_release_zip.sh — NOT a skill script under <skill>/scripts/.
#
# Usage:
#   scripts/generate_tags_table.sh            Regenerate the table (default,
#                                              non-interactive mode).
#   scripts/generate_tags_table.sh --review    Interactively triage any
#                                              not-yet-reviewed candidate via
#                                              /dev/tty as ignore/keep, then
#                                              regenerate the table.
#   scripts/generate_tags_table.sh --help      Show this usage text.
#
# No repo_path argument, deliberately: unlike most skill scripts, this only
# ever analyzes arcanum's own skill folders, never an arbitrary target repo.
# Self-locates via SCRIPT_DIR, the same convention as bump-version.sh.
#
# How it works:
#   - Every top-level skill folder (one containing a SKILL.md) is scanned:
#     SKILL.md itself, plus every file under <skill>/steps/*.md (if any).
#   - A candidate call site is a line containing a script path ending in
#     .sh, immediately followed by one of the target verbs (mark-<x>,
#     add-tag, remove-tag), immediately followed by at least one more
#     argument token — the full "<script-path> <verb> <args>" invocation
#     shape. A bare mention of a verb name with no script path and no args
#     (e.g. prose referencing an unrelated system's "mark-ready") never
#     matches this shape, so it is excluded structurally, without needing
#     any review-file entry.
#   - For add-tag/remove-tag, the tag mutated is the last whitespace-
#     separated argument on the matched line.
#   - For mark-<x>, the tag(s) added/removed are resolved by looking up
#     arcanum/_lib/github_issue.sh's cmd_mark_<x> function body for its
#     tag_mutate_add_label/tag_mutate_remove_label calls.
#   - The entrypoint column is the thin per-skill wrapper actually
#     referenced on the matched line, resolved to a real file on disk by
#     trying it relative to the skill folder, then the matched file's own
#     directory, then the repo root (in that order) — whichever exists.
#   - The step column is "N (<file>.md)" when the skill's SKILL.md has a
#     "## Step N — ..." heading whose body references <file>.md, or just
#     "(<file>.md)" when the skill has no such heading (e.g.
#     auto-rewrite-issue, which delegates straight to steps/run.md).
#
# Known-false-positive review workflow (on top of the structural exclusion
# above): docs/agents/tag-mutations.review.json records every candidate a
# human has classified, keyed by (skill, step_file, match line):
#   {"reviewed": [{"skill", "step_file", "match", "status": "ignored"|"confirmed", "reason"}]}
# Default mode includes every candidate except ones recorded "ignored" — a
# brand-new, not-yet-reviewed candidate still shows up (fail-open).
# --review mode lists only candidates with no entry yet, prompts each via
# /dev/tty, appends the decision, then writes the table the same as default
# mode.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LIB_GITHUB_ISSUE="${REPO_ROOT}/arcanum/_lib/github_issue.sh"
REVIEW_JSON="${REPO_ROOT}/docs/agents/tag-mutations.review.json"
OUTPUT_TABLE="${REPO_ROOT}/docs/agents/tag-mutations.md"

# Intermediate TSV files use \x1f (ASCII unit separator) as the field
# delimiter, not a tab. Bash's `read`/word-splitting treats tab as an
# IFS-whitespace character regardless of what IFS is set to, which
# collapses consecutive delimiters and silently shifts fields whenever a
# column (e.g. an unnumbered step, or no tags removed) is legitimately
# empty. \x1f is not whitespace, so empty fields round-trip correctly.
FS_CHAR=$'\x1f'

print_help() {
  cat <<'EOF'
Usage: scripts/generate_tags_table.sh [--review] [--help]

Regenerates docs/agents/tag-mutations.md, a generated reference table of
every GitHub issue tag-mutation call site (mark-*/add-tag/remove-tag)
found across arcanum's own skills.

  (no args)   Default mode: non-interactive, writes the table.
  --review    Interactively triage not-yet-reviewed candidates via
              /dev/tty (ignore/keep), append decisions to
              docs/agents/tag-mutations.review.json, then write the table.
  --help      Show this help text.

No repo_path argument — this script only ever analyzes arcanum's own
skill folders, never an arbitrary target repo.
EOF
}

MODE="default"
case "${1:-}" in
  --review) MODE="review" ;;
  --help|-h) print_help; exit 0 ;;
  "") ;;
  *)
    echo "Error: unknown argument '$1'" >&2
    print_help >&2
    exit 1
    ;;
esac

# Full "<script-path>.sh <verb> <args>" invocation shape. Deliberately
# requires both a .sh path immediately before the verb AND at least one
# argument token after it — this is what excludes a bare prose mention of
# a verb name (no script path, no args) without needing fenced-code-block
# detection.
VERB_REGEX='([./A-Za-z0-9_-]+\.sh)[[:space:]]+(mark-[a-z-]+|add-tag|remove-tag)[[:space:]]+([^`]+)'

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# --- Step-heading map: for a given skill's SKILL.md, print "<basename>\t<step-number>"
#     for every .md file referenced in the body of a "## Step N — ..." section. ---
build_step_map() {
  local skill_md="$1"
  local current_step=""
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^##[[:space:]]+Step[[:space:]]+([0-9]+) ]]; then
      current_step="${BASH_REMATCH[1]}"
      continue
    fi
    if [[ "$line" =~ ^##[[:space:]] ]]; then
      current_step=""
      continue
    fi
    [[ -n "$current_step" ]] || continue
    local ref
    while IFS= read -r ref; do
      [[ -n "$ref" ]] || continue
      printf '%s\t%s\n' "$(basename "$ref")" "$current_step"
    done < <(grep -oE '[A-Za-z0-9_./-]+\.md' <<< "$line" || true)
  done < "$skill_md"
}

# --- Resolve the entrypoint script path token to a real file, relative to
#     REPO_ROOT for display. Tries (in order): relative to the skill
#     folder, relative to the matched file's own directory, relative to
#     the repo root. ---
resolve_entrypoint() {
  local skill_dir="$1" md_dir="$2" token="$3"
  local base_dir candidate resolved_dir
  for base_dir in "$skill_dir" "$md_dir" "$REPO_ROOT"; do
    candidate="${base_dir}/${token}"
    if [[ -f "$candidate" ]]; then
      resolved_dir="$(cd "$(dirname "$candidate")" && pwd)"
      candidate="${resolved_dir}/$(basename "$candidate")"
      printf '%s\n' "${candidate#"${REPO_ROOT}"/}"
      return 0
    fi
  done
  # Fallback: could not verify on disk — best-effort guess, skill-relative.
  printf '%s\n' "${skill_dir#"${REPO_ROOT}"/}/${token}"
}

# --- Resolve tags added/removed for a mark-<x> verb by reading
#     arcanum/_lib/github_issue.sh's cmd_mark_<x> function body. Prints
#     "<added-csv>|<removed-csv>". ---
mark_tags_for_verb() {
  local verb="$1"
  local suffix="${verb#mark-}"
  local func_name="cmd_mark_${suffix//-/_}"

  local body
  body=$(awk -v fn="${func_name}() {" '
    index($0, fn) == 1 { found=1; next }
    found && /^}/ { found=0 }
    found { print }
  ' "$LIB_GITHUB_ISSUE")

  local added=() removed=()
  local line
  while IFS= read -r line; do
    if [[ "$line" =~ tag_mutate_add_label[[:space:]]+\"\$id\"[[:space:]]+\"\$repo_ref\"[[:space:]]+([A-Za-z0-9_-]+) ]]; then
      added+=("${BASH_REMATCH[1]}")
    elif [[ "$line" =~ tag_mutate_remove_label[[:space:]]+\"\$id\"[[:space:]]+\"\$repo_ref\"[[:space:]]+([A-Za-z0-9_-]+) ]]; then
      removed+=("${BASH_REMATCH[1]}")
    fi
  done <<< "$body"

  local added_csv="" removed_csv=""
  if [[ "${#added[@]}" -gt 0 ]]; then
    added_csv="$(IFS=,; echo "${added[*]}")"
  fi
  if [[ "${#removed[@]}" -gt 0 ]]; then
    removed_csv="$(IFS=,; echo "${removed[*]}")"
  fi
  printf '%s|%s\n' "$added_csv" "$removed_csv"
}

# --- Scan a single markdown file for candidate call sites. Emits TSV rows:
#     skill \t step_num \t step_file \t entrypoint \t tags_added \t tags_removed \t match ---
scan_file() {
  local skill="$1" skill_dir="$2" md_file="$3" stepmap_file="$4"
  local base
  base="$(basename "$md_file")"
  local md_dir
  md_dir="$(cd "$(dirname "$md_file")" && pwd)"

  local step_num=""
  if [[ -s "$stepmap_file" ]]; then
    # Plain awk lookup rather than grep -P (not portable to BSD/macOS grep).
    step_num=$(awk -F'\t' -v b="$base" '$1 == b { print $2; exit }' "$stepmap_file")
  fi

  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ $VERB_REGEX ]] || continue

    local token="${BASH_REMATCH[1]}"
    local verb="${BASH_REMATCH[2]}"
    local argstr
    argstr="$(trim "${BASH_REMATCH[3]}")"
    [[ -n "$argstr" ]] || continue

    local entrypoint
    entrypoint="$(resolve_entrypoint "$skill_dir" "$md_dir" "$token")"

    local tags_added tags_removed
    if [[ "$verb" == "add-tag" ]]; then
      tags_added="$(awk '{print $NF}' <<< "$argstr")"
      tags_removed=""
    elif [[ "$verb" == "remove-tag" ]]; then
      tags_added=""
      tags_removed="$(awk '{print $NF}' <<< "$argstr")"
    else
      local resolved
      resolved="$(mark_tags_for_verb "$verb")"
      tags_added="${resolved%%|*}"
      tags_removed="${resolved#*|}"
    fi

    printf "%s${FS_CHAR}%s${FS_CHAR}%s${FS_CHAR}%s${FS_CHAR}%s${FS_CHAR}%s${FS_CHAR}%s\n" \
      "$skill" "$step_num" "$base" "$entrypoint" "$tags_added" "$tags_removed" "$(trim "$line")"
  done < "$md_file"
}

# --- Gather every candidate across every skill into a temp TSV. ---
CANDIDATES_FILE="$(mktemp)"
cleanup() { rm -f "$CANDIDATES_FILE"; }
trap cleanup EXIT

while IFS= read -r skill_md; do
  skill_dir="$(dirname "$skill_md")"
  skill_name="$(basename "$skill_dir")"

  stepmap_file="$(mktemp)"
  build_step_map "$skill_md" > "$stepmap_file"

  scan_file "$skill_name" "$skill_dir" "$skill_md" "$stepmap_file" >> "$CANDIDATES_FILE"

  if [[ -d "${skill_dir}/steps" ]]; then
    while IFS= read -r step_file; do
      scan_file "$skill_name" "$skill_dir" "$step_file" "$stepmap_file" >> "$CANDIDATES_FILE"
    done < <(find "${skill_dir}/steps" -maxdepth 1 -type f -name '*.md' | sort)
  fi

  rm -f "$stepmap_file"
done < <(find "$REPO_ROOT" -maxdepth 2 -type f -name 'SKILL.md' | sort)

# --- Review-file helpers ---

review_json_or_empty() {
  if [[ -s "$REVIEW_JSON" ]]; then
    cat "$REVIEW_JSON"
  else
    echo '{"reviewed": []}'
  fi
}

is_ignored() {
  local skill="$1" step_file="$2" match="$3"
  jq -e --arg skill "$skill" --arg step_file "$step_file" --arg match "$match" \
    '.reviewed // [] | any(.skill == $skill and .step_file == $step_file and .match == $match and .status == "ignored")' \
    <<< "$(review_json_or_empty)" > /dev/null
}

is_reviewed() {
  local skill="$1" step_file="$2" match="$3"
  jq -e --arg skill "$skill" --arg step_file "$step_file" --arg match "$match" \
    '.reviewed // [] | any(.skill == $skill and .step_file == $step_file and .match == $match)' \
    <<< "$(review_json_or_empty)" > /dev/null
}

append_review_entry() {
  local skill="$1" step_file="$2" match="$3" status="$4" reason="$5"
  local current
  current="$(review_json_or_empty)"
  local updated
  updated=$(jq --arg skill "$skill" --arg step_file "$step_file" --arg match "$match" \
    --arg status "$status" --arg reason "$reason" \
    '.reviewed = ((.reviewed // []) + [{"skill": $skill, "step_file": $step_file, "match": $match, "status": $status, "reason": $reason}])' \
    <<< "$current")
  mkdir -p "$(dirname "$REVIEW_JSON")"
  printf '%s\n' "$updated" > "${REVIEW_JSON}.tmp"
  mv "${REVIEW_JSON}.tmp" "$REVIEW_JSON"
}

# --- Interactive review mode ---

if [[ "$MODE" == "review" ]]; then
  if ! ( exec 3< /dev/tty ) 2>/dev/null; then
    echo "Error: no interactive terminal (/dev/tty) available for --review. Use the default (non-interactive) mode instead, or run this from a real terminal." >&2
    exit 1
  fi

  while IFS="$FS_CHAR" read -r skill step_num step_file entrypoint tags_added tags_removed match; do
    is_reviewed "$skill" "$step_file" "$match" && continue

    echo "---"
    echo "Skill:      $skill"
    echo "Step file:  $step_file"
    echo "Entrypoint: $entrypoint"
    echo "Line:       $match"
    printf '[i]gnore / [k]eep (default keep)? '
    local_choice=""
    read -r local_choice < /dev/tty || true
    local_reason=""
    case "$local_choice" in
      [Ii]*)
        printf 'Reason (optional): '
        read -r local_reason < /dev/tty || true
        append_review_entry "$skill" "$step_file" "$match" "ignored" "$local_reason"
        ;;
      *)
        append_review_entry "$skill" "$step_file" "$match" "confirmed" "$local_reason"
        ;;
    esac
  done < "$CANDIDATES_FILE"
fi

# --- Render the table (both modes end up here) ---

FILTERED_FILE="$(mktemp)"
while IFS="$FS_CHAR" read -r skill step_num step_file entrypoint tags_added tags_removed match; do
  is_ignored "$skill" "$step_file" "$match" && continue

  local_step_display="(${step_file})"
  [[ -n "$step_num" ]] && local_step_display="${step_num} (${step_file})"

  local_sort_key="$step_num"
  [[ -z "$local_sort_key" ]] && local_sort_key="9999"

  local_added="${tags_added:--}"
  local_removed="${tags_removed:--}"

  printf "%s${FS_CHAR}%05d${FS_CHAR}%s${FS_CHAR}%s${FS_CHAR}%s${FS_CHAR}%s\n" \
    "$skill" "$local_sort_key" "$local_step_display" "$entrypoint" "$local_added" "$local_removed" \
    >> "$FILTERED_FILE"
done < "$CANDIDATES_FILE"

{
  echo "# GitHub Issue Tag Mutations"
  echo
  echo "<!-- AUTO-GENERATED, DO NOT EDIT BY HAND. Run scripts/generate_tags_table.sh to refresh. -->"
  echo
  echo "One row per call site, across all skills, that mutates a GitHub issue tag/label — both the semantic \`mark-*\` wrappers and the generic \`add-tag\`/\`remove-tag\` calls. Both mechanisms bottom out in the shared \`arcanum/_lib/tag_mutate.sh\` helpers (not repeated per row below). \`shipit\` is out of scope — it is human-only and never mutated by any script. See [architecture.md](architecture.md) for the narrative version."
  echo
  echo "| Skill | Step | Entrypoint | Tags Added | Tags Removed |"
  echo "|-------|------|------------|------------|--------------|"

  sort -s -t "$FS_CHAR" -k1,1 -k2,2 "$FILTERED_FILE" | while IFS="$FS_CHAR" read -r skill _sort_key step_display entrypoint added removed; do
    printf '| %s | %s | `%s` | %s | %s |\n' "$skill" "$step_display" "$entrypoint" "$added" "$removed"
  done
} > "$OUTPUT_TABLE"

rm -f "$FILTERED_FILE"

echo "Wrote $(grep -c '^|' "$OUTPUT_TABLE" || true) table rows to ${OUTPUT_TABLE#"${REPO_ROOT}"/}."
