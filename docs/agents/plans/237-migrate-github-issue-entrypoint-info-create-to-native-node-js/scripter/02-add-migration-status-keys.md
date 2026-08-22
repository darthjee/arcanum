# Add per-subcommand keys to migration-status.json

Add two new keys to `arcanum/_lib/migration-status.json`, both `true`. Leave the existing bare `"github-issue": false` entry untouched — it no longer represents this script's actual state as a single unit now that sub-commands migrate independently, but retiring/repurposing it is out of scope for this sub-issue (leave a note, don't remove it — other still-unmigrated sub-commands' future sub-issues may want to add their own keys the same way, e.g. `github-issue-fetch`, `github-issue-update`).

```json
{
  ...
  "github-issue-create": true,
  "github-issue-info": true,
  "github-issue": false,
  ...
}
```

(Insert alphabetically near the other `github-issue*`/`checkout-safe-branch`/`list-agents` keys, matching the file's existing loose grouping — exact position doesn't matter functionally, `_engine_dispatch_native_available` does a `jq` lookup, not an ordered scan.)

## Files to Change

- `arcanum/_lib/migration-status.json` — add `github-issue-info: true` and `github-issue-create: true`.
