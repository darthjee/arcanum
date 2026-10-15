# Update shared-config-logic.md and the index

- **`shared-config-logic.md` open point.** Add one: `agents email` needs the per-tier, two-key agent-email resolution. Today it exists in `arcanum/_lib/agent_email.sh` and as private `_agentEmailGet` methods in the `core/lib` commit commands (e.g. `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js`). It should be extracted into one shared `core/lib` helper on the declared shared surface, owned by `node`, so the CLI and commits cannot disagree.
- **Index `arcanum-cli.md`, summary line.** Update the one-line summary of Shortcuts and Setup to mention:
  - the `agents email` per-agent detail;
  - the repo-only `ignore-checks` add/remove;
  - the sectioned, registry-driven wizard.
- **Index, "Pieces introduced" table.** Add the shared agent-email helper, with owner `node`, as a proposed piece that follows the open point.
- **Cross-links.** Check every cross-link between the four files and the index after steps 01–03.

## Files to Change
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` — agent-email helper open point.
- `docs/agents/specs/arcanum-cli.md` — summary line and "Pieces introduced" row.
