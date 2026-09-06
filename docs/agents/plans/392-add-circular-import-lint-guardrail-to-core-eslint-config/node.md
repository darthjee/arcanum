# Node Plan: Add circular-import lint guardrail to core/eslint config

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add eslint-plugin-import-x devDependency
Add `eslint-plugin-import-x` to `core/package.json`'s `devDependencies` and update `core/yarn.lock` accordingly (`yarn add -D eslint-plugin-import-x` inside `core/`).

### Step 2 — Configure import-x/no-cycle in core/eslint.config.mjs
Import `eslint-plugin-import-x` in `core/eslint.config.mjs` and add a config block scoped to `core/lib/**` enabling `import-x/no-cycle`. `core/bin/arcanum` stays out of this rule's scope — it's a leaf entrypoint nothing under `core/lib/` imports back from (see issue #392's "Scope boundaries" for the full rationale) — so don't add it to this block's `files`, even though it's covered by the general `files: ['**/*.js', 'bin/arcanum']` glob for the repo's other rules.

Verify manually before committing: create two throwaway files under `core/lib/**` that import each other, run `yarn lint` (or `make core-lint`) and confirm `import-x/no-cycle` reports an error, then delete the throwaway files — they must never land in the commit. No permanent test fixture is added (matches repo convention: `lint` and `test` are separate gates, and there's no existing precedent for testing an ESLint config's rules via a committed spec).

## Files to Change
- `core/package.json` — add `eslint-plugin-import-x` devDependency
- `core/yarn.lock` — updated lockfile entry
- `core/eslint.config.mjs` — add the `import-x/no-cycle` rule block scoped to `core/lib/**`

## CI Checks
- `core`: `yarn lint` (CI job: `checks`)

## Notes
- **Blocked by #394** (sub-issue of #392) — a real, pre-existing cycle exists today between `core/lib/context/RepoContext.js` and `core/lib/commands/shared/GithubIssue.js`. #394 must merge first, or enabling `import-x/no-cycle` here will fail CI immediately on real code, not just a test fixture.
- Do not add `core/bin/arcanum` to this rule's `files` scope — see Step 2.
