# Specs
Add `cli/spec/lib/commands/config/doctor_spec.js`, using the same fixtures and helpers as `list_spec.js` and `info_spec.js` (`cli/spec/support/`). Cover:
- a clean config in every tier: `no problems found`, exit `0`;
- a value in a disallowed tier (e.g. `git.safe_branch` in the repo tier): kind `tier`, `allowed_tiers`, hint, exit `3`;
- an unknown key: kind `unknown`, exit `3`;
- an invalid value (wrong type, and an enum miss): kind `invalid` with `reason`, exit `3`;
- read-only keys (`version` in repo, `migrations.version` in local and global) are not reported;
- `null` values and empty objects are not reported;
- a missing repo or global tier is listed under `skipped`, not as an error;
- a malformed tier file is listed under `malformed`, the other tiers are still scanned, and the exit code is `7`, even when other problems exist;
- the `--json` shape (`problems`, `skipped`, `malformed`);
- a tier flag (e.g. `--repo`) is refused as a usage error (exit `2`), through the shared `acceptsTier` check.

Extend `cli/spec/lib/commands/config_spec.js` and `cli/spec/lib/help_spec.js` if they enumerate the subcommands or the help output.

## Files to Change
- `cli/spec/lib/commands/config/doctor_spec.js` — new.
- `cli/spec/lib/commands/config_spec.js` — `doctor` is registered and dispatched.
- `cli/spec/lib/help_spec.js` — the help entry (only if the subcommands are enumerated there).
