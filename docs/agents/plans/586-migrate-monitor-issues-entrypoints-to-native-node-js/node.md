# Node Plan: Migrate monitor-issues entrypoints to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

The node agent registers the 8 `core/lib/core/commands.js` entries from [plan.md](plan.md#command-names-and-native-invocations), with the listed module, method, `context` and `validateRepoPath`. For the two cwd-relative families (`config`, `rewrite-queue`), the leading positional is the shim's `$PWD`, prepended with `--prepend-repo-path`. Native output must match the stdout, stderr, exit-code and file contracts listed there.

## Steps

- [01 — Generalize QueueStore and extract a shared config helper](node/01-generalize-shared-helpers.md)
- [02 — Port actionable_tags and add issue search](node/02-tags-and-issue-search.md)
- [03 — Config, rewrite-queue and github commands](node/03-small-commands.md)
- [04 — The poll loop command](node/04-monitor-loop.md)
- [05 — Register commands and add parity specs](node/05-register-and-parity.md)

## CI Checks

- `core/`: `npm test` and `npm run lint` (run from `core/`, or through the root Makefile's `core-*` targets). Match the CI job names in `.circleci/config.yml` / `.github/workflows/*`.

## Notes

- The refactors in step 01 must leave every existing `AutoFixAllConfig_spec.js`, `AutoFixAllQueue*_spec.js` and `QueueStore_spec.js` passing without edits, apart from changes in how things are constructed.
- The loop in step 04 is the riskiest part. Keep its cursor and "record `updated_at` only when all dispatches succeed" semantics exact, because `auto-rewrite-issue`'s failure recovery depends on them (see `auto-rewrite-issue/steps/run.md`).
