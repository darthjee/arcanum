# Rename the migration-status.json key

- In `arcanum/_lib/migration-status.json`, rename the key `"permission-grant"`
  (currently line 10, value `true`) to `"permission-grant-add"`, keeping the
  value `true`.
- Keep it in the same position in the file (line 10, between `"github-issue"` and
  `"checkout-safe-branch"`). The file is not alphabetically sorted — it is
  roughly insertion-ordered — so an in-place key rename is correct; do not
  resort.
- No other keys change. `"github-issue": false` staying alongside
  `"github-issue-create/-info": true` is an existing, deliberate inconsistency —
  do not "fix" it. There is no non-migrated `permission-grant` sibling verb, so
  no parent `"permission-grant": false` key is added (straight rename, per the
  issue).

## Files to Change

- `arcanum/_lib/migration-status.json` — rename one key on line 10.
