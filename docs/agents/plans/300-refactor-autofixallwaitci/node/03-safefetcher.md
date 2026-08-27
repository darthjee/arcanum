# Add SafeFetcher utility

Create a new generic swallow-and-retry wrapper, extracted from `AutoFixAllWaitCi#_safeFetch`, at `core/lib/utils/safe/SafeFetcher.js` (new `utils/safe/` directory — none exists yet):

```js
class SafeFetcher {
  async run(fn) {
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}

export default SafeFetcher;
```

No constructor options needed — this mirrors `AutoFixAllWaitCi#_safeFetch`'s exact current behavior (any thrown error, including `AbortSignal.timeout` aborts, becomes `null`).

## Files to Change

- `core/lib/utils/safe/SafeFetcher.js` — **new**.
- `core/spec/lib/utils/safe/SafeFetcher_spec.js` — **new** — tests: resolves `fn`'s value on success, returns `null` when `fn` throws/rejects (sync throw and async rejection both).
