# node Plan: Migrate auto-fix-all-queue entrypoint (save, next, wait-next, push, pop, empty, list) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The 7 `engine_dispatch` command names, the 7 `queue_<subcommand>_shell.sh` filenames this agent's parity tests shell out to, the `HOME`-only-for-`save`/`push` env-var allowlist, and the `.claude/state/auto-fix-all-queue.{json,lock}` paths are exactly as specified in [plan.md](plan.md)'s "Shared contracts" — depend on scripter's Step 1/2 output matching these exactly.
- Reuse, do not reinvent: `core/lib/Lock.js` (`acquire(lockFile)`/`release(lockFile)`) for the `push`/`pop` lock guard, and `core/lib/Tags.js`'s `LABEL_TO_TAG` table for tag-name → GitHub-label-name resolution in the best-effort label mutation.

## Steps

- [01 — Create AutoFixAllQueue.js](node/01-create-auto-fix-all-queue.md)
- [02 — Register COMMANDS entries](node/02-register-commands.md)
- [03 — Write unit tests](node/03-write-unit-tests.md)
- [04 — Write parity tests](node/04-write-parity-tests.md)

## CI Checks

- `core`: `yarn test` (also runs via `yarn lint`/`yarn coverage` per `core/package.json`'s scripts) — CI job: the `core/` Node test workflow in `.github/workflows/`.

## Notes

- `wait-next`/`waitNext` polls forever (5s sleep) on an empty queue — same testing concern already solved for `AutoFixAllWaitCi.js`'s poll loop: make the poll interval and sleep function constructor-injectable (`pollIntervalMs`, `sleepFn`) so both the unit tests and the parity test can use a short, mockable interval instead of a genuinely long-running/hanging test.
- Confirm whether `save`/`push`'s best-effort label mutation needs the same `GH_INSECURE_SKIP_VERIFY`-equivalent consideration `AutoFixAllWaitCi.js`'s plan flagged (likely not, since native calls `fetch` directly rather than shelling to `gh`).
