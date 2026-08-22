# Plan: Add logs to native nodejs calls

Issue: [244-add-logs-to-native-nodejs-calls.md](../issues/244-add-logs-to-native-nodejs-calls.md)

## Overview

Add temporary, debug-only logging inside `core/bin/arcanum` (the centralized native entrypoint) so every native command invocation that actually reaches it gets recorded — command name plus timestamp only — to a file at the newly configured `engine.log.location`. `engine_dispatch.sh` gains one infrastructure-level env var (`ARCANUM_REPO_PATH`) so the native binary can resolve that config; `core/bin/arcanum` gains the resolve-and-append logic, wrapped so any failure (missing config, unwritable path, broken shell-out) silently no-ops rather than ever affecting the invoked command's own output or exit code.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

**Env var: `ARCANUM_REPO_PATH`**
- Produced by `scripter`'s change to `arcanum/_lib/engine_dispatch.sh`: set unconditionally (not part of the per-command env allowlist — same infrastructure category as `PATH`) to the `repo_path` argument `engine_dispatch()` was called with, whenever it invokes `core/bin/arcanum`.
- Consumed by `node`'s change to `core/bin/arcanum`: read via `process.env.ARCANUM_REPO_PATH` at the top of the logging step. Used both to resolve `engine.log.location` (via a shell-out to `config_chain_read`) and to derive `repo_name` (`path.basename(repoPath)`) for the log filename `arcanum-<repo_name>-log.txt`.
- **Absence contract**: if `ARCANUM_REPO_PATH` is unset (e.g. `core/bin/arcanum` invoked directly, bypassing `engine_dispatch.sh`), the logging step must no-op silently — same code path as "`engine.log.location` not configured," not a special case node needs to branch on separately.

No other interface crosses the `node`/`scripter` boundary — `scripter`'s change is a one-line env-var addition to an existing invocation, independent of everything else `node` implements.

## Notes

- **Security correction to the issue's Option A sketch**: the issue's code sample shells out via `execFileSync('bash', ['-c', \`source "..." && config_chain_read "${'${repoPath}'}" ...\`])`, interpolating `repoPath` directly into the `-c` script string. That violates this repo's own script-engine security requirement ("No string-interpolated shell execution from native code... building a shell command by string concatenation is a command-injection risk" — `docs/agents/architecture/script-engine.md`), and matters concretely here because the issue also decided `ARCANUM_REPO_PATH` is never validated against a bypassed/direct invocation — a crafted value could inject shell commands. `node.md` specifies the corrected form: pass `configChainPath`/`repoPath` as real positional arguments to `bash -c '<static script>' -- "$1" "$2"`, referenced inside the script as `$1`/`$2`, never concatenated into the script text — the same `execFile`-with-argument-array discipline already used by `core/lib/GithubToken.js`/`RepoPath.js`.
