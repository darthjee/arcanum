# New specs: strict-keys default, zero dependencies, boundary

**Strict-keys default** (in `shared/spec/config/KeyRegistry_spec.js`'s `assertRegisteredConfigKey` describe): replace core's "defaults to process.env, which the spec runner sets" case with:

- with `process.env.ARCANUM_STRICT_CONFIG_KEYS` unset (assert it is undefined — `shared`'s runner sets no helper), `assertRegisteredConfigKey('foo.bar')` does not throw;
- with `process.env.ARCANUM_STRICT_CONFIG_KEYS = '1'` set in the spec and restored in `afterEach` (delete it if it was unset), `assertRegisteredConfigKey('foo.bar')` throws a `ConfigError` with code `UNREGISTERED_KEY` (check how `ConfigError` exposes its code in `ConfigError_spec.js`).

**Zero dependencies** — `shared/spec/packaging/package_spec.js`: read `shared/package.json` (path from `import.meta.url`, `../../package.json`) and assert that each of `dependencies`, `optionalDependencies`, `peerDependencies` is absent or an empty object. Also assert `private` is `true` (not published).

**Boundary** — `shared/spec/packaging/eslintBoundary_spec.js`, modelled on `cli/spec/packaging/eslintBoundary_spec.js`: an `ESLint` instance with `cwd` set to the `shared/` dir, `lintText` at `filePath` `lib/config/fake.js`, filtering messages by rule id.

- Accepted (no `no-restricted-imports` message): `node:fs/promises`, `node:path`, `./ConfigError.js`, `../file/Lock.js`, `./keys.json`.
- Rejected (one message each): `fs`, `path`, `../../../core/lib/context/RepoContext.js`, `../../spec/support/utils/tempDir.js`, `../../package.json`, `eslint`.
- A dynamic `import('node:fs')` yields one `no-restricted-syntax` message.
- A file under `spec/` is not subject to the boundary (e.g. `../../lib/config/ConfigChain.js` from `spec/config/fake_spec.js` gives no `no-restricted-imports` message).

## Files to Change

- `shared/spec/config/KeyRegistry_spec.js` — replaced default-env case.
- `shared/spec/packaging/package_spec.js` — new.
- `shared/spec/packaging/eslintBoundary_spec.js` — new.
