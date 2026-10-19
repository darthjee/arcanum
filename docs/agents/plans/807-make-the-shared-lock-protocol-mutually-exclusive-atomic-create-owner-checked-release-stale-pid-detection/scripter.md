# Scripter Plan: Make the shared lock protocol mutually exclusive (atomic create, owner-checked release, stale-pid detection)

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md → Shared contracts](plan.md#shared-contracts). In particular, `lock.sh` must write `<hostname>:<pid>:<nonce>\n` with an atomic `noclobber` create, release only its own id, break only parseable, same-host, dead-pid locks (re-read before remove), and honour `ARCANUM_LOCK_RETRY_SLEEP` (default `1`). `node` implements the same protocol in `Lock.js`; its specs include a race against a real bash `lock.sh` writer, so the two must stay byte-compatible.

## Steps

- [01 — Rewrite lock.sh with the new protocol](scripter/01-rewrite-lock-sh.md)
- [02 — Make issue_state_shell.sh source lock.sh](scripter/02-dedupe-issue-state-shell.md)
- [03 — Add a standalone shell test for lock.sh](scripter/03-test-lock-sh.md)
- [04 — Update the lock docs](scripter/04-update-docs.md)

## CI Checks

- None of the shell tests are wired into CI (`.circleci/config.yml` only runs `core/`'s `yarn test` / `yarn lint` and the mod checks). Run `bash arcanum/_lib/test_lock.sh` locally, and `shellcheck` on the touched scripts.
- `core`: `cd core && yarn test` (CI job running `yarn test`). `node`'s cross-implementation spec sources `arcanum/_lib/lock.sh`, so a `lock.sh` regression shows up there too.

## Notes

- Callers of `lock.sh` keep the same interface: set `LOCK_FILE`, then `_acquire_lock` / `_release_lock`. The callers are `auto-fix-all/scripts/queue_common.sh`, `monitor-issues/scripts/*`, `arcanum/_lib/{repo_config,global_config,permission_grant_shell,engine_dispatch_docker}.sh`, and `arcanum/migrations/{run,update_per_file,_ledger,ledger}.sh`. None of them need edits. Spot-check that none reads the old fixed 1s delay as a feature.
- `engine_dispatch_docker.sh` declares `local LOCK_FILE` before `_acquire_lock`. With per-acquire ids kept in a global, keep the id keyed by the lock path (or as a single "current id" global, provided no caller nests two different locks; check this). Nested acquisition of different lock files in one shell must keep working.
- `arcanum/update/updater.sh`'s `mkdir`-based lock is out of scope.
