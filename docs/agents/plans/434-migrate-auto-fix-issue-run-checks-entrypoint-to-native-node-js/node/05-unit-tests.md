# Add native unit tests for AutoFixIssueRunChecks

Write `core/spec/commands/auto-fix-issue/AutoFixIssueRunChecks_spec.js` (Jasmine, mirroring the existing `core/spec/commands/auto-fix-issue/*_spec.js` structure), injecting fake `existsSync`/`spawnFn` collaborators rather than touching the real filesystem/process. Cover:

- Missing `agent` argument → throws the usage `Error`.
- `.claude/scripts/check_<agent>.sh` not found (`existsSync` returns `false`) → resolves to the exact `No checks configured for agent '<agent>' — skipping.\n` message, `spawnFn` never called.
- Check script found, `spawnFn`'s fake child emits `close` with code `0` → resolves to `''`.
- Check script found, fake child emits `close` with a nonzero code (e.g. `1`, and a distinct one like `3` to prove the exact code round-trips, not just truthiness) → rejects with a `DispatchFailure` whose `.stdout === ''` and `.exitCode` matches.
- `spawnFn` is called with `bash` and the exact resolved check-script path, and with `stdio: 'inherit'` in its options (proving live streaming, not buffered capture).

## Files to Change
- `core/spec/commands/auto-fix-issue/AutoFixIssueRunChecks_spec.js` — new file.
