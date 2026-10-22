# Unset

Add `async unset({ newFile, legacyFile, namespace, key, timeoutMs })`, with the same shape as `write`.

Under `<newFile>.lock` (with `timeoutMs` passed on):
1. Read the base with `_readBase`, which treats a missing or invalid file as `{}` and throws `NOT_AN_OBJECT` for a non-object.
2. With a `namespace` the new file lacks, seed `.<namespace>` from `legacyFile` exactly as `write` does. Otherwise the reader's legacy fallback would keep returning the value.
3. Walk `key.split('.')` from `.<namespace>`, or from the root with no namespace:
   - a missing or `null` intermediate or leaf is a no-op;
   - a non-object intermediate (the namespace value included) throws `NOT_AN_OBJECT`, with the same message format as `write`;
   - otherwise `delete` the leaf.
4. Leave empty parent objects in place; do not prune.

**No-op means no write.** When nothing was deleted, the file must not be rewritten, and not created if it was absent. Let `_locked`'s `mutate` signal "unchanged", for example by returning `null`, which makes `_locked` skip the tmp+rename but still release the lock. `write`/`setVersion` always return the object, so they are unaffected. The parent `mkdir` before the lock still runs, because the lock file needs it.

Edge: a legacy seed followed by a missing key is still "unchanged". Do not write the seed alone.

Specs:
- removes a flat key and a dotted leaf, keeping siblings, order and the now-empty parents;
- a missing key, a missing file or a missing/`null` intermediate is a no-op: bytes unchanged, or the file still absent;
- seeds from legacy, then deletes;
- a top-level `unset` with no namespace works;
- a non-object intermediate or namespace gives `NOT_AN_OBJECT` and the lock is released;
- acquires and releases `<newFile>.lock`;
- writes via `<file>.tmp` + rename;
- forwards `timeoutMs`.

## Files to Change
- `shared/lib/config/RepoConfigWriter.js`: `unset`, a path-delete helper, the `_locked` "unchanged" signal, JSDoc.
- `shared/spec/config/RepoConfigWriter_spec.js`: `#unset` specs.
