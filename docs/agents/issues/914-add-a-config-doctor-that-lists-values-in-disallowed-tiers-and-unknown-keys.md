# Issue: Add a config doctor that lists values in disallowed tiers and unknown keys

## Description

Follow-up from #902 (part of #900). Add a read-only `arcanum config doctor` subcommand that scans all three config tiers (local, repo, global) in one pass and reports every config problem it finds.

Owner: `client` (`cli/lib/commands/config/`). Depends on #902 (registry-driven tier resolution in the JS readers).

## Problem

Since #902, values set in a tier their key does not allow (per `tiers` in `shared/lib/config/keys.json`) are skipped when reading, so they have no effect. Nothing warns about this. Today you can only find them one key at a time with `/arcanum-check-config <key>`, or by reading the full `arcanum config list` output, where they are marked `(ignored: tier not allowed)` among all the valid entries. Unknown keys (keys that match no registry entry) and values with the wrong type also go unreported. In ward, `git.safe_branch` (repo and global config) and `auto-fix-all.clear_context` / `auto-fix-all.finish_on_empty_queue` (global config) were ignored this way without anyone noticing.

## Expected Behavior

`arcanum config doctor` reads every tier file, flattens it to dotted keys (same as `config list`), and reports only the problems, grouped by tier:

1. **Disallowed tier**: the key is known, but its registry `tiers` do not include this tier, so the value is ignored on read. Show the tiers that are allowed.
2. **Unknown key**: the key matches no `keys.json` entry (neither `lookup` nor a wildcard pattern).
3. **Invalid value**: the key is known and allowed in this tier, but the value fails the registry validation (type, enum, `integer`, `min`/`max`, `allow_empty`). Reuse `KeyRegistry.check`; do not write a second validator.

Each problem has a hint line with the exact command that fixes it, e.g. `arcanum config unset <key> --<tier>`, or `arcanum config set <key> <value> --<allowed tier>` to move it. The doctor never changes any file.

- Missing tier files (e.g. no repo, or no global config) are reported as skipped, not as errors.
- A malformed tier file is reported, and the other tiers are still scanned.
- `--json` returns a structured list of problems (`tier`, `key`, `value`, `kind` = `tier` / `unknown` / `invalid`, `allowed_tiers`, `reason`, `hint`).
- Exit codes: `0` when no problems are found, `3` (`EXIT_VALIDATION`) when any problem is found, `7` (`EXIT_FILE`) when a tier file is malformed.
- The doctor takes no lock (read-only, like `config list`), and does not take the tier flags (it always scans all tiers).
- The Arcanum CLI architecture doc and the end-user guide (`cli/README.md`) document the new subcommand and its exit codes.

## Solution

- Add `cli/lib/commands/config/doctor.js` and register it in `SUBCOMMANDS` in `cli/lib/commands/config.js`.
- Reuse `readTiers` (`config/shared.js`) and `flatten` (`config/list.js`) to read and walk the tiers. Use `registry.lookup` / `registry.allowsTier` for kinds 1–2, and `registry.check` for kind 3.
- Skip bookkeeping entries that are not config values (such as the version pointers that `config info` reads), so they are not reported as unknown keys.
- Add specs under `cli/spec/` for each problem kind, a clean scan, a missing tier, a malformed tier, JSON output, and the exit codes.

Out of scope (possible follow-ups): a `--fix` mode that removes or moves offending values; reporting problems from skills or `/arcanum-check-config`.

## Benefits

- Every ignored or invalid config value shows up in one command, instead of failing silently.
- The non-zero exit code lets scripts, CI, or `/arcanum-migrate` run it as a health check.
- Users get the exact command to fix each problem.
