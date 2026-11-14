# Trim the global-config guide
In `docs/guides/arcanum-global-config.md` → **Which keys use it**, stop listing which keys do or don't allow the global tier.

- Replace the key-by-key prose (the `git.email`, … list, "`git.safe_branch`, `auto-fix-all.clear_context`, … are read from this file and the local state file…", and "A few keys are not read from this file at all, e.g. `auto-fix-all.ignored_check_patterns`…") with:
  - one sentence saying a key is read from this file only if its `tiers` in [`keys.json`](../../shared/lib/config/keys.json) includes `global` (see [Config Keys](../agents/architecture/config-keys.md));
  - a pointer to `/arcanum-check-config <key>`, which shows a value in a disallowed tier as `ignored: tier not allowed`.
- Keep the global-tier-specific notes: the skippable `/arcanum-migrate` global-tier migration for the `next_step.auto.<skill>` keys, and the step that lists values which start taking effect when a key gains the global tier.
- Leave the `migrations.version` pointer section untouched.

## Files to Change
- `docs/guides/arcanum-global-config.md`: the "Which keys use it" section.
