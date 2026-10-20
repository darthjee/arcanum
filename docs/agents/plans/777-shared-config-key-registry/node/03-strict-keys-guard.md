# Strict-keys read guard

Implement layer 1 of [Enforcing "a new key means a registry entry"](../../../specs/arcanum-cli/key-registry.md#enforcing-a-new-key-means-a-registry-entry).

- **`ConfigChain#read`.** When the `ARCANUM_STRICT_CONFIG_KEYS` env var is `1`, build `<namespace>.<key>` for every key argument and throw a plain `Error` naming the key if `KeyRegistry.lookup` finds no entry.
  - Read the variable from the injected `env` (default `process.env`), so specs can toggle it.
  - Do **not** guard `readTiers`. `/arcanum-check-config` inspects arbitrary user-supplied keys through it.
- **`RepoConfig`'s reads** (`getSafeBranch`, `getIgnoredCheckPatterns`): apply the same check for their fixed keys `git.safe_branch` and `auto-fix-all.ignored_check_patterns`. Keep it simple, e.g. a shared helper on the surface that both call.
- **Spec runner.** Set `ARCANUM_STRICT_CONFIG_KEYS=1` for every core spec run, e.g. a Jasmine helper under `core/spec/support/` listed in `jasmine.json`'s `helpers`, setting `process.env` before specs load. Child processes spawned by bin/parity specs inherit it. Also cover `spec/support/jasmine-docker.json` if it runs Node config reads.
- **Existing specs.** Any spec (notably `ConfigChain_spec.js`) that reads made-up keys such as `foo.bar` must switch to registered keys, or explicitly construct `ConfigChain` with an `env` lacking the variable for those cases. Add guard specs: the variable set plus an unknown key throws, the variable set plus a known key (exact and wildcard) passes, and the variable unset never throws.
- Production behaviour is unchanged: the variable is never set outside specs.

## Files to Change
- `core/lib/utils/config/ConfigChain.js` — guard in `read`.
- `core/lib/utils/config/RepoConfig.js` — guard on its reads.
- `core/spec/support/<strictConfigKeys>.js` + `core/spec/support/jasmine.json` — set the variable for every spec run.
- `core/spec/lib/utils/config/ConfigChain_spec.js`, `RepoConfig_spec.js` and any other spec that breaks under the guard — adapt and add guard cases.
