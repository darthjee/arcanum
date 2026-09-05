# Create dispatcherErrorHandling_spec.js

New file `core/spec/lib/core/dispatcherErrorHandling_spec.js` holding the two error/validation
`describe`s from the original, verbatim, under a single top-level wrapper
`describe('Dispatcher (error & repoPath validation)', () => { … })`:

- `unknown command` — 1 `it` (`dispatch()` rejects with an `Error` naming the command).
- `context: 'repo' repoPath validation` — 6 `it`s: "not a directory" for a
  present-but-non-directory leading arg (before module import); "not a git repository" for a
  non-git directory; `record()` before `validate()` before module import (ordering proof);
  absent leading arg → "repo_path is required" (see `#333`); `validateRepoPath: false` entry
  (`github-issue-info`) skips validation; `context: 'claude'` entry is never validated.

Imports (copied verbatim, only the ones this file uses):

```js
import Dispatcher from '../../../lib/core/dispatcher.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';
```

Copy **both** module-level locals from the original into this file: the `noopInvocationLog`
const and the `fakeInvocationLog(events)` helper (with its JSDoc) — this block uses both.
`jasmine` / `spyOn` / `expectAsync` are Jasmine globals — no import.

## Files to Change

- `core/spec/lib/core/dispatcherErrorHandling_spec.js` — new; the `unknown command` and
  `context: 'repo' repoPath validation` `describe`s moved verbatim, plus copies of
  `noopInvocationLog` and `fakeInvocationLog`, ~90 lines.
