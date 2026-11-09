# Node Plan: Resolve config tiers from keys.json in the JS readers

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on (from shared):

- `ConfigChain({ env, repoContext, registry })`, whose `read` skips tiers the key doesn't allow.
- `readTiers` entries `{ tier, file, set, value?, allowed? }`, where `allowed` is present only for registered leaf keys.

You produce:

- the `/arcanum-check-config` JSON marker: a disallowed tier's object gains `"allowed": false, "ignored": "tier not allowed"`, and `final` skips such tiers.

## Steps

- [01 — Read NamespacedBooleanKeyConfig values through ConfigChain](node/01-namespaced-boolean-reads-through-config-chain.md)
- [02 — Mark ignored tiers in /arcanum-check-config](node/02-mark-ignored-tiers-in-check-config.md)
- [03 — Audit the remaining core readers](node/03-audit-remaining-core-readers.md)

## CI Checks

- `core/`: `make core-check` (CI jobs: `test`, `checks`)

## Notes

- Depends on the shared plan landing first (same PR, so order the work: shared, then node).
- The `null` behavior change (an explicit `null` in the new file now falls through to the legacy file or the default) can make the shell/native parity specs under `core/spec/bin/autoFixAllConfigParity/` and `monitorIssuesConfigParity/` diverge, if they cover `null`. The shell side changes in #903. Until then, adjust or skip those specific `null` parity cases with a comment pointing at #903. Don't change shell code here.
