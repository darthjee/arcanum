# Issue: Add logs to native nodejs calls

## Description
Add lightweight logging to `core/bin/arcanum` — the centralized native Node.js entrypoint introduced by arcanum's script-engine migration (see `docs/agents/architecture/script-engine.md`) — to record which commands are actually being invoked through the native path, for tracking migration adoption. This is temporary, debug-only instrumentation: it is expected to be removed once the migration is complete, and that expectation drives every design decision below toward the smallest workable implementation rather than a durable feature.

`arcanum/_lib/engine_dispatch.sh` is the dispatch guard that decides, per call, whether to run a command's legacy shell implementation or the native `core/bin/arcanum` binary, based on `engine.mode` config and `migration-status.json`. When `engine.mode=native` and a native implementation exists, it invokes `core/bin/arcanum` with a restricted environment (`env -i PATH=$PATH` + a per-command allowlist). This is the single seam through which every native call passes.

## Problem
There is currently no observability into which commands are actually reaching the native path — no way to tell how far the shell-to-Node.js migration has actually been adopted in practice, per command, over time.

## Expected Behavior

### Scope
- **Purpose is native-call tracking, not general arcanum statistics.** Only calls that actually reach `core/bin/arcanum` are logged. Explicitly unlogged, by design:
  - `engine.mode=shell` calls (never touch the native binary).
  - `engine.mode=docker` calls (fall back to the shell script; native Docker execution is out of scope per #192).
  - `engine.mode=native` calls where the command isn't yet migrated (`migration-status.json` says unavailable — falls back to the shell script).

  If broader "every arcanum invocation regardless of engine" statistics are wanted later, that's a separate issue — it would need the hook in `engine_dispatch.sh` itself rather than (or in addition to) `core/bin/arcanum`.
- **No guarding against direct/bypassed invocation.** `core/bin/arcanum` is only invoked with `ARCANUM_REPO_PATH` set when called through `engine_dispatch.sh`. Someone invoking `core/bin/arcanum <command>` directly (bypassing the dispatch guard) won't have that env var, so logging is silently skipped — the same "not configured" no-op path, not a special case. No extra validation is needed to detect or prevent this.
- **Proof/dev commands are excluded.** `dispatch-fixture` and `dispatch-fixture-crash` (the #192 proof-of-concept commands) are dev-only noise, not real migrated entrypoints, and must not be logged.
- **Logging must survive a crash.** The log line is written at invocation time — before dispatching to the command's actual implementation — so a command that throws or exits non-zero is still recorded as having been invoked.
- **Reading/aggregating the log file is out of scope.** This issue only covers writing log lines. Any report/dashboard/stats-reading tooling is a separate future concern (if the feature isn't removed first, per its temporary nature).

### Log format
Each invocation writes one line: `command <name> invoked at <timestamp>` (e.g. `command resolve-and-fetch invoked at 2026-08-21T22:43:04.000Z`). Only the command name is logged — arguments are never logged (they may contain tokens or sensitive data).

Deliberately kept minimal, plain text (not JSONL), with no extra fields:
- **No repo field** — already encoded in the log filename (`arcanum-<repo_name>-log.txt`), redundant to repeat per line.
- **No success/failure or duration** — the log write happens before dispatch, specifically so it survives a crash. Capturing outcome/duration would require a second, correlated write after the command finishes — real added complexity not justified for temporary, debug-only instrumentation whose purpose is "was this command invoked," not "did it succeed."
- **Plain text over JSONL** — simple enough to `grep -c` per command; no aggregation tooling is planned.

### Failure isolation
A logging failure (unwritable log location, broken config read, disk full, etc.) must be silently swallowed: no stderr warning, no effect on the command's own output or exit code — the same "not configured" no-op convention, not a second, louder failure mode.

### Acceptance criteria
- When `engine.log.location` is configured and a native command is invoked, a line is appended to the log file.
- When `engine.log.location` is not configured, no log file is created and no error is emitted.
- Only the command name is logged — never the arguments.
- `repo_name` is derived from `basename(repo_path)`.
- Logging does not affect the output or exit code of the command.
- A logging failure is silently swallowed — no stderr warning, no effect on the command's execution.
- A command that throws or exits non-zero is still logged (log happens at invocation time, before dispatch).
- `dispatch-fixture` and `dispatch-fixture-crash` are never logged.
- Shell-mode, docker-mode, and native-fallback (unmigrated command) invocations are never logged — only calls that actually reach `core/bin/arcanum`.
- Specs in `core/spec/` cover logging presence, absence, exclusion, and crash-survival.

## Solution

### Config: engine.log.location
New config key under the existing `engine` namespace, following the same 3-tier resolution chain as `engine.mode` (local state → repo config → global config):
```json
{
  "engine": {
    "log": {
      "location": "/path/to/log/folder"
    }
  }
}
```
Read via: `config_chain_read "$repo_path" engine log.location` (works because `repo_config_read` supports dot-separated key paths via `jq getpath`). When `engine.log.location` is absent at all three tiers, logging is silently skipped — no warning, no error, consistent with the project convention that absent config means default (no-effect) behavior. The same no-op applies when `ARCANUM_REPO_PATH` itself is absent.

### repo_path access
`core/bin/arcanum` currently has no access to `repo_path`, but the logging needs it to resolve `engine.log.location` via `config_chain_read` and to derive `repo_name` via `basename(repo_path)`. The dispatch guard passes it as an infrastructure-level environment variable (outside the per-command skill allowlist, same category as `PATH`):
```
ARCANUM_REPO_PATH=$repo_path
```

### Reading config from Node.js
**Option A (pragmatic, chosen): Shell-out to config_chain_read**
```js
import { execFileSync } from 'node:child_process';
const logLocation = execFileSync('bash', [
  '-c',
  `source "${configChainPath}/config_chain.sh" && config_chain_read "${repoPath}" engine log.location`
]).toString().trim().replace(/^"|"$/g, '');
```
**Option B (aligned with migration, not chosen): Native config reader in core/lib/** — a `core/lib/ConfigChain.js` mirroring the 3-tier chain in pure Node.js. More work, and aligned with the migration philosophy, but given this feature's temporary/debug-only nature, likely never warranted — Option A ships the feature with the smallest footprint.

### Writing the log
Once `logLocation` is resolved and non-empty:
```js
import fs from 'node:fs';
import path from 'node:path';

const repoName = path.basename(repoPath);
const logFile = path.join(logLocation, `arcanum-${repoName}-log.txt`);
const timestamp = new Date().toISOString();
fs.appendFileSync(logFile, `command ${command} invoked at ${timestamp}\n`);
```

### Failure isolation implementation
The entire logging step (config resolution + `fs.appendFileSync`) is wrapped in a single try/catch, synchronously, before dispatching to the command's implementation, and any failure is silently swallowed. Without this, an uncaught throw here would propagate through `core/bin/arcanum`'s top-level `.catch()` and break the actual command — which the acceptance criteria explicitly forbid.

### Dev/proof command exclusion
The `COMMANDS` registry in `core/bin/arcanum` gains a way to opt a command out of logging (e.g. a `log: false` flag), defaulting to `true` for every command except `dispatch-fixture` and `dispatch-fixture-crash`.

### Files affected
| File | Change |
| --- | --- |
| `core/bin/arcanum` | Add logging logic: read repo_path from env, resolve engine.log.location, append command + timestamp to log file; opt `dispatch-fixture`/`dispatch-fixture-crash` out of logging. |
| `arcanum/_lib/engine_dispatch.sh` | Pass `ARCANUM_REPO_PATH` env var to the native binary invocation (infrastructure-level). |
| `core/spec/` | Add specs for the logging behavior (Jasmine) — test: logging when configured, no logging when not configured, dev/proof commands excluded, log line written even when the command crashes, logging failure is silently swallowed and doesn't affect the command's exit code/output. |
| `docs/agents/architecture/script-engine.md` | (Optional) Document the new `engine.log.location` config key. |

## Benefits
- Gives visibility into how far the native Node.js migration has actually been adopted in practice, per command, without waiting on a separate reporting effort.
- Minimal footprint and risk: additive-only config/env var, silent no-op when unconfigured or on failure, never affects a command's own output or exit code.
- Deliberately scoped to be easy to remove later, since it's debug-only instrumentation rather than a permanent feature.
