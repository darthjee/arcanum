# Issue: Create-issue: skill files

## Description

Part of epic #687. Write the `/arcanum-create-issue` skill files on top of the native `arcanum-create-issue-start` / `arcanum-create-issue-publish` commands shipped in #690 (shims in `arcanum-create-issue/scripts/start.sh` and `publish.sh`) and the `Epic` label shipped in #689. The contract is [`docs/agents/specs/arcanum-create-issue.md`](../specs/arcanum-create-issue.md) — sections "Draft file", "Skill flow and reuse of enhance-issue", "Label rules", "Prompts" (including the exact `AskUserQuestion` wording) and "Edge cases".

## Problem

There is no skill to create a brand-new GitHub issue through a guided interview: `enhance-issue` and `discuss-issue` only work on issues that already exist. The native commands that create drafts and publish issues are in place, but nothing drives them.

## Expected Behavior

- `/arcanum-create-issue` (no arguments) runs end to end: start/resume a draft, take the initial idea, run the checklist dialogue, confirm, and create a labeled GitHub issue.
- The next-step offer is `/arcanum-split-issue <id>` when `EPIC=true`, otherwise `/discuss-issue <id>`.
- The skill never touches git (no commit, no safe-branch checkout, no dirty-tree check). The draft lives in `.claude/state/create-issue/`, is deleted by `publish.sh` only on success, and is kept on abandon or failure.
- Every exit-4 (`FALLBACK=chat`) from `start.sh`, `publish.sh` and `next_step_prompt.sh` is handled with the exact `AskUserQuestion` wording from the spec.

## Solution

New `arcanum-create-issue/SKILL.md` (with `name`/`description` frontmatter) and `arcanum-create-issue/steps/*.md`, modeled on `enhance-issue` (which is **not** changed):

- `steps/start.md` — replaces `enhance-issue/steps/fetch.md`. Calls `scripts/start.sh "$REPO_PATH"`; on `STATUS=error` prints the `failed` report and ends. On exit 4 asks prompt 1 (resume one of the three most recent drafts, or start new; older drafts reachable only via the free-text "Other" answer by typing the path — no paging) and reruns with `--resume <path>` or `--new`. On a fresh draft, asks for the initial idea in open chat (prompt 2).
- `steps/explore.md` — same light pass as `enhance-issue/steps/explore.md`, run on the initial idea.
- `steps/dialogue.md` — same checklist loop from `docs/agents/issue-enhancement.md`, plus two fixed items: **Epic?** and **Labels** (prompt 4, `AskUserQuestion`: Epic yes/no, and a multi-select with `Writting` pre-selected and the hardcoded suggestions `Documentation`, `Feature`, `Refactor`, `Bug`, `Epic`, `shipit` suggested; `Epic` kept in sync with the Epic? answer; `shipit` never suggested by the AI). The draft keeps the title as its first `# Title` heading. Never calls `spawn_issue.sh`; independent parts → suggest marking it `Epic`. Abandon keeps the draft and prints `declined` naming the draft path.
- `steps/publish.md` — calls `scripts/publish.sh "$REPO_PATH" <draft> "<title>" <labels...>`, handles exit 4 for prompt 5 (rerun with `--confirmed`; "No" → back to the dialogue; "Chat" → return to the conversation with the draft kept and the run still open — no report yet, so the user can keep refining and publish later in the same run) and prompt 6 (`shipit`, safe choice first; rerun with `--shipit-confirmed`, or without `shipit` among the labels). Exit 2 (empty title/body, bad label) → back to the dialogue. `STATUS=failed` → `failed` report, draft kept. `STATUS=ok` → `success` report with `--issue <ID>`, the applied labels, any `WARNING=` lines surfaced, and a note when `shipit` was dropped; then the Epic-based next-step offer via `next_step_prompt.sh` with its exit-4 fallback.

Docs: README skill list, `AGENTS.md`, `docs/agents/folder-structure.md`, `docs/agents/architecture/skill-finish.md` (new skill and its next-step rule), and the flow/pipeline docs that list entry points; update the spec status for #691 and resolve its open points (prompt 5 "Chat" keeps the run open; older drafts via "Other" only; suggestions stay hardcoded).

`shipit` rule reword (owned by this issue): "`shipit` is human-only and never mutated by any script" becomes "`shipit` is never applied without an explicit human choice" — edit `docs/agents/architecture/issue-tags.md` by hand, change the sentence in `scripts/generate_tags_table.sh`, and regenerate `docs/agents/tag-mutations.md` (never edit it by hand). `arcanum/_lib/tag_mutate.sh` keeps refusing `shipit`.

## Benefits

- New issues can be written with the same guided dialogue as `enhance-issue`, without first creating a bare issue on GitHub by hand.
- Epics are flagged at creation time and routed straight to `/arcanum-split-issue`.

## Acceptance criteria

- [ ] `/arcanum-create-issue` runs end to end and creates a labeled GitHub issue (manual run: one Epic and one normal issue)
- [ ] The next-step offer depends on the Epic choice
- [ ] skill-reviewer passes: no complex inline bash, and every exit-4 fallback is handled
- [ ] Docs list the new skill
- [ ] The `shipit` rule is reworded and `tag-mutations.md` is regenerated
