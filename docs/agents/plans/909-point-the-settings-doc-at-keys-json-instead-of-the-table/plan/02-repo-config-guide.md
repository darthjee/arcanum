# Trim the repo-config guide tables
In `docs/guides/arcanum-repo-config.md` → **Documented keys**, stop repeating type, default and tier chain, and keep the user-facing behavior notes.

- Each of the three tables (`git.*`, `next_step.auto.*`, `next_step.clear.*`): change the columns from `Key | Type | Default | Chain | Notes` to `Key | Notes`.
- In the `git.safe_branch` row, remove "(repo file ignored)", which now lived only in the Chain column. Rewrite any Note that only restates the chain, such as "Resolved through the full 3-tier chain, same as `git.email`".
- Under the **Documented keys** heading, expand the existing "Full list of keys…" line to say that each key's type, allowed tiers and default are in [`keys.json`](../../shared/lib/config/keys.json) (see [Config Keys](../agents/architecture/config-keys.md)), and that `/arcanum-check-config <key>` shows where a value resolves from.
- Keep the prose about how values are interpreted (only JSON `true` enables a key, an explicit `false` shadows a lower tier, clear keys need auto keys). That is behavior, not registry data.

## Files to Change
- `docs/guides/arcanum-repo-config.md`: the Documented keys section (three tables plus the lead-in line).
