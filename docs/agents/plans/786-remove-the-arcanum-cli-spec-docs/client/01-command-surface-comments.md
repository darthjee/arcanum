# Command-surface and runtime comments

Repoint the comments that cite `specs/arcanum-cli.md` (the index) or `specs/arcanum-cli/command-surface.md`, using the targets in `docs/agents/architecture/arcanum-cli.md`.

## Files to Change
- `cli/bin/arcanum`: `specs/arcanum-cli.md#runtime` → `architecture/arcanum-cli.md#runtime-path`
- `cli/lib/args.js`: `command-surface.md#syntax-rules` → `architecture/arcanum-cli.md#syntax-rules`
- `cli/lib/values.js`, `cli/spec/lib/values_spec.js`: `command-surface.md#value-parsing` → `architecture/arcanum-cli.md#value-parsing`
- `cli/lib/tierFiles.js`: `command-surface.md#missing-and-malformed-tier-files` → `architecture/arcanum-cli.md#missing-and-malformed-tier-files`
- `cli/lib/target.js`: the index plus `command-surface.md#--repo-normalization` → `architecture/arcanum-cli.md#targeting` and `#repo`
- `cli/lib/skew.js`: the index's version skew section → `architecture/arcanum-cli.md#version-skew`
- `cli/lib/exitCodes.js` (line 2): `command-surface.md` → `architecture/arcanum-cli.md#exit-codes`
- `cli/lib/writeTier.js`: `command-surface.md` → `architecture/arcanum-cli.md#refusal-order`, and reword "spec's precedence order"
- `cli/lib/output.js`: the command-surface output sections → `architecture/arcanum-cli.md#output`
