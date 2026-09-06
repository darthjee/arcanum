# Add the layering-boundary lint rule

Add a hand-rolled `no-restricted-imports` override to `core/eslint.config.mjs` — no new devDependency — that fails any import in `lib/context/**`, `lib/services/**`, or `lib/utils/**` whose specifier matches `**/commands/**`. Use ESLint's `patterns` form (a `group` glob against the import specifier text plus a `message` pointing at the layering rule) so it catches relative imports like `../commands/shared/GithubIssue.js` regardless of how many `../` segments deep the importing file is.

Verify the rule actually fires: temporarily add a throwaway import from `commands/` into a file under `context/`, `services/`, or `utils/`, run `yarn lint` inside `core/` and confirm it fails with the expected message, then remove the throwaway import.

Once step 01 has landed, run `yarn lint` again and confirm the real (post-fix) codebase passes cleanly — there should be no remaining `commands/` imports under `context/`, `services/`, or `utils/`.

## Files to Change

- `core/eslint.config.mjs` — add the `no-restricted-imports` override scoped to `lib/context/**`, `lib/services/**`, `lib/utils/**`.
