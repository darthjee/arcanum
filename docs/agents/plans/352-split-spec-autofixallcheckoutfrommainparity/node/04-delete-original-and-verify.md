# Delete the original monolith and verify

Delete `core/spec/bin/autoFixAllCheckoutFromMainParity_spec.js` now that every `describe`/`it`
has a new home from steps 02–03. Then run the full suite and lint to confirm the split is
behavior-preserving:

- `make core-test` — must pass, with the same total spec/`it` count as before the split (7
  `describe` blocks / 7 `it`s, unchanged, just redistributed across 3 files).
- `make core-lint` — must be clean (no unused imports left behind in the new files, no ESLint
  violations in the new factory module).

## Files to Change

- `core/spec/bin/autoFixAllCheckoutFromMainParity_spec.js` — deleted.
