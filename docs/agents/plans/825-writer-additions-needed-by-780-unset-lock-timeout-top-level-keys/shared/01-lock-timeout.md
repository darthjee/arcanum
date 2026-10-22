# Lock timeout pass-through

Give `write`, `setVersion` and (in step 03) `unset` an optional `timeoutMs` argument. Thread it through `_locked(file, mutate, { timeoutMs } = {})`, which calls `this._lock.acquire(lockFile, { timeoutMs })`.

- **Omitted:** `timeoutMs` is `undefined`, so `Lock` waits forever, as today.
- **Validation:** left to `Lock._deadline`, which throws `TypeError`.
- **Timeout:** a `LockTimeoutError` (`code: 'LOCK_TIMEOUT'`) from `acquire` propagates unchanged. Because `acquire` sits before the `try`, `release` is not called and nothing is written. Keep it that way.

Specs, in `shared/spec/config/RepoConfigWriter_spec.js`:
- use a spy or a fake lock;
- check that `write` and `setVersion` forward `timeoutMs` to `acquire`;
- check that leaving `timeoutMs` out passes `timeoutMs: undefined`, so the existing behaviour holds;
- check that a rejected `acquire` (a `LockTimeoutError`) propagates, with no `writeFile`/`rename` and no `release`;
- add one real-`Lock` example: a pre-held `<file>.lock` with `timeoutMs: 0` rejects with `code: 'LOCK_TIMEOUT'` and leaves the file untouched.

## Files to Change
- `shared/lib/config/RepoConfigWriter.js`: `timeoutMs` on `write`/`setVersion`, `_locked` options, JSDoc.
- `shared/spec/config/RepoConfigWriter_spec.js`: timeout specs.
