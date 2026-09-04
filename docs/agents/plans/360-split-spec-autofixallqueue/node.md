# Node Plan: Split spec AutoFixAllQueue

Main plan: [plan.md](plan.md)

## Shared contracts

None — single-agent plan, nothing crosses an agent boundary.

## Steps

- [01 — Extract shared test helpers into a support factory](node/01-extract-shared-helpers.md)
- [02 — Split save tests into AutoFixAllQueueSave_spec.js](node/02-split-save.md)
- [03 — Split read-only tests into AutoFixAllQueueReads_spec.js](node/03-split-reads.md)
- [04 — Split push tests into AutoFixAllQueuePush_spec.js](node/04-split-push.md)
- [05 — Split pop/empty tests into AutoFixAllQueuePop_spec.js and delete the original](node/05-split-pop-and-cleanup.md)

Mirrors #347's sequencing (`AutoFixAllGithub_spec.js` → 3 split files): each intermediate step
copies one `describe` block verbatim into its new file and leaves the original spec untouched,
so the suite stays green throughout even though the moved block temporarily runs from two
places. Only the final step deletes the original, at which point every `it` exists exactly
once again, distributed across the four new files.

## Files to Change

- `core/spec/support/factories/autoFixAllQueue.js` (new) — shared `createAutoFixAllQueue`,
  `writeQueueFile`, `readQueueFile` helpers, parameterized per the issue's Solution section.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueSave_spec.js` (new) — `#save` (step 02).
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueReads_spec.js` (new) — `#next`,
  `#waitNext`, `#list` (step 03).
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePush_spec.js` (new) — `#push` and the
  whole `lock contention` block, including its push/pop-overlap test (step 04).
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePop_spec.js` (new) — `#pop`, `#empty`
  (step 05).
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueue_spec.js` (deleted, step 05).

## CI Checks

- `core`: `make core-test` (CI job: `test`)
- `core`: `make core-lint` (CI job: `checks`)

## Notes

- No production code changes: `AutoFixAllQueue.js`, `QueueStore`, `IssueTagger`, and `Lock`
  are untouched throughout.
- The factory module (step 01) is additive only — it does not touch the original spec file, to
  avoid needless churn in a file being deleted two steps later.
- After step 05, `make core-test` should report the same total spec/`it` count as before the
  split (the four new files together hold exactly the 385 original lines' worth of `it`s, no
  more, no fewer), and `make core-lint` must be clean.
- The `bin/autoFixAllQueueParity/` shell-parity specs (already split, one file per subcommand)
  are out of scope and untouched.
