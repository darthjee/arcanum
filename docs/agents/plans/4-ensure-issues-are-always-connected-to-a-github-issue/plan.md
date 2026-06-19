# Plan: Ensure issues are always connected to a GitHub issue

Issue: [4-ensure-issues-are-always-connected-to-a-github-issue.md](../../issues/4-ensure-issues-are-always-connected-to-a-github-issue.md)

## Overview

Remove the `X##` local-only issue-id convention across the repo. Every issue id must be numeric and tied to a real GitHub issue. Interactive skills (`new-issue`) must ask the user for clarification when an id is missing, instead of inventing one. The fully autonomous `auto-new-issue` must mint a real GitHub issue itself when no numeric id is known. All other id-consuming scripts (`plan-issue`, `fix-issue`, `auto-plan-issue`, `auto-fix-issue`) must treat a non-numeric id as a hard error.

## Context

Currently `new-issue/scripts/resolve_id_and_file.sh` (and its copy in `auto-new-issue`) auto-assigns a local `X01`, `X02`, ... id when no numeric id/title is parseable from the arguments. These ids have no GitHub counterpart, breaking traceability. The fix removes this auto-assignment, adds a "missing id" status, and adds a `create` command to each `github.sh` to mint real GitHub issues on demand. Validation of non-numeric ids is added wherever an id is consumed downstream.

## Implementation Steps

### Step 1 — `new-issue/scripts/resolve_id_and_file.sh`

- Remove the `next_x_id` function entirely.
- Scenario B (bare arg text, no leading `#`): output `STATUS=missing_id` with `ID=` and `FILE=` empty, keeping `TITLE` set to the bare text if any.
- Add numeric validation: whenever a non-empty `ID` is parsed from `#<id>...` (Scenarios A and C), if it doesn't match `^[0-9]+$`, print `Error: issue id must be numeric and linked to a GitHub issue (got '<id>'). Local-only ids are no longer supported.` to stderr and `exit 1`, before any existing-file lookup.
- Remove Scenario A's `elif [[ "$ID" =~ ^X ]]` branch (now unreachable).
- Remove Scenario C's `else` (`needs_title`) fallback branch (now unreachable — C only ever ends in "existing" or "needs fetch").
- Update the header comment documenting `STATUS=` values to mention `missing_id` instead of `needs_title` for the no-id case.

### Step 2 — `new-issue/scripts/github.sh`

Add a `create <title> <file>` command, modeled on `cmd_update` (reuse `_load_origin`, `get_github_token`, `normalize_title`):
- POST to `https://api.github.com/repos/$_ORIGIN_REPO_PATH/issues` with `{"title": ..., "body": ...}` (body read from the given file).
- Parse the response's `.number` via `jq` for the new numeric id.
- Build `filepath="docs/agents/issues/${id}-$(normalize_title "$title").md"`, `mkdir -p docs/agents/issues`, write the body there (same pattern as `cmd_fetch`).
- Echo `ID=<id>`, `TITLE=<title>`, `FILE=<filepath>`, `DOMAIN=...`, `REPO=...`.
- Wire into the `case` dispatch and usage/help text.

### Step 3 — `new-issue/steps/extract_id_and_name.md` and `collect_and_save.md`

- Replace the `STATUS=needs_title` interpretation with `STATUS=missing_id`: tell the user `No GitHub issue ID was provided for this issue. Do you have an existing GitHub issue number, or should I create a new issue on GitHub now?` and wait.
  - If they give a number: re-run the resolve script with `#<id>` (+ title hint) and re-interpret from the top.
  - If they confirm creating a new issue: ask for a title if still unknown, then proceed to `collect_and_save.md`'s description flow with no `FILE` known yet.
- In `collect_and_save.md`: when `FILE` is unknown, write the drafted description to a temp file (`mktemp`) instead. On confirmation, if the id was already known, keep running `github.sh update <id> "<title>" <file>` as today; if the id was not known, run `github.sh create "<title>" <temp_file>` instead, report the new `ID`/`FILE` to the user, and stop (no separate update needed). Remove the two "auto-assigned `X##` placeholder" notes (they no longer apply).

