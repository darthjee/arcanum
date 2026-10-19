# Node Plan: Make the shared lock protocol mutually exclusive (atomic create, owner-checked release, stale-pid detection)

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md → Shared contracts](plan.md#shared-contracts). `Lock.js` must write `<hostname>:<pid>:<nonce>\n` with `{ flag: 'wx' }`, release only its own id, break only parseable, same-host, dead-pid locks (re-read before remove), and stay byte-compatible with `arcanum/_lib/lock.sh` (rewritten by `scripter`). The Node-only bound is `acquire(lockFile, { timeoutMs, warn })`, which throws `LockTimeoutError` with `code: 'LOCK_TIMEOUT'`.

## Steps

- [01 — Rewrite Lock.js acquire/release](node/01-rewrite-lock-js.md)
- [02 — Add the optional bound and LockTimeoutError](node/02-bound-and-timeout-error.md)
- [03 — Specs, including a shell-vs-native race](node/03-specs.md)

## CI Checks

- `core`: `cd core && yarn test` and `cd core && yarn lint` (the CircleCI jobs that run `yarn test` / `yarn lint`).

## Notes

- Every `Lock` consumer (`RepoConfigWriter`, `BooleanKeyConfig`, `AutoFixAllQueue`, `MonitorIssuesRewriteQueue`, `PermissionGrant`, `IssueState`, `IssueStateService`, `GithubIssue`) keeps calling `acquire(lockFile)` / `release(lockFile)` unchanged. No consumer edits are expected; run their specs to confirm.
- Many specs build `new Lock({ sleepMs: 5 })`. Keep the option name, which now means the retry interval on contention.
- `LockTimeoutError` is a plain `Error` subclass. Don't introduce `ConfigError`; that belongs to epic #767.
- `core/` has a zero-runtime-dependency rule, so use `node:` built-ins only.
