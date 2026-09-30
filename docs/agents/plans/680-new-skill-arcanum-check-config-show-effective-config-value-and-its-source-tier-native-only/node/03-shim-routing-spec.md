# Routing spec through the real shim
Add a bin-level spec that runs the real `arcanum-check-config/scripts/check_config.sh` shim (C3) end to end, proving the native-only dispatch path (C2) works in every `engine.mode`. Reuse the existing support helpers (`core/spec/support/utils/runCommand.js`'s `REPO_ROOT`/`runCommand`, `tempDir.js`, `engineMode.js`'s `seedEngineMode`), following the style of `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js`.

Setup: a temp repo dir (no git needed) and a temp `CLAUDE_CONFIG_DIR` holding a global `arcanum-config.json`; pass `CLAUDE_CONFIG_DIR` (and `HOME`) in the shim's env.

Cases:
- `engine.mode` unset, `shell`, `native` (seeded in the local tier): the shim prints the C1 JSON and exits `0`. Querying e.g. `git.authors` with a value only in the global file shows `"source": "global"` and the global `file` equal to the temp `CLAUDE_CONFIG_DIR` path, proving `CLAUDE_CONFIG_DIR` survives `env -i`. Querying `engine.mode` itself shows the local tier as the source.
- `engine.mode=docker`: exit `1`, empty stdout, stderr containing `engine.mode=docker is not implemented yet for native-only command 'arcanum-check-config'`.
- Missing key argument: exit `1`, usage on stderr, empty stdout.
- Malformed key (`git`): exit `1`, `arcanum: invalid key 'git': ...` on stderr.

This spec depends on `scripter`'s shim and `--native-only` flag being in the tree.

## Files to Change
- `core/spec/bin/arcanumCheckConfig_spec.js` — new routing spec through the real shim.
