# Documentation
Document the new subcommand:
- In `docs/agents/architecture/arcanum-cli.md`, add `arcanum config doctor` to the generic-commands synopsis block and a **`doctor`** bullet. Add a short `## config doctor` section covering the problem kinds, what is skipped (read-only keys, `null`, empty objects), the exit codes `0`/`3`/`7` and their priority, and the JSON shape. Also mention `doctor` wherever the doc lists the JSON output per command.
- In `cli/README.md`, add it to the command synopsis list. Where the README explains `(ignored: tier not allowed)` (line ~62), point to `config doctor` as the way to find every ignored value at once, and add a short example.
- In `docs/guides/arcanum-cli.md`, in the paragraph about values in disallowed tiers (line ~70), add `arcanum config doctor` as the way to find them all.

## Files to Change
- `docs/agents/architecture/arcanum-cli.md` — the synopsis, the bullet, a new section, and the JSON output.
- `cli/README.md` — the synopsis, a pointer from the ignored-values paragraph, and an example.
- `docs/guides/arcanum-cli.md` — a pointer from the ignored-values paragraph.