### Step 4 — `new-issue/steps/file_definition.md`

Drop the `X01_add_login_page.md` example; add a sentence clarifying ids are always numeric and tied to a real GitHub issue.

### Step 5 — `plan-issue/steps/file_definition.md` and `fix-issue/steps/file_definition.md`

In each "Parse the issue ID" section, add: the id must be a plain numeric value; if a non-numeric value is given (e.g. legacy `X01`), stop immediately and report `Error: issue id must be numeric and linked to a GitHub issue.` — do not attempt to resolve or guess it.

### Step 6 — `auto-new-issue/scripts/resolve_id_and_file.sh` and `auto-new-issue/scripts/github.sh`

Apply the same edits as Steps 1 and 2 to this skill's own copies (kept self-contained, no shared lib).

### Step 7 — `auto-new-issue/SKILL.md`, `steps/write_issue.md`, `steps/commit_and_sync.md`

- `SKILL.md` Step 1: replace the `STATUS=needs_title` bullet with `STATUS=missing_id` — this skill never asks the user; if no title is known either, use `TODO: untitled issue`; proceed to Step 3 to draft content into a temp file (no `FILE` yet); Step 4 mints the real id before committing.
- `write_issue.md`: note that when `STATUS=missing_id`, content is written to a temp file (`mktemp`) instead of `FILE`.
- `commit_and_sync.md`: remove the "auto-assigned local ID (prefixed with X)" skip-sync paragraph. Add a new first sub-step "Mint the GitHub issue if needed": if `STATUS` was `missing_id`, run `scripts/github.sh create "<Title>" <temp_file>` before committing, use the returned `ID`/`FILE` for the commit, and skip the `update` sync entirely (the body is already canonical). Otherwise keep the existing commit-then-`update` flow.

### Step 8 — `auto-plan-issue/scripts/resolve_plan_paths.sh` and `auto-fix-issue/scripts/resolve_plan_paths.sh`

Right after `ID="${3:-}"` is parsed, add: if `ID` doesn't match `^[0-9]+$`, print `Error: issue id must be numeric and linked to a GitHub issue (got '<id>'). Local-only ids are no longer supported.` to stderr and `exit 1`. Apply identically to both copies — they must stay byte-identical.

### Step 9 — `auto-fix-issue/SKILL.md`

Change Step 1's "accept `5`, `#5`, or `X01` style local ids — strip the leading `#` if present" to "accept `5` or `#5` — strip the leading `#` if present. IDs must be numeric and correspond to an existing GitHub issue; `scripts/resolve_plan_paths.sh` enforces this."

### Step 10 — Sweep for leftover references

Grep the repo for `X##`, `X01`, `next_x_id`, and `needs_title` after the above changes to confirm nothing was missed (besides this plan/issue's own prose, which legitimately discusses the old convention historically).

## Files to Change

- `new-issue/scripts/resolve_id_and_file.sh`
- `new-issue/scripts/github.sh`
- `new-issue/steps/extract_id_and_name.md`
- `new-issue/steps/collect_and_save.md`
- `new-issue/steps/file_definition.md`
- `plan-issue/steps/file_definition.md`
- `fix-issue/steps/file_definition.md`
- `auto-new-issue/scripts/resolve_id_and_file.sh`
- `auto-new-issue/scripts/github.sh`
- `auto-new-issue/SKILL.md`
- `auto-new-issue/steps/write_issue.md`
- `auto-new-issue/steps/commit_and_sync.md`
- `auto-plan-issue/scripts/resolve_plan_paths.sh`
- `auto-fix-issue/scripts/resolve_plan_paths.sh`
- `auto-fix-issue/SKILL.md`

## Notes

- `auto-fix-all` is intentionally left untouched: it only stores ids as opaque strings in its queue file and delegates validation to the skills it calls downstream.
- No CI config exists in this repo (pure-markdown skills collection), so no `## CI Checks` section applies.
- `.sh` file changes should go through the `scripter` agent per this repo's established convention (architect commits `.md` changes directly, scripter writes/commits script changes), even though this plan was not split by `auto-plan-issue`'s agent-split logic.
