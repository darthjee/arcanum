# Shortcuts, setup wizard, alternatives and future work

1. **Shortcuts.** From [Shortcuts and Setup](../../../specs/arcanum-cli/shortcuts-and-setup.md), checked against `cli/lib/commands/config/shortcuts/*.js`:
   - the shortcut set, each with its key and default tier (`defaultTier.js`);
   - the design rules: no value reads, a value writes, `--unset`, the tier flags allowed per key, toggles taking `on`/`off`/`true`/`false`, and `off` storing `false`;
   - the output (identical to the generic equivalents, and the stderr override note);
   - `agents email`: resolution, which agents are listed, the listing and detail formats, and writes;
   - `ignore-checks`: repo tier only, case-insensitive regex validation, add/remove/list.

   Replace the "The contract is [Shortcuts and Setup](…)" pointer and keep the existing design-point bullets.
2. **Setup wizard.** Checked against `cli/lib/commands/config/setup.js` and `setup/*.js`:
   - coverage and the fixed section order (`identity`, `engine`, `git`, `flow`, `ci`);
   - registry-driven (`setup` entries in `keys.json`, linked to the key-registry section of `shared-state-and-configuration.md`);
   - sections and targets (only global settings outside an initialized repo);
   - the TTY requirement (exit `2`, no `--json`);
   - the per-setting flow (value, tier, `[Y/n]` confirmation), input handling, interrupts and errors.

   Replace the spec pointer and keep the existing internals bullets.
3. **Alternatives considered.** Condensed one-liners from the spec index, Command Surface, and Shortcuts and Setup: each rejected option and why.
4. **Future work.** `list --json` reporting registry defaults for keys unset in every tier, and whether to split the `--repo` path/tier overload into separate flags (e.g. `--repo-path`). Link per-key skew granularity to the registry section instead of repeating it.
5. **Final sweep.** No link in the doc points under `docs/agents/specs/`. Build the CLI and check every command and flag the doc names against `arcanum config --help` and each subcommand's `--help`.

## Files to Change
- `docs/agents/architecture/arcanum-cli.md` — full Shortcuts and Setup wizard sections replacing the spec pointers; new Alternatives considered and Future work sections; no links to the spec remain.
