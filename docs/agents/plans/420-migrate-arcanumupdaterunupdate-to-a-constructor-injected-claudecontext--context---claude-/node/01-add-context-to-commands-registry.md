# Give the command registry entries context: 'claude'

Register `arcanum-update-run-update-check` / `-apply` as `context: 'claude'` in the
central command table, so `Dispatcher#commandInstance()` builds a `ClaudeContext` from
the leading CLI argument and passes it to `ArcanumUpdateRunUpdate`'s constructor
(`Dispatcher#isContextBound()` already treats `'claude'` as context-bound, stripping that
leading argument from the method args — no dispatcher code change needed for this, see
step 03).

## Files to Change

- `core/lib/core/commands.js`:
  - Add `context: 'claude'` to both the `'arcanum-update-run-update-check'` and
    `'arcanum-update-run-update-apply'` entries (currently `{ module: ..., method: ... }`
    with no `context` key at all, i.e. implicitly `'none'`).
  - Update the top-of-file `CommandEntry` typedef comment: move
    `arcanum-update-run-update-*` out of the `'none'` / absent bullet's example list
    (currently "Applies to `dispatch-fixture-crash`, `auto-fix-all-config-*`, and
    `arcanum-update-run-update-*`") and into the `'claude'` bullet's example list
    (currently "Only `permission-grant-add`" — becomes something like "`permission-grant-add`
    and `arcanum-update-run-update-*`").
