# node Plan: Add logs to native nodejs calls

Main plan: [plan.md](plan.md)

## Shared contracts

Reads env var `ARCANUM_REPO_PATH` (produced by `scripter`'s `engine_dispatch.sh` change) via `process.env.ARCANUM_REPO_PATH`. When absent — e.g. `core/bin/arcanum` invoked directly, bypassing `engine_dispatch.sh` — the logging step must no-op silently, the same code path as "`engine.log.location` not configured." See [plan.md](plan.md)'s "Shared contracts" for the full contract, including the security correction to the issue's original `execFileSync` sketch (no string-interpolated `-c` script — pass `repoPath`/`configChainPath` as real positional args).

## Implementation Steps

### Step 1 — Add `InvocationLog` and wire it into `core/bin/arcanum`

Create `core/lib/InvocationLog.js`, following the existing `execFile`-via-`promisify` + injectable-constructor convention already used by `core/lib/GithubToken.js`/`RepoPath.js` (constructor takes `{ execFileAsync, appendFileAsync, configChainPath }` with real defaults, for testability):

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';

const defaultExecFileAsync = promisify(execFile);

class InvocationLog {
  constructor({ execFileAsync = defaultExecFileAsync, appendFileAsync = appendFile, configChainPath } = {}) {
    this._execFileAsync = execFileAsync;
    this._appendFileAsync = appendFileAsync;
    this._configChainPath = configChainPath;
  }

  async record(command) {
    try {
      const repoPath = process.env.ARCANUM_REPO_PATH;
      if (!repoPath) return;

      const location = await this._resolveLogLocation(repoPath);
      if (!location) return;

      const repoName = path.basename(repoPath);
      const logFile = path.join(location, `arcanum-${repoName}-log.txt`);
      const timestamp = new Date().toISOString();

      await this._appendFileAsync(logFile, `command ${command} invoked at ${timestamp}\n`);
    } catch {
      // silently swallow — see class doc / plan.md Notes
    }
  }

  async _resolveLogLocation(repoPath) {
    // Static script text; repoPath/configChainPath are passed as real
    // argv values ($1/$2), never concatenated into the script string —
    // required by docs/agents/architecture/script-engine.md's "No
    // string-interpolated shell execution" rule.
    const script = 'source "$1" && config_chain_read "$2" engine log.location';
    const { stdout } = await this._execFileAsync('bash', ['-c', script, '--', this._configChainPath, repoPath]);

    return stdout.trim().replace(/^"|"$/, '').replace(/"$/, '');
  }
}

export default InvocationLog;
```

Add a JSDoc class comment explaining this is temporary, debug-only instrumentation for #244, expected to be removed once the native migration is complete, and that every failure is intentionally silent.

In `core/bin/arcanum`:
- Import `InvocationLog` and compute `configChainPath` next to the existing `libDir` computation: `path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'arcanum', '_lib', 'config_chain.sh')` (two levels up from `core/bin`, mirroring how `engine_dispatch.sh` itself resolves `core/bin/arcanum`'s path in the other direction).
- Give the two dev/proof `COMMANDS` entries (`dispatch-fixture`, `dispatch-fixture-crash`) a `log: false` flag; every other entry defaults to logged (`entry.log !== false`).
- In `dispatch(command, args)`, immediately after the `entry` lookup (before the dynamic `import(modulePath)`), when `entry.log !== false`: `await new InvocationLog({ configChainPath }).record(command);`. This must run — and be awaited — before the command's own module is invoked, so a crashing command (`dispatch-fixture-crash`) still gets logged, and so logging never races the command's own stdout writes.

### Step 2 — Specs

- `core/spec/lib/InvocationLog_spec.js` (new, unit-level, mocked `execFileAsync`/`appendFileAsync` injected via the constructor — no real `bash`/filesystem calls):
  - resolves the location and appends the expected `command <name> invoked at <ISO timestamp>\n` line when `execFileAsync` resolves with a location.
  - no-ops (never calls `appendFileAsync`) when `ARCANUM_REPO_PATH`-derived `repoPath` is absent — pass this in however Step 1's `record` ends up reading it (constructor arg or `process.env`, whichever Step 1 lands on) so it's actually exercisable in isolation.
  - no-ops when `execFileAsync` resolves with an empty/unset location.
  - swallows silently (resolves, doesn't throw) when `execFileAsync` rejects.
  - swallows silently when `appendFileAsync` rejects.
  - passes `repoPath`/`configChainPath` as separate `args` array elements to `execFileAsync`, never interpolated into the `-c` script string — this is the regression test for the security correction in [plan.md](plan.md).

- Extend `core/spec/bin/arcanum_spec.js` (integration-level, real subprocess via `runArcanum`, same shape as the existing specs there). For each new case, set `ARCANUM_REPO_PATH` to a temp directory containing `.claude/state/arcanum-config.json` with `{"engine":{"log":{"location":"<temp log dir>"}}}` (pass via `execFileAsync`'s `env` option, spreading `process.env` plus the override — no real repo/git checkout needed, `config_chain_read` only reads the JSON file):
  - `dispatch-fixture` with `engine.log.location` configured → the log file gets no line (proof/dev command excluded).
  - a real migrated command (`list-agents` or `checkout-safe-branch`, whichever is cheapest to invoke without live side effects — reuse existing fixture/stub setup from that command's own spec if one exists) with `engine.log.location` configured → the log file gets exactly one line matching the documented format.
  - same command with `ARCANUM_REPO_PATH` unset → no log file is created, and stdout/exit code are unchanged from the existing (unlogged) baseline.
  - `dispatch-fixture-crash` with `engine.log.location` configured → exit code stays non-zero and stdout stays empty (unchanged from the existing spec), but the log file still gets one line — proves logging survives a crash.
  - `engine.log.location` pointed at a non-existent/unwritable directory → exit code and stdout for a normal command are unchanged (no error surfaces) — proves failure isolation end-to-end, not just at the unit level.

## Files to Change
- `core/lib/InvocationLog.js` — new: resolves `engine.log.location` via a safe (argument-array) shell-out to `config_chain_read`, and appends one log line per invocation; every failure silently swallowed.
- `core/bin/arcanum` — call `InvocationLog#record` before dispatching, for every `COMMANDS` entry except the two `log: false` dev/proof commands.
- `core/spec/lib/InvocationLog_spec.js` — new unit spec.
- `core/spec/bin/arcanum_spec.js` — extended with the integration cases above.
- `docs/agents/architecture/script-engine.md` — (optional, per the issue) add a short section documenting the `engine.log.location` config key and its temporary/debug-only nature, next to the existing "The `engine` config key" section.

## CI Checks
- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes
- Keep `InvocationLog#record` async (`execFile`/`promisify`), not the issue's original `execFileSync` sketch — matches every other `core/lib/` module's convention (`GithubToken.js`, `RepoPath.js`) rather than introducing the only synchronous shell-out in the codebase.
- Don't create `engine.log.location`'s directory if it doesn't exist — a missing directory is just one more case that falls into the silent-swallow catch, no special-casing needed.
