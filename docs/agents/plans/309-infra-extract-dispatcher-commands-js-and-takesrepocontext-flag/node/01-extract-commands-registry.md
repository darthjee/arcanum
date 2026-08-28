# Extract the COMMANDS registry into commands.js

Move the `COMMANDS` object out of `core/bin/arcanum` into a new module
`core/lib/core/commands.js`, so both `core/bin/arcanum` and the new `Dispatcher`
import it from one place.

## What to do

1. Create `core/lib/core/commands.js` exporting `export const COMMANDS = { ... }`
   with **every existing entry copied verbatim** from `core/bin/arcanum` lines
   39–95 — same keys, same `module` paths (still relative to `core/lib/`, e.g.
   `'commands/SpawnIssue.js'`), same `method` values, same `log: false` on
   `dispatch-fixture`, and the preserved comment block explaining why
   `dispatch-fixture-crash` stays logged.
2. Document the entry shape with a JSDoc `@typedef` (eslint `jsdoc/require-jsdoc`
   and `flat/recommended` are active). Fields:
   - `module` `{string}` — path under `core/lib/`.
   - `method` `{string}` — method to invoke on the default export.
   - `log` `{boolean}` `[optional]` — `false` to skip `InvocationLog` recording.
   - `takesRepoContext` `{boolean}` `[optional]` — when `true`, the command's
     constructor takes a `RepoContext` and its leading `repoPath` arg is stripped.
     **No real command entry sets this** in this issue.
3. Add exactly one **test-only fixture entry** (place it next to the other
   `dispatch-fixture*` entries, with a short comment marking it test-only and
   noting it is removed with the flag in #308 sub-issue 6):

   ```js
   'dispatch-fixture-repo-context': {
     module: 'commands/DispatchFixtureRepoContext.js',
     method: 'run',
     takesRepoContext: true,
     log: false,
   },
   ```

4. In `core/bin/arcanum`, delete the inline `COMMANDS` declaration and
   `import { COMMANDS } from '../lib/core/commands.js';` — but note the entrypoint
   after step 04 no longer references `COMMANDS` directly (the unknown-command
   throw moves into `Dispatcher`), so this import is only transitional. If step 04
   is done in the same change, `core/bin/arcanum` ends up not importing
   `commands.js` at all.

## Files to Change

- `core/lib/core/commands.js` — **new**; exports `COMMANDS` (verbatim copy) plus
  the `takesRepoContext` typedef field and the one `dispatch-fixture-repo-context`
  test-only entry.
- `core/bin/arcanum` — remove the inline `COMMANDS` object (full rewrite happens
  in step 04).
