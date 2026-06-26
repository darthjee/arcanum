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

And appends the standard `## Documentation` section to `AGENTS.md` if that section is not already present.

## Step 2 — Confirm

Relay the script's output to the user, then tell them:

```
Fill in architecture.md and flow.md with your project details.
```
