# Configure monitoring options

## Context

`auto-fix-all/scripts/wait_ci.sh` hardcodes an `IGNORED_CHECK_PATTERNS` array (currently just `"Codacy"`) listing CI check-run name patterns excluded from CI gating. Since `auto-fix-all` is meant to be reused across different target projects, hardcoding this list inside the skill script forces every project to ignore the same checks, regardless of whether they apply there.

## What needs to be done

- Add a JSON configuration file under `.claude/configuration/` in the target project, e.g. `.claude/configuration/auto-fix-all.json`, with a field holding an array of regex patterns to ignore (exact field name/shape decided during planning).
- Update `auto-fix-all/scripts/wait_ci.sh` to read this file from the target project's repository (current working directory) and use those patterns, interpreted as regular expressions (case-insensitive, as today), instead of the hardcoded `IGNORED_CHECK_PATTERNS`. Fall back to no ignored patterns when the file doesn't exist.
- Update `init-claude` to ask, during setup, which CI check-run patterns the user wants to ignore, and write `.claude/configuration/auto-fix-all.json` accordingly.
- Configure Arcanum's own repository with this new file (containing the `Codacy` pattern it already relies on), so this repo's own `auto-fix-all` runs keep working exactly as before once the hardcoded array is removed.

## Acceptance criteria

- [ ] `.claude/configuration/auto-fix-all.json` (or equivalent) is read by `wait_ci.sh` from the target project, not from the global `~/.claude` folder.
- [ ] Patterns in that file are treated as regular expressions, case-insensitive, same semantics as the current hardcoded list.
- [ ] No config file present → no patterns ignored (no silent behavior surprises) — except in Arcanum's own repo, which has the file configured with `Codacy`.
- [ ] `init-claude` asks about and populates this configuration during setup.
- [ ] Arcanum's own `.claude/configuration/auto-fix-all.json` exists and ignores `Codacy`, so this repo's own CI gating keeps working after the hardcoded array is removed.

---
See issue for details: https://github.com/darthjee/arcanum/issues/18

---

Tags: :shipit:
