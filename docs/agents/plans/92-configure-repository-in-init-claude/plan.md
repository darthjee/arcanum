# Plan: Configure repository in init claude

Issue: [92-configure-repository-in-init-claude.md](../issues/92-configure-repository-in-init-claude.md)

## Overview

Add a final step to `init-claude` that ensures the repository has a standard set of GitHub issue labels, with the expected colors. A new script prints the label table and interactively confirms with the user (`y`/`n`/`yes`/`no`), then syncs the confirmed labels to GitHub (`gh label create`/`gh label edit`) on `yes`. On `no`, the calling step file clarifies with the user whether to refine the list or skip syncing for this run, then re-invokes the script.

## Context

`init-claude/SKILL.md` currently ends at Step 9 ("Setup CI monitoring options", `setup_ci_monitoring.md`). Other Arcanum skills key off GitHub labels (`shipit`, `Enqueued`, `Working`, `Ready`, `Created`, etc.) for automation, but nothing ensures those labels exist with consistent colors in a newly initialized repo. Per `docs/agents/architecture.md`'s "Script Preference", the deterministic parts (printing the table, prompting, talking to GitHub) belong in a script; the step markdown only orchestrates the refinement loop and interprets the script's outcome.

This is the one case in the skill set where the *script itself* does the interactive y/n/yes/no prompting (per the issue's explicit requirement), rather than the more common pattern of the agent asking in chat and passing the reply to a `confirm.sh`-style resolver — call this out explicitly in the step file so future readers aren't confused by the inconsistency.

## Implementation Steps

### Step 1 — `init-claude/scripts/sync_labels.sh`

New script, sourcing `_lib/origin.sh` (for `get_repo_ref`) the same way `auto-fix-all/scripts/github.sh` does.

CLI contract:
```
sync_labels.sh <Label1>:<color1> [<Label2>:<color2> ...]
```
- Each argument is `<label name>:<hex color>` (color without a leading `#`, e.g. `Bug:b60205`) — colors are required for every entry at this point (the step file is responsible for prompting the user to fill in any `null` colors before invoking the script; see Step 2).
- Validates: at least one pair given; each color is exactly 6 hex digits. On invalid input, print a usage error to stderr and exit 2 (a distinct code from the "no" path below, so the caller never confuses a malformed call with a real "no" answer).
- Prints the table to stdout as a markdown table (`| Label | Color |` header, one row per pair, color shown as `#<hex>`).
- Prompts on stdout: `Sync these labels to GitHub? [y/n]: ` and reads a line from stdin. Accepts `y`, `yes`, `n`, `no` case-insensitively; re-prompts on anything else (do not exit on invalid input here — this is the one script in the repo allowed to do its own interactive I/O, per the issue).
- **On yes**: resolve `REPO=$(get_repo_ref)`. Fetch existing label names via `gh label list -R "$REPO" --json name -q '.[].name'`. For each pair: if the name is in the existing set, run `gh label edit "<name>" -R "$REPO" --color "<hex>"`; otherwise run `gh label create "<name>" -R "$REPO" --color "<hex>"`. Print `STATUS=synced` followed by one `CREATED=<name>` or `UPDATED=<name>` line per label, then exit 0.
- **On no**: print `STATUS=discuss` and exit 1 — no GitHub calls made.

### Step 2 — `init-claude/setup_labels.md`

New step file, following the shape of `setup_ci_monitoring.md`.

- Defines the default label table (the 9 rows from the issue) inline.
- Renders the current table to the user (Label, Color columns; `null` for any label without a color yet) and shows the confirmation prompt is about to run.
- Invokes `scripts/sync_labels.sh` with the current table (only once every label has a non-null color — see refinement loop below) and interprets its output:
  - `STATUS=synced`: report the created/updated labels to the user and finish this step.
  - `STATUS=discuss` (exit 1): ask the user directly — "Would you like to change the label list, or skip label syncing for this run?" (open question, not a script). 
    - If they want to skip: finish this step with no further action, no GitHub calls.
    - If they want to change the list: enter the refinement loop below, then re-invoke the script with the updated table.
- Refinement loop (only entered from the "change the list" branch above, or when the table has any `null` color that must be resolved before the script can run): show the current table and let the user, in a loop, add a label (color optional), remove a label, update a label's color, replace one or more entries, or replace the whole table (colors optional at that point) — until the user says they're satisfied. Once satisfied, if any label still has a `null` color, ask for it directly before invoking the script (the script itself requires a color per label).
- Nothing is persisted to `.claude/configuration/` or anywhere else — this step performs a live, one-shot sync each `init-claude` run, always starting from the hardcoded default table.

### Step 3 — Wire into `init-claude/SKILL.md`

Add:
```markdown
## Step 10 — Setup repository labels

After the CI monitoring options are set up, read and follow [setup_labels.md](setup_labels.md).
```
right after the existing Step 9 block.

## Files to Change
- `init-claude/scripts/sync_labels.sh` — new script (Step 1 above). **Owner: `scripter`.**
- `init-claude/setup_labels.md` — new step file (Step 2 above). **Owner: `architect`.**
- `init-claude/SKILL.md` — add Step 10 wiring (Step 3 above). **Owner: `architect`.**

## Notes
- No CI config (`.github/workflows/*`, `.circleci/config.yml`) exists in this repo, so there is no `## CI Checks` section to add.
- `gh label edit` unconditionally sets the color on every existing label in the confirmed table, even if the color is already correct — this is idempotent and matches the issue's "if they exist, updates the color" wording; no need to diff colors first.
- Only `scripter` and `architect` have work here; `skill-reviewer` is a read-only PR reviewer, not an implementation agent, so it's excluded from the split (see `docs/agents/architecture.md`'s Agent Roster). Since exactly one non-coordinator agent (`scripter`) has dedicated implementation work, this plan stays a single `plan.md` (no per-agent split) per `auto-plan-issue`'s `determine_agents.md`.
