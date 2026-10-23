# Command surface

Add the generic command contract from [Command Surface](../../../specs/arcanum-cli/command-surface.md), written as current state and checked against `cli/lib/args.js`, `cli/lib/values.js`, `cli/lib/commands/config/{get,set,unset,list}.js`, `cli/lib/tierFiles.js`, `cli/lib/writeTier.js`, `cli/lib/output.js` and `cli/lib/help.js`:

- the namespace (`arcanum config …`) and the generic commands (`get`, `set`, `unset`, `list`, `info`);
- syntax rules: a tier flag is required on writes, `--all-tiers`, the `--repo` path/tier overload rule, and `--` before values that start with `-`;
- keys: registry matching, refusal of unknown keys (exit `3`), and the `--force` scope;
- the value-parsing table, including `--string`;
- `--repo` normalization;
- missing and malformed tier files: reads skip a broken tier with a warning, writes refuse with exit `7`, and `--force` doesn't change that; also the `NOT_AN_OBJECT` parent case;
- lock contention: `--lock-timeout`, exit `6`, and the left-over lock hint;
- meta commands (`--help`, `--version`) and global flags (`--json`, `--claude-config-dir`, `--repo <path>`, `--lock-timeout`);
- output: plain-text formats for each command, what goes to stdout and what to stderr, and `(unset)` with the default;
- JSON output: the exact shape per command and the error object (`code`, `exit`, `message`, `hint`), copied from what `output.js` produces;
- error messages and their hints;
- edge cases, kept only where they are still true.

The existing "Argument parsing", "Refusal order", "Reads" and "Writes" sections describe how this is implemented. Put the contract next to them, or fold it in, so each topic is covered once, and link the internals back to the contract they implement.

## Files to Change
- `docs/agents/architecture/arcanum-cli.md` — new command-surface sections (generic commands, syntax, keys and `--force`, value parsing, tier files, locking, flags, output, JSON output, errors, edge cases), merged with the existing parsing, refusal, reads and writes sections.
