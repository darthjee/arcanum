# Issue: Writer additions needed by #780 (unset, lock timeout, top-level keys)

## Description

Part of epic #816 (extract the shared config logic into a `shared/` lib with its own agent). The behaviour contract lives in [docs/agents/specs/shared-lib.md](../specs/shared-lib.md#writer-additions); the epic holds the wider design decisions.

Add the three writer capabilities that `arcanum config set/unset` (#780) needs to `shared/lib/config/RepoConfigWriter.js`, with specs, so #780 becomes a pure `client` change.

## Problem

`RepoConfigWriter` today only offers `write({ newFile, legacyFile, namespace, key, value })` and `setVersion({ file, version, namespace })`. #780 needs three things it can't do:

- **No delete.** `arcanum config unset <key>` has nothing to call.
- **No lock bound.** `_locked` calls `this._lock.acquire(lockFile)` with no options, so a write waits forever. `--lock-timeout` (default 10s, `0` = try once, exit `6` on timeout) can't be honoured, although `Lock.acquire` already takes `timeoutMs` (#807).
- **No top-level write.** `write()` always needs a `namespace` plus a `key`, so a one-segment key, or an unknown one written with `--force`, can't be set at the root of the file.

## Expected Behavior

- A dotted path can be deleted from a config file under the same lock, atomic tmp+rename write and jq-identical serialization as `write`. Deleting a key that isn't set is a no-op, not an error. Empty parent objects left behind are **not** pruned.
- Every writer method accepts an optional `timeoutMs` that is passed to `Lock.acquire`. Omitted means wait forever, as today. Running out throws `LockTimeoutError` (`code: 'LOCK_TIMEOUT'`), and nothing is written.
- A key can be written at the root of the file, keeping its siblings and their order.
- Existing callers (`InitClaudeStampArcanumVersion`, `InitClaudeSetNextStepKey` and its subclasses, `InitClaudeSetCiIgnoredPatterns`) and the current `write`/`setVersion` behaviour stay unchanged; the existing specs pass untouched.

## Solution

All changes are in `shared/lib/config/RepoConfigWriter.js` and `shared/spec/config/RepoConfigWriter_spec.js`.

### 1. Optional `namespace` on `write` (top-level write)

Make `namespace` optional on `write`. Without it, `key` (dotted or flat) is a path from the root of the file, set through the existing `_setPath` (missing intermediates created, siblings kept). The legacy seed only applies when a `namespace` is given, so `legacyFile` is ignored without one. With a `namespace`, behaviour is unchanged.

### 2. New `unset({ newFile, legacyFile, namespace, key, timeoutMs })`

Mirrors `write`'s shape:

- Under `<newFile>.lock`, seed `.<namespace>` from `legacyFile` when `newFile` lacks it, exactly as `write` does. Otherwise the reader's legacy fallback would keep returning the value after an unset.
- Walk the path (rooted at `.<namespace>`, or at the root when `namespace` is omitted) and delete the leaf.
- A missing leaf, or a missing or `null` intermediate, is a no-op.
- A non-object intermediate throws `NOT_AN_OBJECT`, like `write`.
- When nothing changes, the file is not rewritten (and not created if absent).
- Empty parents are kept.

### 3. `timeoutMs` pass-through

`write`, `unset` and `setVersion` take an optional `timeoutMs`. `_locked(file, mutate, { timeoutMs })` passes it on as `this._lock.acquire(lockFile, { timeoutMs })`. A `LockTimeoutError` propagates unchanged, and nothing is written. `release` is only called when the lock was acquired. Validation of the value is left to `Lock` (`TypeError`).

### 4. Specs

In `RepoConfigWriter_spec.js`:

- top-level write: flat and dotted, sibling and order preservation, `legacyFile` ignored;
- `unset`:
  - removes a flat key and a dotted leaf;
  - keeps siblings and empty parents;
  - a missing key, file or intermediate is a no-op, with the file untouched or not created;
  - seeds from legacy before deleting;
  - a non-object intermediate gives `NOT_AN_OBJECT` and the lock is released;
  - acquires and releases `<newFile>.lock`;
  - a top-level `unset` works;
- `timeoutMs`: forwarded to `acquire` by every method, omitted means no option, and a timeout from the fake lock propagates with no write and no `release`.

Also update the class JSDoc and `shared/README.md` if it lists the writer's methods.

### Owner

`shared`.

### Out of scope

- The `arcanum config` CLI itself (#780).
- A shell `repo_config_unset` in `arcanum/_lib/repo_config.sh`.
- Registry validation (read-only keys, tiers): that belongs to #780.

### Dependencies

After #824 (switch-over, merged).

## Benefits

- #780 becomes a pure `client` change, with no edits to `shared/` mixed in.
- `--lock-timeout` uses the bound `Lock` already supports, so a stuck lock can't hang the CLI.
- Delete and top-level write share the lock, atomic write and serialization of the existing writer, so shell and native writers keep excluding each other.
