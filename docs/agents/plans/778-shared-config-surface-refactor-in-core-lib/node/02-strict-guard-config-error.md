# Convert the strict-keys guard to ConfigError

#777's `assertRegisteredConfigKey` in `core/lib/utils/config/KeyRegistry.js` (called by `ConfigChain#read` and `RepoConfig`'s read when `ARCANUM_STRICT_CONFIG_KEYS=1`) throws a plain `Error`. Make it throw `new ConfigError('UNREGISTERED_KEY', <same message naming the key>)`. Production behaviour (guard off) is unchanged.

`KeyRegistry.js` then imports `./ConfigError.js` — allowed by the surface allowlist.

## Files to Change
- `core/lib/utils/config/KeyRegistry.js` — throw `ConfigError('UNREGISTERED_KEY', …)`.
- `core/spec/lib/utils/config/KeyRegistry_spec.js`, `ConfigChain_spec.js`, `RepoConfig_spec.js` — assert `code: 'UNREGISTERED_KEY'` on the strict-mode cases.
