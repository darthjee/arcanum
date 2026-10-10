# Tick the checklist rows

In `docs/agents/specs/docker/checklist.md`, set the 29 batch-1 rows' status cell to ✅ and their `issue` cell to `#745`. Add the `notes` from [plan.md](../plan.md#shared-contracts):

- `dispatch-fixture-crash`: append that it has no shim-level routing spec (test fixture, no shim), that it is covered by the dispatch-level specs, and that it has a parity case under `core/spec/docker/`.
- `auto-fix-all-queue-wait-next`: append that the parity case seeds the queue first so the blocking call returns at once.

If `docs/agents/specs/docker.md` or `docs/agents/plans`-independent docs keep a migrated-count summary (e.g. "79 `native`, 1 `docker`"), update the counts.

## Files to Change

- `docs/agents/specs/docker/checklist.md`: 29 rows ticked, 2 notes added.
- `docs/agents/specs/docker.md`: only if it states migration counts.
