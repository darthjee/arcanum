# Remove the dispatch-fixture command entry

Remove `dispatch-fixture` from the `COMMANDS` registry in `core/lib/core/commands.js`, keeping `dispatch-fixture-crash` untouched. Update the file's `CommandEntry` typedef doc comment, which currently lists `dispatch-fixture` alongside `dispatch-fixture-crash`, `auto-fix-all-config-*`, and `arcanum-update-run-update-*` as examples of `context: 'none'` — drop `dispatch-fixture` from that list, keep the other three.

## Files to Change

- `core/lib/core/commands.js` — delete the `'dispatch-fixture': { module: 'commands/shared/DispatchFixture.js', method: 'run', log: false }` entry; edit the `context: 'none'` doc-comment list to remove `dispatch-fixture`.
