// Jasmine helper, loaded before every spec file: turns on the
// strict-keys read guard (see `assertRegisteredConfigKey` in
// lib/shared/config/KeyRegistry.js), so any spec exercising a
// `ConfigChain#read` / `RepoConfig` read of a key missing from
// keys.json fails. Child processes spawned by bin/parity specs
// inherit it through `process.env`.
process.env.ARCANUM_STRICT_CONFIG_KEYS = '1';
