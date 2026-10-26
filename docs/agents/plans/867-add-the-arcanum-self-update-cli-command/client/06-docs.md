# Docs and spec touch-ups

Update the docs listed in the spec's "Docs the implementation updates" table, and the spec itself:

- `docs/guides/arcanum-cli.md`: Setup gets an "Updating the CLI" paragraph (`arcanum self-update`, the refused cases, the EACCES advice); Troubleshooting covers exit `8`, exit `130`, and `self-update`'s exit `4`; the exit `5` entry may mention `arcanum self-update`.
- `cli/README.md`: one line under install, `arcanum self-update` updates it later.
- `docs/agents/architecture/arcanum-cli.md`: Commands (`self-update`), the Exit codes table (`8` `npm`, `130` `interrupted`), JSON output (the `status` object), Module layout (`cli/lib/commands/selfUpdate.js`, `cli/lib/npm.js`), and the version-skew section if it describes the comparison (now semver precedence).
- `docs/agents/specs/cli-install/self-update.md`: Names gains `cli/lib/npm.js` and `InterruptedError` / `interrupted` rows; the Exit codes table's `130` row names `interrupted`; correct anything else the implementation proved wrong.

The `cli/lib/skew.js` hint text (`npm i -g arcanum-cli@latest`) stays unchanged.

## Files to Change
- `docs/guides/arcanum-cli.md` — updating the CLI, troubleshooting.
- `cli/README.md` — the `self-update` line.
- `docs/agents/architecture/arcanum-cli.md` — commands, exit codes, JSON output, module layout.
- `docs/agents/specs/cli-install/self-update.md` — Names and the `130` row.
