# Create dispatcherContextGetters_spec.js

New file `core/spec/lib/core/dispatcherContextGetters_spec.js` holding the two lazy-getter
`describe`s from the original, verbatim, under a single top-level wrapper
`describe('Dispatcher (context getters)', () => { … })`:

- `repoContext getter` — 2 `it`s (lazy — `_repoContext` undefined until first read;
  memoized — repeated reads return the same instance).
- `claudeContext getter` — 2 `it`s (lazy — `_claudeContext` undefined until first read;
  memoized — repeated reads return the same instance).

Imports — only `Dispatcher`:

```js
import Dispatcher from '../../../lib/core/dispatcher.js';
```

No temp-dir helpers, no `RepoContext`/`ClaudeContext` imports (these `it`s only touch the
private `_repoContext` / `_claudeContext` fields and identity of the getter results), no
`noopInvocationLog` / `fakeInvocationLog`.

## Files to Change

- `core/spec/lib/core/dispatcherContextGetters_spec.js` — new; the two getter `describe`s
  moved verbatim, ~30 lines.
