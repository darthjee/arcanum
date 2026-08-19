# Skill-Writer Plan: auto-plan-issue should break down plans

Main plan: [plan.md](plan.md)

## Shared contracts

Depends on `scripter`'s new `auto-fix-issue/scripts/list_plan_steps.sh <plan_dir> <agent_name>` (prints each step file's relative path, one per line, sorted; prints nothing and exits 0 if the agent's plan is inline/unsplit). Reference it by that exact path and usage in `dispatch_agents.md`/`review_and_redispatch.md` — do not invent a different name or call signature.

Conventions to bake into every touched file, consistently:
- **Step file naming**: `<agent-name>/<NN>-<slug>.md`, two-digit zero-padded number + short descriptive slug (e.g. `01-add-users-endpoint.md`).
- **Split threshold**: split into per-step files only when an agent's plan has **more than 2 steps** (3+). For 1–2 steps, keep the step content inline in `<agent-name>.md` exactly as today — no subfolder, no separate files.
- **Content split** (only when split applies): `<agent-name>.md` keeps `Main plan:` link, `## Shared contracts`, an ordered `## Steps` list of links to the step files, `## CI Checks`, `## Notes`. Each `<agent-name>/<NN>-<slug>.md` is self-contained: the step's own description plus its own scoped `## Files to Change`.

## Implementation Steps

### Step 1 — `auto-plan-issue/steps/write_plan.md`: split step files when an agent has more than 2 steps

Update Case A2 (single owner) and Case B (multi-agent) — both currently render `<agent-name>.md` with a `## Implementation Steps` section holding every `### Step N — <Name>` inline. Add a per-agent decision after drafting the steps: count them.

- **≤2 steps**: keep today's behavior unchanged — `<agent-name>.md` has `## Implementation Steps` with the step bodies inline.
- **>2 steps**: instead of inlining, write:
  - `<agent-name>.md` — same header (`Main plan:` link) and `## Shared contracts` (Case B only) as today, but replace `## Implementation Steps` with `## Steps`: an ordered list of links, one per step, e.g. `- [01 — Add endpoint](<agent-name>/01-add-endpoint.md)`. Keep `## CI Checks` and `## Notes` in the index, scoped to the whole agent (not per-step).
  - `<agent-name>/<NN>-<slug>.md`, one per step — the step's own `### Step N — <Name>` body (now as the file's main content, no need for the `### Step N` heading itself since the filename+link already convey ordering/name — use a top-level `# <Name>` heading instead) plus a `## Files to Change` scoped only to that step (pull the subset of the agent's overall file list relevant to this specific step).

Update both example markdown templates in the file to show the new shape for the >2-steps case, alongside the existing ≤2-steps template (which stays as-is). Update the surrounding prose (the "Case A2" and "Case B" section text) to describe when each shape applies.

Case A1 (no owner, plain `plan.md`) gets the same >2-steps treatment for consistency, applied to `plan.md` itself acting as the index (steps move to `<issue-dir>/plan/<NN>-<slug>.md` when `plan.md` has more than 2 steps) — same rules, just rooted at `plan.md` instead of an agent's file, since a no-owner plan can grow just as large as any single agent's.

### Step 2 — `plan-issue/steps/write_and_confirm.md`: same split, interactive skill

Apply the identical threshold/shape rules from Step 1 to `write_and_confirm.md`'s plan-drafting template and prose, so `plan-issue` and `auto-plan-issue` produce byte-for-byte the same shape for the same input. `write_and_confirm.md`'s "Analyzing the codebase" section (which updates the plan with `## CI Checks` findings) needs to target the right file: the index (`plan.md` or `<agent-name>.md`) when split, the single file when not — call this out explicitly since it currently assumes one flat file.

### Step 3 — `auto-fix-issue/steps/dispatch_agents.md`: per-step execution loop

Replace the specialist-agent instruction block ("Read your plan file at `<path>`. Implement everything described in it.") with a per-step loop, keyed off whether the agent's plan is split:

1. Determine split vs. inline by running `list_plan_steps.sh <plan_dir> <agent_name>` (relative to `auto-fix-issue/scripts/`, per the shared contract above).
   - **No output** — inline plan. Follow today's flow unchanged (read `<agent-name>.md`, implement everything, checks, commit).
   - **One or more lines** — split plan. Follow the loop below.
2. Read the agent's index file (`<agent-name>.md`) first: `## Shared contracts`, the `## Steps` list, `## CI Checks`, `## Notes`.
3. For each step file path printed by `list_plan_steps.sh`, in the order printed — **do not read ahead into a later step's file**:
   - Read only that step file.
   - Implement it.
   - Commit via `scripts/commit_change.sh` (one commit per step, committed inside this loop, before checks have run).
4. Once every step is implemented and committed, run checks once: `scripts/run_checks.sh <agent-name>`.
5. If checks fail: fix, commit the fix(es) as additional commits (never amend the per-step commits), repeat until clean.
6. Report back as today (what was implemented, files changed, check results, commit hashes).

Keep the existing "no output from `list_plan_agents.sh` means no specialist owns any work" paragraph as-is — that's the outer, agent-level split, orthogonal to this inner, step-level split.

### Step 4 — `auto-fix-issue/steps/review_and_redispatch.md`: point re-dispatch at the specific step file

Update the "If something is wrong or missing" section: when re-dispatching an agent, always pass the agent's index file (`<agent-name>.md`) as before, and additionally run `list_plan_steps.sh <plan_dir> <agent_name>` to check whether the plan is split; when it is and the discrepancy can be traced to one or more specific steps, call out those step file path(s) by name directly in the re-dispatch instruction (e.g. "the field name in `backend/02-add-validation.md`'s payload doesn't match the contract — fix and re-commit via `scripts/commit_change.sh`"). Fall back to describing the fix in prose against just the index when it doesn't map cleanly to a specific step, or when the plan is inline.

## Files to Change
- `auto-plan-issue/steps/write_plan.md` — add the per-agent step-count check and the new split file templates (Cases A1, A2, B).
- `plan-issue/steps/write_and_confirm.md` — mirror the same split rules for the interactive skill.
- `auto-fix-issue/steps/dispatch_agents.md` — replace the specialist instruction block with the per-step read/implement/commit loop, keyed off `list_plan_steps.sh`.
- `auto-fix-issue/steps/review_and_redispatch.md` — re-dispatch instructions call out specific step file(s) via `list_plan_steps.sh` when identifiable.

## Notes
- Depends on `scripter`'s `list_plan_steps.sh` landing with the exact contract above — coordinate step file naming/output format if anything needs to change during implementation, and update this plan's Shared contracts section (and scripter's) to match.
- No CI job in `.circleci/config.yml` applies to these changes — `test`/`checks` are scoped to `core/` (Node.js) only, and this issue touches only skill markdown and a bash script outside `core/`.
