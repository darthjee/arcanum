# Add native AutoFixIssueRunChecks command

Create `core/lib/commands/auto-fix-issue/AutoFixIssueRunChecks.js`, zero runtime deps, built-in Node APIs only. Constructed with no context (`new AutoFixIssueRunChecks()` — see [node.md](../node.md)'s Notes on why there's no `repoPath` threading), `run(agent)`:

1. Validate `agent` is present — throw `new Error(USAGE)` otherwise (propagated uncaught → `arcanum: <message>`, exit 1, matching the shell script's own `Usage:` guard).
2. Resolve `checkScript = path.join(process.cwd(), '.claude', 'scripts', \`check_${agent}.sh\`)` — `process.cwd()`, not an injected `repoPath`, mirrors the shell script's cwd-relative `$CHECK_SCRIPT` lookup exactly.
3. If `checkScript` doesn't exist (`existsSync`), return the string `` `No checks configured for agent '${agent}' — skipping.\n` `` — `dispatch()` prints it and exits 0, matching the shell script's message + `exit 0`.
4. If it exists, spawn `bash <checkScript>` with `stdio: 'inherit'` (child writes directly to the parent's stdout/stderr fds — live streaming, no buffering) and wait for its `close` event's exit code, exactly like `ArcanumUpdateRunUpdate.js`'s `_runBootstrap` (see [node.md](../node.md)'s Notes for why this is the established pattern for this shape).
5. On exit code `0`, return `''` (nothing to print, exit 0).
6. On a nonzero exit code, `throw new DispatchFailure('', code)` — empty stdout payload since everything was already streamed via `stdio: 'inherit'`; `dispatch()` sets `process.exitCode = code` with no extra `arcanum:` stderr line (a check script's own nonzero exit is a legitimate result to propagate, not a native-side bug).

## Files to Change
- `core/lib/commands/auto-fix-issue/AutoFixIssueRunChecks.js` — new file. Constructor accepts an injectable `{ existsSync, spawnFn }` deps object (defaulting to `node:fs`'s `existsSync` and `node:child_process`'s `spawn`) for testability, following `ArcanumUpdateRunUpdate.js`'s constructor-injection convention.
