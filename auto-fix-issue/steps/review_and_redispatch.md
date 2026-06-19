# Review the Results and Re-dispatch if Needed

When all dispatched agents (or yourself, for an unsplit plan) report back:

1. Read the changed files to verify the implementation matches each agent's plan file.
2. Check that every agent confirmed all tests and lint/checks passed. If an agent reports a failure it did not resolve, treat this as incomplete work.
3. When `PLAN_FILE` has a `## Shared contracts` section (multi-agent plans only), verify that what crosses the boundary between agents — API shape, payload fields, schema, config keys, URLs, or any other interface — was implemented consistently across all of them. Read the relevant files from each agent's changes side by side if needed.
4. Confirm every agent actually committed (via `scripts/commit_change.sh`) rather than leaving uncommitted changes.

## If something is wrong or missing

Re-dispatch only the specific agent(s) responsible, with the same `subagent_type` and plan file path as before, and a single-step instruction describing precisely what to fix (e.g. "the `/users` endpoint plan calls for a `created_at` field but the frontend plan in `plan.md`'s Shared contracts expects `createdAt` — align the field name with the contract and re-commit via `scripts/commit_change.sh`"). Use the same commit instructions as in [dispatch_agents.md](dispatch_agents.md).

Repeat the review until the implementation is correct and complete, with no outstanding issues and every agent's work committed.

Do not ask the user anything during this loop — resolve discrepancies yourself based on the plan and the shared contracts.
