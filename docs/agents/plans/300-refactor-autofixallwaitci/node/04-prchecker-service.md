# Add PrChecker service

Create `core/lib/services/PrChecker.js`, extracted from `AutoFixAllWaitCi#_pollOnce`/`#_isIgnored`, following the constructor-injection DI convention used by `PrOperations`/`IssueStateService` (collaborators with sensible defaults):

```js
class PrChecker {
  constructor({ prOperations, safeFetcher = new SafeFetcher() } = {}) {
    this._prOperations = prOperations;
    this._safeFetcher = safeFetcher;
  }

  async pollOnce(prNumber, ignoredPatterns) {
    const sha = await this._safeFetcher.run(() => this._prOperations.headSha(prNumber));
    if (sha === null) return null;

    const checkRuns = await this._safeFetcher.run(() => this._prOperations.checkRuns(sha));
    if (checkRuns === null) return null;

    // ...same filter/decision tree as today's _pollOnce (unchanged), using this._isIgnored
  }

  _isIgnored(name, patterns) {
    return patterns.some((pattern) => new RegExp(pattern, 'i').test(name));
  }
}
```

`prOperations` is a required constructor argument (no default) — it's always built per-call by `AutoFixAllWaitCi#_prChecker(repoPath)` (Step 5), the same reason `PrOperations` itself takes a required `context`. Copy `_pollOnce`'s full decision-tree body (ignored-pattern filtering via `_isIgnored`, the `FAILURE_CONCLUSIONS` set, the `total`/`passedCount` comparison, and the `failed\n<names>\n` / `passed\n` / `null` return shape) byte-for-byte from `AutoFixAllWaitCi.js` — this is a pure move, not a rewrite. `FAILURE_CONCLUSIONS` moves to `PrChecker.js` as a module-level constant alongside it.

## Files to Change

- `core/lib/services/PrChecker.js` — **new** — `pollOnce(prNumber, ignoredPatterns)` + private `_isIgnored`.
- `core/spec/lib/services/PrChecker_spec.js` — **new** — tests: all check-runs passed, some failed, still pending (mixed incomplete), empty check-runs array, ignored-pattern filtering excludes a run entirely, `safeFetcher` swallowing a `prOperations` error returns `null`.
