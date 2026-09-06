# Issue: Add circular-import lint guardrail to core/eslint config

## Description
Part of #391, a code-quality finding split into sub-issues. `core/lib/commands/` already has 4 sub-dirs (`arcanum-split-issue/`, `arcanum-update/`, `auto-fix-all/`, `shared/`) and keeps growing as the ongoing shell→native migration (tracked in `arcanum/_lib/migration-status.json`, 23/58 entrypoints migrated so far) adds more. This issue adds automated enforcement so a circular import anywhere under `core/lib/` fails lint, instead of relying purely on convention.

## Problem
No barrel files (`index.js` re-exports, `export *`) exist anywhere under `core/lib/` today — module aggregation happens via a data-only registry (`core/lib/core/commands.js`'s `COMMANDS` object of module-path strings), loaded per-call through a dynamic `import()` in `core/lib/core/dispatcher.js`, not a static barrel import. The only structural rule that exists is the one-way `commands → context/services → utils` layering documented in `docs/agents/architecture/script-engine.md`, enforced "by convention (no lint rule)" — nothing currently stops a violation. `core/eslint.config.mjs` only pulls in `@eslint/js` and `eslint-plugin-jsdoc` today.

A manual import-graph analysis across all 59 files under `core/lib/` already found one real, pre-existing cycle: `context/RepoContext.js` <-> `commands/shared/GithubIssue.js`. That's tracked separately as blocking prerequisite #394 ("Untangle RepoContext ↔ GithubIssue circular import", a sub-issue of this one) — it must merge before this issue's rule can be enabled. No other cycles exist elsewhere in `core/lib/`.

## Solution
- Add `eslint-plugin-import-x` as a `core/` devDependency.
- Configure its `import-x/no-cycle` rule in `core/eslint.config.mjs`, scoped to `core/lib/**` (module resolution needs to cover the project's ESM `.js` files).
- Update `docs/agents/architecture/script-engine.md` to note that circular imports under `core/lib/` are now lint-enforced, not just prevented by convention.

### Alternative solutions considered
Considered `eslint-plugin-import`, `eslint-plugin-import-x`, and a CI-only tool like `madge --circular`. Chose `eslint-plugin-import-x`:
- `core/` runs ESLint `^10.8.1` (flat-config only, no eslintrc fallback) on pure ESM (`"type": "module"`). As of mid-2026, `eslint-plugin-import`'s flat-config support is still incomplete (tracked via an open PR, not stably released), while `eslint-plugin-import-x` is a purpose-built fork targeting flat-config-only ESLint 9/10, with far fewer dependencies (~16 vs. ~117) and active maintenance.
- Same rule semantics and name shape as the original (`import-x/no-cycle` instead of `import/no-cycle`), so no design change beyond the package/rule-prefix swap.
- A CI-only tool (`madge --circular`) was rejected: it would add a separate check outside the existing `yarn lint` gate, rather than surfacing the violation inline in the same tool developers already run locally.

### Scope boundaries
The `import-x/no-cycle` rule applies to `core/lib/**` only — `core/bin/arcanum` is deliberately excluded from its scope, even though it's covered by the general `files: ['**/*.js', 'bin/arcanum']` glob for the repo's other lint rules.

`core/bin/arcanum` is a leaf entrypoint — it imports from `core/lib/core/dispatcher.js` and `core/lib/utils/errors/DispatchFailure.js`, but nothing under `core/lib/` imports back from `core/bin/` (nor should it, per the documented one-way layering). A cycle can only exist among files that import each other, so a file nothing ever imports can't participate in one regardless of whether the rule is enabled on it. If a future `core/lib/` module wrongly imported back from `core/bin/arcanum`, `import-x/no-cycle` would still catch it from the `core/lib/` side without `bin/arcanum` needing to be in scope.

### Edge cases
`import-x/no-cycle` (and any static analyzer) can only follow statically-resolvable `import`/`require` targets. `core/lib/core/dispatcher.js`'s `commandInstance()` calls `await import(this.modulePath())`, where `modulePath()` builds a `file://` URL from a runtime `path.join(libDir, this.entry.module)` string concatenation — not a literal — so this edge is structurally invisible to static analysis regardless of tool choice, not merely "unfollowed by default."

This is out of scope for this guardrail: it isn't a circular-*import* risk in the ESM graph sense, it's registry-driven lazy command loading (a different concern — command modules are loaded one at a time, on demand, per CLI invocation). The lint rule's coverage is limited to statically-resolvable imports under `core/lib/**`; it will not and cannot detect issues through the dynamic dispatch path.

### Testing strategy
`core/`'s `lint` (eslint) and `test` (jasmine/c8) are separate npm scripts and CI gates (`make core-lint` vs `make core-test`), and there's no existing precedent here for testing an ESLint config's rules via a committed spec. Verification is manual-only, no permanent fixture:
1. Create two throwaway files under `core/lib/**` that import each other.
2. Run `yarn lint` (or `make core-lint`) and confirm `import-x/no-cycle` reports an error.
3. Delete the throwaway files before committing — they must never land in the PR.

### Dependency
Blocked by #394 (sub-issue of this one) — the pre-existing `RepoContext`/`GithubIssue` cycle must be fixed first, or enabling `import-x/no-cycle` here would fail CI immediately on real code.

### Done when
- [ ] `core/`'s ESLint config fails on a circular import anywhere under `core/lib/` (verify with a throwaway two-file cycle, then remove it)
- [ ] `docs/agents/architecture/script-engine.md` updated to note the rule is lint-enforced

## Benefits
Converts the documented-but-unenforced circular-import/layering convention into an automated CI gate, catching regressions before review rather than relying on manual code review as `core/lib/commands/` keeps growing through the shell→native migration.
