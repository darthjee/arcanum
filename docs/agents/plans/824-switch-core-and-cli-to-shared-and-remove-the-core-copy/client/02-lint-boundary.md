# Lint boundary

Replace the `core/(?!lib/shared/)` restriction in `cli/eslint.config.mjs` with two patterns:

- `(?:^|/)core/`, with a message saying cli/ may not import core/ and must use `shared/lib/` (see `docs/agents/specs/shared-lib.md`);
- `(?:^|/)shared/spec/`, with a message saying cli/ may import `shared/lib/**` only.

Update the block comment above it to match.

Update `cli/spec/packaging/eslintBoundary_spec.js`:

- any `core/` import is rejected, including `../../../core/lib/shared/config/KeyRegistry.js`, which is now an error;
- every file under `shared/lib/` is accepted;
- a `shared/spec/` import is rejected.

## Files to Change

- `cli/eslint.config.mjs`: the new restriction patterns and comment.
- `cli/spec/packaging/eslintBoundary_spec.js`: rewritten expectations.
