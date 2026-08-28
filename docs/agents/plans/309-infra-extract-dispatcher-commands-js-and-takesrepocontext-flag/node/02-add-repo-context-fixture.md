# Add the repo-context fixture command

Create a small fixture command that receives a `RepoContext` at construction, so
`Dispatcher`'s flag-on branch can be exercised end-to-end through the real
`COMMANDS` registry (entry added in step 01). It is kept as a **separate module**
rather than a new method on `DispatchFixture`, so `DispatchFixture`'s
byte-identical shell-parity contract stays untouched.

## What to do

1. Create `core/lib/commands/DispatchFixtureRepoContext.js`:
   - `constructor(repoContext)` — stores it.
   - `run(...args)` — returns a deterministic string that proves both what it
     received and that the leading `repoPath` arg was stripped by
     `Dispatcher.commandArgs()`, e.g.:

     ```js
     run(...args) {
       return `dispatch-fixture: repoPath=${this.repoContext.repoPath} args=${args.join(',')}\n`;
     }
     ```
   - Full JSDoc on the class, constructor, and `run` (eslint requires it).
   - Class doc should state it is throwaway test scaffolding for the
     `takesRepoContext` flag, removed with the flag in #308 sub-issue 6.
2. Add `core/spec/lib/commands/DispatchFixtureRepoContext_spec.js`:
   - `run()` echoes `repoContext.repoPath` and joins its args.
   - constructed with a stub `{ repoPath: '/fake/repo' }` — no real `RepoContext`
     needed (mirrors `DispatchFixture_spec.js`'s minimalism).

## Files to Change

- `core/lib/commands/DispatchFixtureRepoContext.js` — **new**; `constructor(repoContext)`
  + `run(...args)` echoing `repoPath` and args.
- `core/spec/lib/commands/DispatchFixtureRepoContext_spec.js` — **new**; unit spec
  for the fixture module.
