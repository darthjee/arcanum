# Document the rule as lint-enforced

`docs/agents/architecture/script-engine.md` currently describes `core/lib/`'s one-way layering (`commands` → `context`/`services` → `utils`) as enforced "by convention (no lint rule)". Update that line (and the "Nothing under `context/`, `services/`, or `utils/` may import from `commands/`" sentence right after it) to say the rule is now lint-enforced via `core/eslint.config.mjs`'s `no-restricted-imports` override added in step 02, rather than convention-only.

## Files to Change

- `docs/agents/architecture/script-engine.md` — update the layering-direction paragraph to reflect lint enforcement.
