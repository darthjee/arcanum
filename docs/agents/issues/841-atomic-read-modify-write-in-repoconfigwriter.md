# Issue: Atomic read-modify-write in RepoConfigWriter

## Description

Part of #781 (`arcanum config` shortcuts). `arcanum config auto-fix-all ignore-checks add/remove` must re-read, modify and write `auto-fix-all.ignored_check_patterns` **inside** the lock, so that concurrent `add` calls can't lose updates (see `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md#ignore-checks`, "Atomicity").

## Problem

`shared/lib/config/RepoConfigWriter.js` offers `write`, `unset` and `setVersion`, and each one sets a value it already knows. Its `_locked` helper is private. The CLI can't hold `Lock` itself and then call the writer, because the writer acquires the same `<file>.lock` and would wait on itself.

## Expected Behavior

- A new `update({ newFile, legacyFile, namespace, key, mutate, timeoutMs })` method. Under `<newFile>.lock`, it:
  - seeds `.<namespace>` from `legacyFile` the way `write` does;
  - reads the current value at the path (`undefined` when it's absent, or when a `null`/missing intermediate is in the way);
  - calls `mutate(structuredClone(current))`. The callback gets a copy, so mutating it in place can't corrupt `previous`;
  - writes the returned value with `write`'s semantics: the same serialization, atomic tmp+rename, siblings and key order kept, and the top-level form when `namespace` is omitted (`legacyFile` is ignored then).
- **Unchanged result:** if `mutate`'s return deep-equals the current value (a structural comparison of plain JSON values, documented in the method), nothing is rewritten. The file isn't created either, and a legacy seed alone isn't written, matching `unset`.
- **Return value:** `update` resolves to `{ changed, previous, value }`, where `previous` is the value before the call and `value` is the value after it. The caller uses `changed` to report `"changed"`.
- **`mutate` returns `undefined`:** this is a usage error (`TypeError`) and nothing is written. Deleting a key stays `unset`'s job.
- **`mutate` throws:** nothing is written, the lock is released, and the error propagates unchanged. This is how the CLI refuses a non-array value with exit `3`. `mutate` may be async.
- **Timeouts and bad intermediates:** `timeoutMs` behaves as it does on the other methods (`LockTimeoutError`, `code: 'LOCK_TIMEOUT'`, nothing written). A non-object file, namespace or intermediate throws `ConfigError` `NOT_AN_OBJECT`.
- Existing methods and their specs stay unchanged.

## Solution

Changes go in `shared/lib/config/RepoConfigWriter.js`:
- Build `update` on `_locked`, `_readBase`, `_seedNamespace`, `_setNamespaced` and `_setPath`.
- Add a small private `_getPath` reader for the current value, and a private deep-equal helper.

Specs go in `shared/spec/config/RepoConfigWriter_spec.js` and cover:
- an absent key (`previous` is `undefined`);
- a nested dotted key;
- an unchanged result (no write, no file created, legacy seed not persisted);
- in-place mutation of the argument (`previous` stays intact);
- a `mutate` that throws (bytes unchanged, lock released);
- a `mutate` that returns `undefined`;
- an async `mutate`;
- the top-level form;
- the legacy seed;
- `NOT_AN_OBJECT`;
- a lock timeout;
- two concurrent `update` calls that append to the same array and both keep their change.

Add an `update` bullet to the `RepoConfigWriter` API list in `docs/agents/architecture/shared-lib.md`. Changes are limited to `shared/` and that doc, with no shell counterpart. Owner: `shared`.

## Benefits

- `ignore-checks add/remove` can be atomic, as the spec requires.
- Any future incremental edit (array or counter) has one locked primitive to build on.
