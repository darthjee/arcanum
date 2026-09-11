# node Plan: Migrate auto-fix-issue-run-checks entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Steps

- [01 — Split run_checks.sh into shell impl plus engine_dispatch shim](node/01-split-shim.md)
- [02 — Add native AutoFixIssueRunChecks command](node/02-native-command.md)
- [03 — Register auto-fix-issue-run-checks in the command registry](node/03-register-command.md)
- [04 — Flip the migration-status flag to true](node/04-flip-migration-flag.md)
- [05 — Add native unit tests for AutoFixIssueRunChecks](node/05-unit-tests.md)
- [06 — Add shell/native parity test for auto-fix-issue-run-checks](node/06-parity-test.md)

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes
- **Streaming + exact exit-code propagation**: `run_checks.sh` must stream the check script's stdout/stderr live and preserve its exact exit code, including nonzero ones. `core/bin/arcanum`'s `dispatch()` only supports "return a string → stdout, exit 0" or "throw → stderr message, exit 1" or "throw `DispatchFailure(stdout, exitCode)` → print `stdout`, exit `exitCode`". There's already exact precedent for this "streamed live, exit code only" shape in `ArcanumUpdateRunUpdate.js`'s `_runBootstrap`/`run` (`arcanum-update`): spawn with `stdio: 'inherit'` so the child writes directly to the parent's fds (bypassing `dispatch()`'s own stdout write), then `throw new DispatchFailure('', code)` on a nonzero exit — empty `stdout` payload since everything was already streamed, so `dispatch()` doesn't double-print anything. Step 02 reuses this exact pattern.
- **No `repoPath` threading**: like `list_plan_agents_shell.sh`/`list_plan_steps_shell.sh` (`auto-fix-issue-list-plan-agents`/`-list-plan-steps`), `run_checks.sh` relies on the caller's cwd rather than an explicit `repo_path` argument, so the command registry entry has no `context` (constructed via `new AutoFixIssueRunChecks()`, no `RepoContext`) and it resolves `.claude/scripts/check_<agent>.sh` via `process.cwd()`, matching the shell script's `$CHECK_SCRIPT` relative-path lookup exactly.
- **`HOME` env-var forwarding**: the check script is project-defined and arbitrary — it may run anything (linters, test runners, language toolchains) that itself needs `$HOME` to resolve its own config/cache dirs, the same rationale `commit_change.sh`'s shim already forwards `HOME` for (there, so `git` can resolve identity/config once native's `env -i PATH="$PATH"` strips the ambient environment). The `run_checks.sh` shim forwards `HOME` to the native allowlist for the same reason.
