# Delete the spec and verify
Delete `docs/agents/specs/arcanum-create-issue.md` with `git rm`. Then check that:
- `git grep -n "specs/arcanum-create-issue"` returns nothing outside `docs/agents/issues/` and `docs/agents/plans/`
- every rule in the deleted spec that still applies can be found under `docs/agents/architecture/`, either in the new doc or in `issue-tags.md`, `skill-finish.md`, `script-engine.md` or `entrypoint-migration-status.md`
- `cd core && yarn lint` passes

## Files to Change
- `docs/agents/specs/arcanum-create-issue.md`: deleted
