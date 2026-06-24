# Architect Plan: Add Discuss Issue Skill

Main plan: [plan.md](plan.md)

## Shared contracts

- `discuss-issue/scripts/github.sh` — same interface as `new-issue/scripts/github.sh`; referenced from steps as `../scripts/github.sh`
- `discuss-issue/scripts/resolve_id_and_file.sh` — same interface as `new-issue/scripts/resolve_id_and_file.sh`; referenced from steps as `../scripts/resolve_id_and_file.sh`

## Implementation Steps

### Step 1 — Create discuss-issue/SKILL.md

Create `discuss-issue/SKILL.md` with frontmatter (`name: discuss-issue`, `description: ...`) and the same step structure as `new-issue/SKILL.md` but referencing the new steps files.

Content:
- Step 1: define issue ID and filename — read `steps/file_definition.md`
- Step 2: interactive dialogue — read `steps/discuss_and_save.md`

### Step 2 — Copy steps/file_definition.md from new-issue

Copy `new-issue/steps/file_definition.md` verbatim into `discuss-issue/steps/file_definition.md`. It references `extract_id_and_name.md` — also copy that file.

### Step 3 — Copy steps/extract_id_and_name.md from new-issue

Copy `new-issue/steps/extract_id_and_name.md` (if it exists) verbatim into `discuss-issue/steps/extract_id_and_name.md`.

### Step 4 — Create discuss-issue/steps/discuss_and_save.md

This is the core difference from `new-issue`. Write a new file `discuss-issue/steps/discuss_and_save.md` that:

1. **Pre-populate from GitHub** (if Scenario C2 — fetched body): use that body as starting material; skip "ask for description".
2. **Ask for initial description** (if no pre-populated content): say "Describe me the issue" and wait.
3. **Initial evaluation**: write a draft issue file (same template as `new-issue/steps/collect_and_save.md`) based on what is known so far.
4. **Spawn specialist agents** (optional): based on the issue content, the architect may spawn specialist agents (e.g., an Explore agent to look at relevant code, a domain expert) to gather context before asking questions.
5. **Generate clarifying questions**: based on the draft and any agent findings, generate a list of clarifying questions for the user.
6. **Present questions and wait**: show questions to the user and wait for answers.
7. **Update draft**: incorporate answers into the issue file.
8. **Loop**: after updating, ask `Did I comprehend the issue?`. If the user confirms (yes / sim / correct / looks good or similar): finish. If not: loop back to step 5 (generate new questions or ask for more detail). If the user explicitly ends the discussion (e.g., "done", "stop", "that's enough"): finish without re-asking.
9. **Update GitHub issue**: same logic as `new-issue/steps/collect_and_save.md` — run `../scripts/github.sh update` or `../scripts/github.sh create` depending on whether an ID was already known.

## Files to Change

- `discuss-issue/SKILL.md` — create (new skill entry point)
- `discuss-issue/steps/file_definition.md` — create (copy from new-issue)
- `discuss-issue/steps/extract_id_and_name.md` — create (copy from new-issue, if exists)
- `discuss-issue/steps/discuss_and_save.md` — create (new file, core of the skill)

## Notes

- The issue says "copy scripts — not symlinked — new-issue will be deprecated in the future". The scripter handles the script copies; the architect just writes the markdown.
- Do not modify `new-issue` — this is a separate, parallel skill.
- Use relative paths for all script references inside steps (e.g. `../scripts/github.sh`).
- The dialogue loop must have a clear exit condition: either user confirms comprehension, or user explicitly ends the discussion.
