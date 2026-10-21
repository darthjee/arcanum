# Node-floor gate and router

**`cli/bin/arcanum`** (unbundled, executable, `#!/usr/bin/env node`):

- It compares `process.versions.node` with the literal floor `'22.13.0'` using a small hand-rolled semver compare.
- When the version is too old, it writes `Node.js >= 22.13.0 required, found X` to stderr and exits `1`.
- Otherwise, `import('../dist/arcanum.mjs')`, resolved relative to the gate file itself, never the cwd.
- Only syntax a too-old Node can parse: no top-level await, no `?.`/`??`.

**`cli/lib/`** (the bundle entry is `cli/lib/main.js`):

- `exitCodes.js`: the exit-code constants from [Command Surface → Exit codes](../../../specs/arcanum-cli/command-surface.md#exit-codes) (`EXIT_OK` … `EXIT_FILE`, 0–7).
- `help.js`: help-text helpers.
- `commands/config.js`: the `arcanum config` namespace stub. Its help lists the registered keys from the shared `KeyRegistry` (`core/lib/utils/config/KeyRegistry.js`). This is the scaffold's one real use of the shared surface, so the registry and `keys.json` actually end up in the bundle. The `get/set/unset/list/info` subcommands are not implemented (#780).
- `main.js`: the router on `node:util`'s `parseArgs`, with a thin subcommand/help layer.
  - `--help` and `--version` exit `0`. The version output is `arcanum-cli <version>`, from the `__ARCANUM_CLI_VERSION__` define; `--version --json` gives a JSON form.
  - With no command, or an unknown command, it prints usage to stderr and exits `2`.
  - Any thrown error goes through a single error-to-exit-code mapping function, as specified in [Shared Config Logic → `ConfigError`](../../../specs/arcanum-cli/shared-config-logic.md#configerror).
- No `console.log`. Write through `process.stdout.write` / `process.stderr.write`, or through injected streams for testability.

## Files to Change

- `cli/bin/arcanum` — new Node-floor gate.
- `cli/lib/main.js` — new router (bundle entry).
- `cli/lib/exitCodes.js` — new exit-code constants.
- `cli/lib/help.js` — new help helpers.
- `cli/lib/commands/config.js` — new `config` namespace stub.
