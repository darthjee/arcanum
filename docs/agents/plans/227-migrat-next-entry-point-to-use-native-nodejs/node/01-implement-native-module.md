# Implement the native module

Implement the `resolve-id-and-file` command's logic under `core/lib/` (e.g. `core/lib/ResolveIdAndFile.js`; module split beyond that is your call). It must reproduce, exactly, the current `arcanum/_lib/resolve_id_and_file.sh`:

1. **Argument parsing**: given `argString`, match it against `^#([^\s]+)(.*)$`.
   - Match with a non-empty remainder (after trimming a leading space and an optional `- ` separator) → **Scenario A**, `id` = the captured id, `title` = the trimmed, `-`→space-converted remainder.
   - Match with an empty remainder → **Scenario C**, `id` = the captured id, `title` = empty.
   - No match at all → **Scenario B**, `id` = empty, `title` = the trimmed `argString`.
2. **ID validation**: if `id` is non-empty and doesn't match `^[0-9]+$`, this is the one hard-failure case — throw/exit non-zero with `Error: issue id must be numeric and linked to a GitHub issue (got '<id>'). Local-only ids are no longer supported.` on stderr, no `STATUS=` line at all (matches `checkout_safe_branch.sh`'s hard-failure class, see [plan.md](../plan.md)).
3. **Existing-file lookup** (`_findExistingFile`): within `issuesFolder`, non-recursive, find the first entry whose name starts with `<id>_` or `<id>-`. Match order is filesystem-dependent — don't try to out-guess it (see [plan.md](../plan.md)).
4. **Scenario A resolution**:
   - Existing match → `SCENARIO=A\nID=<id>\nTITLE=<title>\nFILE=<existing>\nSTATUS=existing\n`.
   - No match → `SCENARIO=A\nID=<id>\nTITLE=<title>\nFILE=<built>\nSTATUS=new\nNEEDS_FETCH=true\n`, where `<built>` = `<issuesFolder>/<id>_<snake_case_title>.md` (`title_to_snake_case`: lowercase, `[^a-z0-9]`→`_`, collapse repeats, trim leading/trailing `_`).
5. **Scenario B resolution**: always `SCENARIO=B\nID=\nTITLE=<title>\nFILE=\nSTATUS=missing_id\n`.
6. **Scenario C resolution**:
   - Existing match → `TITLE` via `title_from_filename` (strip the extension, strip the `<id>` prefix up to the first `_`/`-`, replace remaining `_`/`-` with spaces, Title-Case each word), then `SCENARIO=C\nID=<id>\nTITLE=<derived>\nFILE=<existing>\nSTATUS=existing\n`.
   - No match → `SCENARIO=C\nID=<id>\nTITLE=\nFILE=\nSTATUS=new\nNEEDS_FETCH=true\n`.

Every branch above ends by printing the exact `SCENARIO=`/`STATUS=`/`KEY=value` lines documented in [plan.md](../plan.md) and exiting 0 (except the hard-failure id-validation case in step 2, which exits non-zero with no `STATUS=` line).

## Files to Change

- `core/lib/` (new files, naming/decomposition your call) — the module(s) implementing the six behaviors above.
