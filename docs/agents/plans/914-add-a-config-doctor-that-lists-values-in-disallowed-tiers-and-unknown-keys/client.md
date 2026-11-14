# Client Plan: Add a config doctor that lists values in disallowed tiers and unknown keys

Main plan: [plan.md](plan.md)

## Overview
A new subcommand, `arcanum config doctor` (`cli/lib/commands/config/doctor.js`). It reads every tier the same way `config list` does and reports only the problems. It never writes a file and never takes a lock.

## Context
- Since #902, `ConfigChain` skips values in a tier their key's `tiers` (in `shared/lib/config/keys.json`) don't allow. `config list` already marks those lines `(ignored: tier not allowed)`, but only among every other entry, and it always exits `0`.
- Building blocks you can reuse:
  - `readTiers(context, { allTiers })` in `cli/lib/commands/config/shared.js`. It resolves targets, reads each tier with `readTierTolerant` (a malformed file is warned about and read as `{}`), and returns `{ tier, file, read }`, where `read.state` is one of `ok`, `missing`, `empty`, `invalid_json`, `not_object`, `unreadable` or `not_utf8`.
  - `isMalformed(state)` in `cli/lib/tierFiles.js`.
  - `flatten(data)`, exported from `cli/lib/commands/config/list.js`.
  - `registry.lookup`, `registry.allowsTier` and `registry.check('set', key, tier, value)` from `shared/lib/config/KeyRegistry.js`. `check` runs its checks in the order `unknown`, `read_only`, `tier`, then the value checks (`null`, `type`, `enum`, `empty`, `integer`/`min`/`max`, `format`). The value checker `valueFailure` is **not** exported, so the doctor must go through `check`.
  - The exit codes in `cli/lib/exitCodes.js`: `EXIT_OK` (0), `EXIT_VALIDATION` (3), `EXIT_FILE` (7).
- Subcommands are registered in `SUBCOMMANDS` (`cli/lib/commands/config.js`), and their help lives in `SUBCOMMAND_HELP` (`cli/lib/help.js`).

## Steps

- [01 — Implement the doctor subcommand](client/01-implement-doctor.md)
- [02 — Specs](client/02-specs.md)
- [03 — Documentation](client/03-docs.md)

## CI Checks
- `cli`: `cd cli && yarn lint && yarn build && yarn test` (CI jobs: `cli`, `cli-node-floor`)

## Notes
- **Read-only keys** (`version`, `migrations.version`): `check` returns `read_only` before it validates the value. Check the tier with `allowsTier` first. Then skip value validation for entries with `read_only: true`, because migrations manage them. Never report `read_only` itself as a problem.
- **`null` values and empty objects**: `flatten` treats both as leaves. A `null` reads as unset in `ConfigChain`, and `{}` is an empty namespace. Skip both instead of reporting them as unknown or invalid keys.
- **Exit-code priority**: `7` when any scanned tier is malformed, even if there are other problems. Otherwise `3` when there is at least one problem, else `0`. Still print the full report (human or JSON) before exiting non-zero.
- **Unknown keys** get a hint to unset them only. There is no sensible tier to move them to.
