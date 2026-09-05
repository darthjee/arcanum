# Create dispatcherContextRouting_spec.js

New file `core/spec/lib/core/dispatcherContextRouting_spec.js` holding the three routing
`describe`s from the original, verbatim, under a single top-level wrapper
`describe('Dispatcher (context routing)', () => { … })`:

- `context: 'none' path (auto-fix-all-config-get)` — 4 `it`s (constructs module with no
  RepoContext; `commandArgs()` unchanged; `dispatch()` result; never constructs a
  RepoContext), plus its `beforeEach`/`afterEach` that build a temp repo with
  `.claude/configuration/arcanum-repo-config.json`.
- `context: 'repo' path (spawn-issue)` — 2 `it`s (constructs `SpawnIssue` with a
  `RepoContext` from `args[0]`; strips leading `repoPath` from `commandArgs()`).
- `context: 'claude' path (permission-grant-add)` — 2 `it`s (constructs `PermissionGrant`
  with a `ClaudeContext` from `args[0]`; strips leading anchor from `commandArgs()`).

Imports (copied verbatim from the original, only the ones this file uses):

```js
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Dispatcher from '../../../lib/core/dispatcher.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import ClaudeContext from '../../../lib/context/ClaudeContext.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';
```

No `noopInvocationLog` / `fakeInvocationLog` — this file does not use them.

## Files to Change

- `core/spec/lib/core/dispatcherContextRouting_spec.js` — new; the three routing
  `describe`s moved verbatim, ~85 lines.
