# Client Plan: Make CLI config shortcuts take their tier from keys.json

Main plan: [plan.md](plan.md)

## Shared contracts

Relies on `KeyRegistry#defaultTier(keyOrPattern)` from shared (rule: `default_tier` → only tier → `local` if allowed → first tier; `null` for unknown keys). The seeded values make every shortcut's default identical to today's: engine/git merge-body/next-step → local; git safe-branch and the auto-fix-all/monitor-issues booleans → local (only tier); agents email → global; ignore-checks → repo (only tier).

## Implementation Steps

### Step 1 — Shortcuts and setup take their default tier from the registry

- `singleValue.js`: drop `tier` from every `SINGLE_VALUE` entry. `runSingleValue` resolves the default with `context.registry.defaultTier(key)` (or the bundled registry when the context has none) wherever it used `defaultTier` before.
- `nextStep.js`: remove `DEFAULT_TIER` and resolve it per concrete key (`next_step.auto.<skill>`).
- `agentsEmailRead.js` / `agentsEmail.js` / `agentsEmailEdit.js`: remove `DEFAULT_TIER` and resolve it from `git.email` / `git.agents.<agent>`.
- `ignoreChecks.js`: remove `TIER` and use the registry default for `auto-fix-all.ignored_check_patterns`, including the listing's `readTiers` and the `displayFile` label.
- `defaultTier.js`: delete the `DEFAULT_TIERS` map and its imports. Either make `defaultTier(key, registry)` a thin wrapper over `registry.defaultTier` or delete the file and point `setup.js` (line ~163) at the registry directly.
- The existing `--global`/`--repo`/`--local` flags stay unchanged and keep being checked against `tiers`.
- Specs: update `singleValue_spec.js`, `nextStep_spec.js`, `agentsEmail_spec.js`, `agentsEmailEdit_spec.js`, `ignoreChecks_spec.js` and `setup_spec.js`. Add one case that passes a stub registry with a different `tiers`/`default_tier` and checks that the shortcut follows it with no CLI change.

### Step 2 — Help text from the registry

`cli/lib/help.js` hardcodes "(local tier only)" / "(repo tier only)" in the `git safe-branch`, `auto-fix-all clear-context`, `finish-on-empty-queue`, `ignore-checks` and `monitor-issues clear-context` summaries. Build those suffixes from the key's `tiers`: "(<tier> tier only)" for a single tier, nothing otherwise. Update `help_spec.js`, `docs/agents/architecture/arcanum-cli.md` (Shortcuts / Design rules / per-setting flow: the default tier now comes from `keys.json`'s `default_tier` + rule) and the CLI user guide where it states shortcut defaults.

## Files to Change

- `cli/lib/commands/config/shortcuts/singleValue.js`, `nextStep.js`, `agentsEmail.js`, `agentsEmailRead.js`, `agentsEmailEdit.js`, `ignoreChecks.js`, `defaultTier.js` — remove the hardcoded tiers and use the registry default.
- `cli/lib/commands/config/setup.js` — default tier from the registry.
- `cli/lib/help.js` — generated tier suffixes.
- `cli/spec/lib/commands/config/shortcuts/*_spec.js`, `cli/spec/lib/commands/config/setup_spec.js`, `cli/spec/lib/help_spec.js` — specs.
- `docs/agents/architecture/arcanum-cli.md`, `cli/README.md` / user guide — docs.

## CI Checks

- `cli`: `yarn lint && yarn build && yarn test` (CI jobs: `cli`, `cli-node-floor`)

## Notes

- `help.js` may be evaluated at import time. If so, compute the suffix lazily or from the bundled registry; esbuild inlines `keys.json` already.
- Keep refusal messages (e.g. `git.safe_branch is local-only`, exit 3) as they are: they already come from `KeyRegistry#check`.
