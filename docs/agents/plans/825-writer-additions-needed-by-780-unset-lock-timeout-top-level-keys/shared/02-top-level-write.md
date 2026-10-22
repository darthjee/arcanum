# Top-level write

Make `namespace` optional on `write`:

- **With a `namespace`:** unchanged, legacy seed included.
- **Without one:** under `<newFile>.lock`, read the base (`_readBase`) and set `key.split('.')` from the root of the file with the existing `RepoConfigWriter._setPath`. Missing or `null` intermediates are created, siblings and key order are kept, and a non-object intermediate throws `NOT_AN_OBJECT`. `legacyFile` is ignored (no seed), since a legacy file seeds one namespace.

Pass an error-message prefix that reads well at the root. For example, start `_setPath` with an empty prefix so the message reads `.a.b` rather than `undefined.a`. Factor this out cleanly, without changing the existing namespaced messages.

Specs:
- a flat top-level key on a new file;
- a dotted top-level path creates its intermediates;
- siblings and order are kept;
- an existing leaf is replaced in place;
- `legacyFile` is ignored with no namespace (legacy content does not appear);
- a non-object intermediate gives `NOT_AN_OBJECT` and the lock is released.

## Files to Change
- `shared/lib/config/RepoConfigWriter.js`: optional `namespace` branch in `write`, JSDoc.
- `shared/spec/config/RepoConfigWriter_spec.js`: top-level write specs.
