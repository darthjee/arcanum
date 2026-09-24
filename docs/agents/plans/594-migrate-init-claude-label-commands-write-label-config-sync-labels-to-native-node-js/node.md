# Node Plan: Migrate init-claude label commands (write-label-config, sync-labels) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Registry entries (all `context: 'repo'`, `validateRepoPath: false`):
  - `init-claude-write-label-config-{replace,remove,add}` → `commands/init-claude/InitClaudeWriteLabelConfig.js` methods `replace`/`remove`/`add`, each taking `(configPath, ...items)`.
  - `init-claude-sync-labels` → `commands/init-claude/InitClaudeSyncLabels.js` `run(configPath)`.
- The shims always pass an absolute `configPath`. Still resolve it with `path.resolve(this._context.repoPath, configPath)`, and never use `process.cwd()`.
- Config JSON format, messages, exit codes, the stdin/EOF contract, and the label API calls follow [plan.md § Shared contracts](plan.md#shared-contracts) exactly.
- Before the shell impls exist, the parity specs run against scripter's `write_label_config_<sub>_shell.sh` and `sync_labels_shell.sh`.

## Steps

- [01 — Port label_config.sh to a shared LabelConfig service](node/01-label-config-service.md)
- [02 — Add GitHub label operations](node/02-github-label-client.md)
- [03 — Implement and register the native commands](node/03-native-commands.md)
- [04 — Unit, parity and routing specs](node/04-specs.md)

## CI Checks

- `core/`: `yarn lint` and `yarn test` (CI core jobs); zero new runtime deps

## Notes

- `sync-labels` must set `validateRepoPath: false` and resolve the repo lazily, only after a "yes". The shell only calls `get_repo_ref` after the prompt, so a non-git `repo_path` still prints the table and prompt first.
- Mirror bash `read -r` precisely: only newline-terminated lines count, a final unterminated chunk is EOF, and trim spaces/tabs but not `\r`. A small `LineReader` over `process.stdin` (async iterator of chunks, buffered split on `\n`) avoids `readline`'s behavior of emitting a final line with no newline. Inject the stream so unit specs can feed it.
