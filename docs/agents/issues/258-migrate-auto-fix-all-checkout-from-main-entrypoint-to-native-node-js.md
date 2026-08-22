Sub-issue of #252 (batch overview). Part of the `auto-fix-all` family.

## Source script

`auto-fix-all/scripts/checkout_from_main.sh`

Bootstraps or reuses the branch for an issue, merged up to date with main: fetches `origin/main` and `origin/issue-<id>`; if `issue-<id>` already exists (local or remote) checks it out and merges `origin/main` into it, otherwise creates it fresh from `origin/main`. Prints `BRANCH=<name>` then `STATUS=ok` or `STATUS=conflict` (exit 0 / exit 2 respectively).

## Migration

Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-all/scripts/checkout_from_main.sh` for its exact output/exit-code contract.
2. Create `core/lib/AutoFixAllCheckoutFromMain.js` (zero runtime deps, built-in Node APIs only; any `git` invocation must use `execFile`/`spawn` with an argument array — never string-interpolated `exec()`).
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'auto-fix-all-checkout-from-main': { module: 'AutoFixAllCheckoutFromMain.js', method: 'run' }`.
4. Add `"auto-fix-all-checkout-from-main": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/AutoFixAllCheckoutFromMain_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## External dependencies

- `git fetch` / `git checkout` / `git merge` (no GitHub API calls).
- Sources `arcanum/_lib/git_branch.sh` (not yet migrated) — re-derive the equivalent git-plumbing logic natively rather than shelling out.

## Dependencies on other sub-issues

None — no in-batch script calls this one or is called by it.
