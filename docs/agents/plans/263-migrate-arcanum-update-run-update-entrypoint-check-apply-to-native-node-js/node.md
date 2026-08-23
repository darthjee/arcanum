# node Plan: Migrate arcanum-update-run-update entrypoint (check, apply) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Command names: `arcanum-update-run-update-check`, `arcanum-update-run-update-apply`.
- Both `check(repoPath)` and `apply(repoPath)` take a single argument — the arcanum install's own self-resolved location, forwarded unchanged from `scripter`'s shim (see [scripter.md](scripter.md)). Name the parameter `repoPath` for consistency with the rest of `core/lib/`, even though semantically it's the arcanum install target, not necessarily the caller's `REPO_PATH`.
- Shell-fallback scripts the parity spec shells out to: `arcanum-update/scripts/run_update_check_shell.sh <target_path>`, `arcanum-update/scripts/run_update_apply_shell.sh <target_path>` (created by `scripter`).
- Byte-identical stdout/exit-code contract — see [plan.md](plan.md)'s Shared contracts for the full spec (missing-arcanum, check success, apply success, apply bootstrap-failure).

## Steps

- [01 — Native module (`check`, `apply`)](node/01-native-module.md)
- [02 — Register both commands](node/02-command-registration.md)
- [03 — Unit and parity specs](node/03-specs.md)

## CI Checks

- `core`: `cd core && yarn test` (CI job: `test`)
- `core`: `cd core && yarn lint` (CI job: `checks`)

## Notes

- `git`/version-resolution calls (`remote get-url origin`, `describe --tags --exact-match`, `rev-parse --short HEAD`) should use the existing `execFile`/`promisify` dependency-injection pattern already used in `core/lib/RepoPath.js` and `core/lib/AutoFixAllWaitCi.js` — never a string-interpolated `exec()` (per `script-engine.md`'s Security requirements).
