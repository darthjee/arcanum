# Set coverage thresholds and verify

- Run `yarn test` in `shared/` and read c8's text summary.
- Set `lines`, `functions`, `branches` and `statements` in `shared/package.json`'s `c8` block to the reached percentages, **rounded down** to whole numbers. Keep `check-coverage: true`.
- Re-run `yarn test` (must pass with the thresholds enforced) and `yarn lint` (must be clean).
- `diff -r core/lib/shared shared/lib` is still empty.
- `git status` shows no change under `core/` or `cli/`, and no `shared/node_modules/` or `shared/coverage/` tracked.

## Files to Change

- `shared/package.json` — final coverage thresholds.
