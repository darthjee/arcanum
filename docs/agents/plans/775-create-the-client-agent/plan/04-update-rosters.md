# Update rosters and folder structure

Add `client` and update `infra` everywhere the agent roster is listed:

- `docs/agents/architecture/agent-roster-and-delegation.md`: new `client` row (scope: all of `cli/` plus its architecture doc and user guide; dispatched whenever the CLI's source, specs, build or package manifest need work). Update the `infra` row to include `.circleci/` and the CI jobs. Add a short paragraph on the `node`/`client` shared-surface boundary (like the existing native-only skills paragraph).
- `AGENTS.md`: add the `client` row to the agent table; update the `infra` row with `.circleci/`.
- `.claude/agents/architect.md`: add the `client` row to its "Specialist agents" table; update the `infra` row.
- `docs/agents/folder-structure.md`: add a `cli/` row — user-facing `arcanum` CLI npm package (`arcanum-cli`), owned by `client`, created by #779, kept out of the release zip; bundles the `core/lib` shared config surface with `esbuild`. Update the `.circleci/` row to say it is owned by `infra`.

## Files to Change
- `docs/agents/architecture/agent-roster-and-delegation.md` — `client` row, `infra` row, boundary paragraph.
- `AGENTS.md` — agent table.
- `.claude/agents/architect.md` — specialist agents table.
- `docs/agents/folder-structure.md` — `cli/` row, `.circleci/` owner.
