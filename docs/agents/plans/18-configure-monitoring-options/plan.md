# Plan: Configure monitoring options

Issue: [18-configure-monitoring-options.md](../../issues/18-configure-monitoring-options.md)

## Overview

Move `wait_ci.sh`'s `IGNORED_CHECK_PATTERNS` array out of the script and into a per-project JSON config file (`.claude/configuration/auto-fix-all.json`), read from the target project's own repository. Update `init-claude` to ask about and populate this config. Add the file to Arcanum's own repo so this repo's `auto-fix-all` runs keep ignoring `Codacy` after the hardcoded array is removed.

## Context

`wait_ci.sh` currently defines `IGNORED_CHECK_PATTERNS=("Codacy")` as a bash array literal (added for issue #10) and converts it to JSON via `printf '%s\n' "${IGNORED_CHECK_PATTERNS[@]}" | jq -R . | jq -s .` before using it in a jq filter. This conversion step can be reused almost as-is once the source of the array changes from a literal to a JSON file's field.

## Implementation Steps

### Step 1 — Define the config file shape

`.claude/configuration/auto-fix-all.json`:
```json
{
  "ignored_check_patterns": ["Codacy"]
}
```
A flat JSON object with one array field, `ignored_check_patterns`, of regex strings (case-insensitive matched, same semantics as today).

### Step 2 — Update `auto-fix-all/scripts/wait_ci.sh`

Replace `IGNORED_CHECK_PATTERNS=("Codacy")` with logic that:
- Looks for `.claude/configuration/auto-fix-all.json` relative to the current working directory (the target project's root — same assumption already used by `create_branch.sh`, `commit_change.sh`, etc.).
- If present, reads `.ignored_check_patterns` via `jq` directly into the `ignored_json` array already used downstream (skip the bash-array round-trip entirely — `jq -r '.ignored_check_patterns // [] | @json' < file` or simply pass the file straight into the existing `jq --argjson ignored` step via `--slurpfile`/`$(jq '.ignored_check_patterns // []' file)`).
- If absent, default to an empty list (no patterns ignored) — do not silently fall back to ignoring `Codacy` for projects that haven't configured anything.
- Update the header comment to describe the new config-file-based source instead of the hardcoded array, and document the JSON shape.

### Step 3 — Update `init-claude`

In whichever step of `init-claude` sets up `auto-fix-all`-related configuration (check `init-claude/setup_agents.md` and `init-claude/SKILL.md` for the right place — likely a new small step, since none of the existing scenario/setup files currently mention CI check filtering), ask the user:
```
Are there any CI check-runs that should never block a PR from being merged (e.g. informational bots, code-quality dashboards)? List any name patterns to ignore, or say none.
```
Write the answer to `.claude/configuration/auto-fix-all.json` as `{"ignored_check_patterns": [...]}` (empty array if the user says none — still write the file so it's clear this was asked and intentionally left empty, or skip writing entirely if empty; decide based on what's simpler and document the choice).

### Step 4 — Configure Arcanum's own repository

Create `.claude/configuration/auto-fix-all.json` in this repo with `{"ignored_check_patterns": ["Codacy"]}`, so removing the hardcoded array from `wait_ci.sh` doesn't reintroduce the hang-on-`action_required` bug fixed in issue #10 for this repo's own pipeline runs.

### Step 5 — Manual verification

Test `wait_ci.sh` against a real PR in this repo after the change, confirming Codacy is still ignored (reads from the newly-created config file) and the script still reports `passed`/`failed` correctly.

### Step 6 — Detect pre-approval from a body tags line too

Add `auto-fix-all/scripts/has_shipit_tag.sh <issue_file>`: reads the given local issue file, finds the last line matching `^[ \t]*tags:` case-insensitively, extracts every colon-delimited token on that line (e.g. `tags: :shipit: :+1: :some_tag:` → `shipit`, `+1`, `some_tag`), and exits 0 if any token equals `shipit` case-insensitively, exit 1 otherwise (including when no such line exists or the file doesn't exist).

Update `auto-fix-all/steps/process_next.md`'s Step 6 ("Check for pre-approval") to treat the issue as pre-approved when **either** `scripts/github.sh has-shipit-label <id>` exits 0 **or** `scripts/has_shipit_tag.sh <ISSUE_FILE>` exits 0 (resolve `ISSUE_FILE` the same way the "approved" branch of `monitor_pr.md` already does, via `../../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>`). Update the section's explanatory comment, which currently says pre-approval is *not* expressed via a "Tags:" line — that statement becomes outdated and must be corrected to describe the new dual-source check.

## Files to Change

- `.claude/configuration/auto-fix-all.json` (new, this repo's own config)
- `auto-fix-all/scripts/wait_ci.sh`
- `init-claude/SKILL.md` and/or a new/updated step file under `init-claude/` for asking about ignored CI patterns
- `auto-fix-all/scripts/has_shipit_tag.sh` (new)
- `auto-fix-all/steps/process_next.md`

## Notes

- No CI config of its own beyond GitHub's check-runs (GitGuardian, Codacy) exists in this repo; verification is manual, per Step 5.
- Script work (`wait_ci.sh`, `has_shipit_tag.sh`) goes through `scripter`; the `init-claude`/`process_next.md` prose updates and the new config file go through `architect`.
