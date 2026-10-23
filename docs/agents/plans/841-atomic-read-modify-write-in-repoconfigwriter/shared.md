# Plan: Atomic read-modify-write in RepoConfigWriter (shared)

Main plan: [plan.md](plan.md)
Issue: [841-atomic-read-modify-write-in-repoconfigwriter.md](../../issues/841-atomic-read-modify-write-in-repoconfigwriter.md)

## Overview
Add `update({ newFile, legacyFile, namespace, key, mutate, timeoutMs })` to `shared/lib/config/RepoConfigWriter.js`. While holding `<newFile>.lock`, it reads the current value at the key, passes `mutate` a `structuredClone` of that value, and writes the result with `write`'s semantics. It writes only when the result differs from the current value.

It resolves to `{ changed, previous, value }`.

## Context
- The CLI can't take `Lock` and then call the writer, because the writer re-acquires the same `<file>.lock` and would wait on itself. That's why the read-modify-write has to live inside the writer.
- `_locked(file, mutate)` already treats a `null` return as "skip the write" (`unset` uses this), releases the lock in a `finally`, and lets an acquire failure propagate. `update` builds on it directly.
- Behaviour to keep, from the issue:
  - **Unchanged result:** when the result deep-equals the current value, nothing is written. The file isn't created and a legacy seed isn't persisted on its own.
  - **`undefined` result:** a `TypeError`, with nothing written.
  - **Errors from `mutate`:** they propagate unchanged, the lock is released, and the file's bytes stay the same.
  - **`NOT_AN_OBJECT`:** thrown as `ConfigError` for a non-object file, namespace or intermediate.
  - **`timeoutMs`:** works as it does on the other methods.

## Steps

- [01 — Add the path reader and deep-equal helpers](shared/01-path-reader-and-deep-equal.md)
- [02 — Add update and its specs](shared/02-update-method-and-specs.md)
- [03 — Document update in the writer API](shared/03-docs.md)

## CI Checks
- `shared`: `cd shared && yarn lint && yarn test` (CI jobs: `shared`, `shared-node-floor`)

## Notes
- No changes to `cli/` or `core/`, and no shell counterpart. `update` is native-only, like `unset`. #781 consumes it later.
- Keep `write`, `unset` and `setVersion`, and their specs, byte-for-byte unchanged.
- Coverage is uploaded to Codacy from the `shared` job, so cover every new branch: the absent intermediate, the `null` intermediate, a non-object, and each deep-equal type.
