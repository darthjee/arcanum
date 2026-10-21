# Add ConfigError and convert surface throws

Create `core/lib/utils/config/ConfigError.js`:

```js
class ConfigError extends Error {
  constructor(code, message, { file } = {}) { super(message); this.name = 'ConfigError'; this.code = code; this.file = file; }
}
export default ConfigError;
```

Convert `RepoConfigWriter`'s throws, keeping every message unchanged:

- `_readBase` (`Cannot index ${file}: not a JSON object`) → `new ConfigError('NOT_AN_OBJECT', …, { file })`;
- `_setNamespaced` / `_setPath` (`Cannot index .<path>: not a JSON object`) → `ConfigError('NOT_AN_OBJECT', …)` (pass `file` where available);
- `_readLegacy`: wrap the `JSON.parse(raw)` `SyntaxError` in `ConfigError('INVALID_JSON', error.message, { file: legacyFile })` (optionally `cause`), message unchanged.

Native fs errors (`EACCES`, `ENOSPC`, …) keep propagating unwrapped. Update the JSDoc `@throws` lines.

Verify the dispatcher's bare-`Error` path still prints `arcanum: <message>` and exits 1 (no new branch in `core/bin/arcanum`).

## Files to Change
- `core/lib/utils/config/ConfigError.js` — new class.
- `core/lib/utils/config/RepoConfigWriter.js` — throw `ConfigError` with `NOT_AN_OBJECT` / `INVALID_JSON`.
- `core/spec/lib/utils/config/ConfigError_spec.js` — new: constructor sets `code`, `message`, `file`; `instanceof Error`.
- `core/spec/lib/utils/config/RepoConfigWriter_spec.js` — assert `code` and unchanged message per throw site; fs errors not wrapped.
