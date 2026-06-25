# Plan: Review skills actions to add more scripts

Issue: [78-review-skills-actions-to-add-more-scripts.md](../issues/78-review-skills-actions-to-add-more-scripts.md)

## Overview

Review all skill step files across `~/.claude-favini/skills/` to identify prose actions that could be replaced by explicit script calls, then implement the identified scripts (scripter) and update the skill markdown files to call them (architect).

## Context

The architecture rule states that deterministic logic should live in scripts under `<skill>/scripts/`, not in markdown prose that agents re-interpret on every run. Several skill step files currently describe file-finding, directory-creation, or other deterministic operations in natural language instead of calling a concrete script. This review identifies those gaps and closes them.

## Investigation Findings

After reviewing all skill step files, the following prose actions were identified as candidates for script extraction:

### Finding 1 — `plan-issue/steps/file_definition.md`: issue/plan path resolution

The step describes in prose how to:
- Strip a `#` prefix from the ID argument
- Search `docs/agents/issues/` for a file starting with the given ID
- Derive the plan folder name from the issue filename
- Check whether the plan folder/file already exists

This is exactly what `auto-plan-issue/scripts/resolve_plan_paths.sh` already does. `plan-issue` should call that script via a relative path instead of describing the logic in prose.

**No new script needed** — use `../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>` and parse `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, `PLAN_EXISTS` from its output.

### Finding 2 — `init-claude/setup_docs_structure.md`: docs directory creation

Step 1 describes in prose creating the following files with fixed placeholder content:
- `docs/agents/issues/.gitkeep`
- `docs/agents/plans/.gitkeep`
- `docs/agents/architecture.md` (placeholder text)
- `docs/agents/flow.md` (placeholder text)

And Step 2 describes appending a Documentation section to `AGENTS.md` conditionally.

Both steps are deterministic and should be extracted to a script `init-claude/scripts/setup_docs_structure.sh`.

## Implementation Steps

### Step 1 — Update `plan-issue/steps/file_definition.md`

Replace the prose description of ID parsing, issue file search, and plan-path derivation with a call to the existing `resolve_plan_paths.sh`. The updated step should:
1. Run `../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>`
2. Parse `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, `PLAN_EXISTS` from the output
3. If the script fails, stop and report the error
4. If `PLAN_EXISTS=true`, read existing plan files and skip to the "Present an overview" section

### Step 2 — Create `init-claude/scripts/setup_docs_structure.sh`

Scripter creates a new script at `init-claude/scripts/setup_docs_structure.sh`. The script must:
- Create `docs/agents/issues/` and `docs/agents/plans/` with `.gitkeep` files (only if they don't already exist)
- Create `docs/agents/architecture.md` with the standard placeholder content (only if it doesn't exist)
- Create `docs/agents/flow.md` with the standard placeholder content (only if it doesn't exist)
- Append the standard Documentation section to `AGENTS.md` if no `## Documentation` section is present
- Print a summary of what was created vs. already existed

The placeholder content for each file should match what `setup_docs_structure.md` currently describes verbatim.

### Step 3 — Update `init-claude/setup_docs_structure.md`

Replace Steps 1 and 2 with a single script invocation:
```bash
scripts/setup_docs_structure.sh
```
Relay the script's output to the user.

## Files to Change

- `plan-issue/steps/file_definition.md` — replace prose file-finding with `resolve_plan_paths.sh` call (Finding 1)
- `init-claude/setup_docs_structure.md` — replace Steps 1–2 with `scripts/setup_docs_structure.sh` call (Finding 2)
- `init-claude/scripts/setup_docs_structure.sh` ← **new file** (Finding 2, created by scripter)

## Notes

- `plan-issue` has no `scripts/` folder — no new script is needed for Finding 1 since `resolve_plan_paths.sh` already exists in `auto-plan-issue/scripts/`. The fix is purely a markdown update.
- `auto-rewrite-issue/steps/run.md` calls `gh issue view` and `gh issue edit` directly; these are deliberately not scripted (the file itself labels them "one-off, low-reuse calls"). They are not candidates.
- Future reviews: after any new skill is added or a step file is changed, the `skill-reviewer` agent should be invoked on the changed files to catch new prose-action violations before they merge.
