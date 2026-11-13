# Client Plan: Review which tiers each config key may be read from

Main plan: [plan.md](plan.md)

## Shared contracts

Relies on the new `keys.json` tiers from the main plan (shared). `cli/` bundles `keys.json` at build time, so run `make cli-build` before the specs.

## Implementation Steps

### Step 1 — Update CLI specs pinned to the old tiers

- `cli/spec/lib/help_spec.js` ~138–139 and ~165–167: `tierSuffix('git.safe_branch')` becomes `' (default write tier: local)'`, and `auto-fix-all.ignored_check_patterns` becomes `' (default write tier: repo)'`. Update the `SHORTCUT_HELP` summaries accordingly ("Read or set git.safe_branch (default write tier: local)", …). Pick another single-tier key for the "(X tier only)" example, e.g. `version` → `' (repo tier only)'`.
- `cli/spec/lib/commands/config/setup_spec.js` ~159–160: default tiers stay `local` / `repo`; check that `askTier` now offers a choice for these keys (they are multi-tier) and adjust any scripted prompter answers.
- `cli/spec/lib/commands/config/get_spec.js` (~245–313) and `list_spec.js` (~56–73): these use `git.safe_branch` **in the repo tier** as the ignored example. Repo stays disallowed, so they should pass unchanged. Run them and fix only what actually fails.
- `cli/spec/lib/commands/config/shortcuts/ignoreChecks_spec.js`, `singleValue_spec.js`, `set_spec.js`, `unset_spec.js`: fix any case asserting that a global `git.safe_branch`, a global workflow key or a local `ignored_check_patterns` is rejected. Those writes are now accepted.
- `cli/spec/lib/skew_spec.js`: `pointerOf` reads files directly, so no change is expected. Confirm.

### Step 2 — Confirm `arcanum config unset` syntax for the migration message

Confirm the exact syntax for unsetting a key in a given tier (`cli/lib/commands/config/unset.js`) and report it back, so scripter's warning text and node's spec use it (see the main plan's migration contract).

## Files to Change
- `cli/spec/lib/help_spec.js` — new tier suffixes.
- `cli/spec/lib/commands/config/setup_spec.js` — multi-tier prompts for these keys.
- `cli/spec/lib/commands/config/**` specs — only the cases that break.
- `cli/lib/help.js` — only if a summary string is hardcoded rather than derived from `tierSuffix`.

## CI Checks
- `cli`: `make cli-check` (CI jobs: `cli`, `cli-node-floor`)

## Notes
- No CLI source change is expected: tier suffixes, default tiers and tier checks are all registry-driven.
