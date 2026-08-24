# Delete dead Greeter.js

`Greeter.js` is confirmed dead code: it isn't registered in `core/bin/arcanum`'s `COMMANDS` table, nothing else imports it, and its own docstring says it was "temporary — scheduled for removal once #193 lands" (#193 already landed as the first migrated entrypoint). Delete it and its spec instead of moving it — do not create `core/lib/commands/Greeter.js` or any `utils/` equivalent.

## Files to Change

- `core/lib/Greeter.js` — delete
- `core/spec/lib/Greeter_spec.js` — delete
