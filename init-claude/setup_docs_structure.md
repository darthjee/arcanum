# Setup Documentation Structure

Create the standard `docs/agents/` directory structure and register it in `AGENTS.md`.

## Step 1 — Run the script

Run, resolving `scripts/setup_docs_structure.sh` relative to this file's directory:

```bash
scripts/setup_docs_structure.sh
```

The script creates (skipping anything that already exists):

- `docs/agents/issues/.gitkeep`
- `docs/agents/plans/.gitkeep`
- `docs/agents/architecture.md` (placeholder)
- `docs/agents/flow.md` (placeholder)
- `docs/agents/issue-enhancement.md` (placeholder)
- `docs/agents/arcanum-split-issue.md` (placeholder)
- `docs/agents/specs.md` (specs index, copied from `templates/specs.md`)
- `docs/agents/specs/.gitkeep` (only when `docs/agents/specs/` is missing or empty)

And appends the standard `## Documentation` section to `AGENTS.md` if that section is not already present. The section is copied from `templates/agents-documentation-section.md` and links the specs index (`docs/agents/specs.md`).

The script never edits an existing `docs/agents/specs.md` or an existing `## Documentation` section.

## Step 2 — Confirm

Relay the script's output to the user. If the script wrote any `Note:` or `Warning:` lines to stderr, relay them to the user as-is — in particular the instruction to add the Specs row and the `### Specs` subsection to `AGENTS.md` by hand. Do not edit `AGENTS.md` or `docs/agents/specs.md` yourself to resolve them.

Then tell the user:

```text
Fill in architecture.md and flow.md with your project details.
```
