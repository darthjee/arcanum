# Drop the shared origin from RepoContextFactory

`core/lib/context/RepoContextFactory.js` currently holds one shared
`this._origin = new Origin()` (constructor default at line 48) and forwards it
into every per-call `RepoContext` (`origin: this._origin` at line 76) — the same
shape `githubToken`/`githubIssueService` used to have before they were removed
from the factory entirely in favor of each `RepoContext` self-bootstrapping its
own instance. Give `origin` the equivalent treatment:

- Remove the `origin` parameter (and its `= new Origin()` default) from the
  constructor's destructured signature and from `this._origin`/its JSDoc
  `@param` line entirely — same as `githubToken`/`githubIssueService` today,
  which the factory's constructor doesn't mention at all.
- Remove the now-unused `import Origin from '../utils/git/Origin.js';` (line 6).
- In `build(repoPath)` (lines 73-83), drop the `origin: this._origin` line from
  the `new RepoContext({...})` call — the per-call `RepoContext` now
  self-bootstraps its own `Origin` bound to itself, per step 02.
- Update the class-level and constructor JSDoc comments that currently describe
  "one shared `origin`" (lines 22-31) to match how they already describe
  `githubToken`: each `RepoContext` self-builds its own, so there's no shared
  instance for the factory to hold.

## Files to Change

- `core/lib/context/RepoContextFactory.js` — remove the `Origin` import, the `origin` constructor param/default/field/JSDoc, and the `origin: this._origin` line inside `build()`; update the surrounding JSDoc prose.
