# Node Plan: Review which tiers each config key may be read from

Main plan: [plan.md](plan.md)

## Shared contracts

Relies on scripter's `next/002.sh` (global) and `next/003.sh` (local) and their exact warning wording (main plan), and on shared's new `keys.json` tiers.

## Implementation Steps

### Step 1 — Contract spec for the warn-only migrations

Add `core/spec/bin/migrationsWarnNewlyEffectiveTiers_spec.js` (or two specs, one per script), modelled on `core/spec/bin/migrationsDeleteLegacyConfig_spec.js`: the script path as one full string literal (so `scripts/bump-version.sh` rewrites it), cwd = a temp repo, and for `002` a temp `CLAUDE_CONFIG_DIR`. Cover:
- `config` prints `{"skippable": true}`;
- the manifest lists `002` as `global` and `003` as `local`, both skippable;
- each watched key present → one warning line on stderr naming key, value, file and the unset command;
- `null` values, an absent file and an empty object → no output, exit 0;
- a malformed file → one warning, exit 0;
- the files are byte-for-byte unchanged afterwards;
- `003` ignores `ignored_check_patterns` in the repo config (only the local file is checked).

### Step 2 — Re-run the core specs that touch these keys

Run the core specs that reference the changed keys: `ArcanumCheckConfig_spec`, `SafeBranch_spec`, `AutoFixAllConfig_spec`, `MonitorIssuesConfig_spec`, `NamespacedBooleanKeyConfig_spec`, `KeyRegistryDefaults_spec`, `ShellConfigKeyScan_spec`, the `autoFixAllConfigParity` / `monitorIssuesConfigParity` / `checkoutSafeBranchParity` / `autoFixAllWaitCiParity` parity specs and `initClaudeSetCiIgnoredPatternsParity_spec`. Fix any case that asserts that a global `git.safe_branch` / workflow key, or a local `ignored_check_patterns`, is ignored: it now takes effect. Add one parity case per engine for a global `auto-fix-all.clear_context: true` being honoured, and one for a local `ignored_check_patterns` overriding the repo value in `wait_ci`.

## Files to Change
- `core/spec/bin/migrationsWarnNewlyEffectiveTiers_spec.js` — new contract spec.
- `core/spec/**` — only the existing cases that break under the new tiers, plus the two parity cases above.

## CI Checks
- `core`: `make core-check` (CI jobs: `test`, `checks`)

## Notes
- No `core/lib` change is expected: readers already go through the registry-driven chain.
- `initClaudeSetCiIgnoredPatterns` must still write to the repo file; `default_tier: "repo"` guarantees that, and its parity spec confirms it.
