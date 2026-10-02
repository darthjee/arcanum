# Docs

- `docs/agents/architecture/issue-tags.md`: extend the `epic` paragraph. `monitor-issues` skips Epics (neither queue), `/push-issue-to-queue` refuses them, and `auto-fix-all` skips them before processing, all through `has-label`.
- `docs/agents/specs/arcanum-create-issue.md`: mark #692 shipped in Status. In "Automation skips Epics", add the rewrite-queue skip to the `monitor-issues` row (note that state is still recorded) and describe the `auto-fix-all` check as running after `wait-next` (the queue is peeked, then popped). Resolve the "Where `has-label` lives natively" open point: one `auto-fix-all-github-has-label` command, with `has-shipit-label` as a `github.sh`-only alias.
- `docs/agents/architecture/entrypoint-migration-status.md`: replace the `auto-fix-all-github-has-shipit-label` row with `auto-fix-all-github-has-label` (Yes, #692).

## Files to Change
- `docs/agents/architecture/issue-tags.md` — `epic` paragraph.
- `docs/agents/specs/arcanum-create-issue.md` — Status, table, open point.
- `docs/agents/architecture/entrypoint-migration-status.md` — row swap.
