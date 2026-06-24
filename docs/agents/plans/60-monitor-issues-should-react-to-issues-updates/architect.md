# Architect Plan: Monitor issues should react to issues updates

Main plan: [plan.md](plan.md)

## Shared contracts

- Consumes `monitor-issues/scripts/rewrite_queue.sh pop` (created by `scripter`) to drain the queue of issue ids that need a `:pencil2:` rewrite.
- For each popped id: read the issue from GitHub, rewrite its body (same kind of rewrite `discuss-issue/steps/discuss_and_save.md` performs, but with no user interaction — no clarifying questions, no comprehension loop), push the updated body to GitHub, then remove the `pencil2` tag via `monitor-issues/scripts/github.sh remove-tag <id> pencil2`.

## Implementation Steps

### Step 1 — Create the `auto-rewrite-issue` skill folder
Following the `SKILL.md`-thin / `steps/run.md`-thick split documented in `docs/agents/architecture.md`'s "Architect Delegation" section (same shape as `auto-new-issue`, `auto-plan-issue`):

- `auto-rewrite-issue/SKILL.md` — frontmatter (`name: auto-rewrite-issue`, `description: ...`), thin body that spawns `Agent(subagent_type: "architect", prompt: "Read steps/run.md ... ARGUMENTS: <raw args>")` and relays its report. Decide invocation shape: most likely no user-facing args needed (it drains the whole queue), so `SKILL.md` just spawns the architect agent with no arguments.
- `auto-rewrite-issue/steps/run.md` — the actual instructions, written for an `architect` agent already running (no nested `Agent(architect)` spawn when called from inside `monitor-issues`'s own architect-level flow, per the same delegation rule).

### Step 2 — Write `steps/run.md`
Instructions to:
1. Loop: call `monitor-issues/scripts/rewrite_queue.sh pop` (resolved relative to `auto-rewrite-issue`, i.e. `../monitor-issues/scripts/rewrite_queue.sh pop`) until it returns empty/exit 1.
2. For each id popped:
   - Fetch the issue body (reuse `monitor-issues/scripts/github.sh` or `gh issue view <id> --json body -q .body` directly — confirm with `scripter` whether `monitor-issues/scripts/github.sh` should grow a `fetch-body`-style command, or whether this skill calls `gh` directly; prefer adding a thin command if `scripter`'s wrapper already needs similar fetch logic, otherwise call `gh` directly to avoid over-engineering a single call site).
   - Draft the rewritten body — same judgment call as `discuss-issue`'s step 2 (draft Description/Problem/Expected Behavior/Solution/Benefits sections from the current content), but fully autonomous: no clarifying questions, no "Did I comprehend the issue?" loop. Preserve any trailing `Tags:` block content other than removing `pencil2` itself (the tag removal happens in the next sub-step, not by hand-editing the block here).
   - Push the rewritten body via `gh issue edit <id> --body-file <tmpfile>` (or via a new `monitor-issues/scripts/github.sh update-body <id> <file>` command, if `scripter` would rather centralize it — default to calling `gh` directly here since this is a one-off, low-reuse call).
   - Remove the tag: `monitor-issues/scripts/github.sh remove-tag <id> pencil2` (already exists, resolved relative to `auto-rewrite-issue`'s folder as `../monitor-issues/scripts/github.sh`).
   - On any failure in this sequence (fetch, rewrite, push, or tag removal), leave the id off `issues.json`'s `updated_at` bookkeeping (it already is, since `scripter`'s change only ever wrote `updated_at` after a successful *push to the queue*, not after the rewrite) and log the failure — do not re-push to the queue from here; the issue stays out of `issues.json` until its `updated_at` from GitHub naturally exceeds what's stored (which is already true since pencil2 issues never got `updated_at` recorded while pending pencil2... actually re-check: confirm with `scripter` whether a *failed rewrite* should cause the id to be re-queued automatically vs. requiring a fresh GitHub update to re-trigger polling pickup. Default assumption for this plan: rely on the existing "not yet recorded in `issues.json`" state alone — no auto re-queue needed, since the next `monitor_issues.sh` poll will see the same un-recorded `updated_at` and re-detect the `pencil2` tag, re-pushing it to the queue).
3. Report a summary (ids processed, ids that failed) when the queue is drained.

### Step 3 — Update `docs/agents/architecture.md`
- In the "Issue Tags" section, update the `:pencil2:` / ✏️ paragraph: it currently says "the rewrite itself is architect-level (AI judgment)" with the action left unimplemented. Update it to describe the now-implemented flow: `monitor_issues.sh` pushes the id to `monitor-issues/scripts/rewrite_queue.sh`'s queue; the new `auto-rewrite-issue` skill drains that queue, rewrites the body, pushes it to GitHub, and removes the tag.
- Add a new row to the "Shared State & Configuration Files" table for `.claude/state/monitor-issues-rewrite-queue.json` (and its `.lock` counterpart), matching the existing `auto-fix-all-queue.json` row's style/schema description.
- Mention the new skill in `docs/agents/folder-structure.md` if that file enumerates skill folders (check first), and in the root `AGENTS.md`/`README.md` skill list/table if one exists (check both before editing — only touch the files that actually enumerate skills).

### Step 4 — Cross-check with `scripter`'s `pop` output contract
Before finalizing Step 2's parsing of `rewrite_queue.sh pop`'s output, confirm the exact format (bare id on stdout vs. JSON) against what `scripter` actually implemented, and adjust the parsing line accordingly.

## Files to Change
- `auto-rewrite-issue/SKILL.md` — new file.
- `auto-rewrite-issue/steps/run.md` — new file.
- `docs/agents/architecture.md` — update `:pencil2:` paragraph and add the new queue's row to the shared-state table.
- `docs/agents/folder-structure.md` — add the new skill folder, if that file lists skills individually.
- `AGENTS.md` / `README.md` — add the new skill to whatever skill listing exists, if any.

## Notes
- No CI config exists in this repo — no `## CI Checks` section.
- This plan deliberately keeps the rewrite skill manually invoked (`/auto-rewrite-issue`) rather than auto-looping like `monitor-issues`/`auto-fix-all`, since the issue only asks that the action "runs automatically" when monitor-issues detects the tag — interpreted here as "automatically queued and automatically rewritten once invoked," not necessarily "monitor-issues blocks waiting for the rewrite inline." If a tighter coupling (monitor-issues itself triggering the rewrite synchronously, no separate skill invocation) is preferred, that changes Step 1 significantly — flag this open question back during implementation/review rather than guessing further.
