# Review the Results and Re-dispatch if Needed

When all dispatched agents (or yourself, for an unsplit plan) report back:

1. Read the changed files to verify the implementation matches each agent's plan file.
2. Check that every agent confirmed all tests and lint/checks passed. If an agent reports a failure it did not resolve, treat this as incomplete work.
3. When `PLAN_FILE` has a `## Shared contracts` section (multi-agent plans only), verify that what crosses the boundary between agents — API shape, payload fields, schema, config keys, URLs, or any other interface — was implemented consistently across all of them. Read the relevant files from each agent's changes side by side if needed.
4. Confirm every agent actually committed (via `scripts/commit_change.sh`) rather than leaving uncommitted changes.

## If something is wrong or missing

Re-dispatch only the specific agent(s) responsible, with the same `subagent_type` and index plan file path (`<agent-name>.md`) as before. Use the same commit instructions as in [dispatch_agents.md](dispatch_agents.md).

Before drafting the re-dispatch instruction, run `scripts/list_plan_steps.sh <plan_dir> <agent_name>` (resolved relative to the `auto-fix-issue` skill folder's `scripts/` folder) for the agent being re-dispatched, to check whether its plan is split:

- **No output** — the plan is inline. Describe the fix in prose against the single `<agent-name>.md` file, as before (e.g. "the `/users` endpoint plan calls for a `created_at` field but the frontend plan in `plan.md`'s Shared contracts expects `createdAt` — align the field name with the contract and re-commit via `scripts/commit_change.sh`").
- **One or more lines** — the plan is split. If the discrepancy can be traced to one or more specific steps, call out those step file path(s) by name directly in the re-dispatch instruction (e.g. "the field name in `backend/02-add-validation.md`'s payload doesn't match the contract — fix and re-commit via `scripts/commit_change.sh`"), so the agent only re-reads and re-implements the affected step(s) rather than the whole plan. Fall back to describing the fix in prose against just the index file (`<agent-name>.md`) when the discrepancy spans multiple steps or doesn't map cleanly to any specific one.

Either way, remind the re-dispatched agent to commit any fix as a new commit via `scripts/commit_change.sh` — never amend a previous commit.

Repeat the review until the implementation is correct and complete, with no outstanding issues and every agent's work committed.

Do not ask the user anything during this loop — resolve discrepancies yourself based on the plan and the shared contracts.
