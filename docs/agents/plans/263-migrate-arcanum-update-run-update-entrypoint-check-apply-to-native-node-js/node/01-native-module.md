# Native module (`check`, `apply`)

Create `core/lib/ArcanumUpdateRunUpdate.js` (zero runtime deps, built-in Node APIs only), mirroring `arcanum-update/scripts/run_update.sh`'s exact logic and output/exit-code contract (see [plan.md](../plan.md)'s Shared contracts) — but reading `arcanum-update/scripts/run_update_check_shell.sh` / `run_update_apply_shell.sh` (once `scripter` has written them) as the authoritative up-to-date reference for exact behavior, since those are the scripts this module must match byte-for-byte.

- `resolveTarget(repoPath)` (private helper, shared by both methods): checks `arcanum/update/bootstrap.sh` exists under `repoPath`; if not, or if neither `<repoPath>/arcanum.json` nor `<repoPath>/.git` exists, throw `new DispatchFailure('STATUS=missing_arcanum\n', 1)`. Otherwise determine `method` (`zip`|`git`) and `repo` — `zip`: read `.repo` from `<repoPath>/arcanum.json` via `JSON.parse`; `git`: parse `origin`'s remote URL the same two forms `parse_github_owner_repo` in the shell script supports (`git@github.com:owner/repo.git`, `https://github.com/owner/repo.git`), via `execFile('git', ['-C', repoPath, 'remote', 'get-url', 'origin'])` (injectable, same DI pattern as `core/lib/RepoPath.js`).
- `currentVersion(repoPath, method)` (private helper): `zip` → `.version` from `arcanum.json`; `git` → `git describe --tags --exact-match` if it succeeds, else `git rev-parse --short HEAD`.
- `async check(repoPath)`: calls the two helpers above, returns `` `METHOD=${method}\nREPO=${repo}\nCURRENT=${current}\nTARGET=${repoPath}\n` ``.
- `async apply(repoPath)`:
  1. Same `resolveTarget` call (throws the same `DispatchFailure` on missing arcanum).
  2. `before = currentVersion(repoPath, method)`.
  3. Spawn `<repoPath>/arcanum/update/bootstrap.sh` with `stdio: 'inherit'` (use `child_process.spawn`, injectable via constructor `deps.spawnFn` for testing, same DI pattern as the rest of `core/lib/`) and `env: { ...process.env, ARCANUM_ASSUME_YES: '1' }` — never a string-interpolated shell call.
  4. Await the child's `'close'` event for its exit code. Nonzero: `throw new DispatchFailure('', rc)` (empty stdout — bootstrap's own output was already streamed live via `stdio: 'inherit'`; nothing further to print).
  5. Zero: `after = currentVersion(repoPath, method)`. Return `` `RESULT=updated FROM=${before} TO=${after}\n` `` if `after !== before`, else `` `RESULT=noop VERSION=${after}\n` ``.

## Files to Change

- `core/lib/ArcanumUpdateRunUpdate.js` — new module, `check`/`apply` methods plus the `resolveTarget`/`currentVersion` private helpers.

## Notes

- **Open question, coordinate with `scripter`**: `apply` spawns `bootstrap.sh` with `env: { ...process.env, ARCANUM_ASSUME_YES: '1' }` — but under `engine.mode=native`, `process.env` inside this module is *not* the full ambient environment; it's whatever `engine_dispatch.sh`'s explicit allowlist forwarded to `core/bin/arcanum` (`PATH`, `ARCANUM_REPO_PATH`, plus named vars). `scripter`'s `arcanum-update-run-update-apply` `engine_dispatch` call includes `HOME` in that allowlist (needed for git's global config/credential helpers during a git-clone-method update). Verify locally, against both a real zip-install and a real git-clone install with `engine.mode=native`, whether `HOME` alone is sufficient or whether SSH-agent-based git auth also needs `SSH_AUTH_SOCK` forwarded — if so, add it to `scripter`'s allowlist too.
