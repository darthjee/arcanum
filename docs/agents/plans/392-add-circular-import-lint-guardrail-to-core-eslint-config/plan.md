# Plan: Add circular-import lint guardrail to core/eslint config

Issue: [392-add-circular-import-lint-guardrail-to-core-eslint-config.md](../../issues/392-add-circular-import-lint-guardrail-to-core-eslint-config.md)

## Overview
Add `eslint-plugin-import-x`'s `import-x/no-cycle` rule to `core/eslint.config.mjs`, scoped to `core/lib/**`, so a circular import anywhere under `core/lib/` fails lint instead of relying purely on the documented-but-unenforced one-way layering convention.

See [node.md](node.md) for the full plan.

## Notes
- **Blocked by #394** (sub-issue of #392) — must merge before this rule is enabled, since a real pre-existing cycle exists today between `RepoContext.js` and `GithubIssue.js`.
- **Architect to update `docs/agents/architecture/script-engine.md`** (~line 54, "enforced by convention (no lint rule)") to note that circular imports under `core/lib/` are now lint-enforced. This is genuinely unowned, cross-cutting documentation (`docs/agents/**`), not node's scope, so it's handled directly by architect rather than folded into `node.md`.
