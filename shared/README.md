# shared

Code consumed by both [`core/`](../core) and [`cli/`](../cli). Its first content is
Arcanum's config surface: `ConfigChain`, `RepoConfig`, `RepoConfigWriter`,
`ConfigError`, `AgentEmail`, `KeyRegistry` (with `keys.json`), `Lock`,
`LockTimeoutError` and `RepoPath`.

The design lives in the [Shared Lib spec](../docs/agents/specs/shared-lib.md).

## Layout

```text
shared/
  lib/
    config/   ConfigChain.js, RepoConfig.js, RepoConfigWriter.js, ConfigError.js,
              AgentEmail.js, KeyRegistry.js, keys.json
    file/     Lock.js, LockTimeoutError.js, RepoPath.js
  spec/
    config/   <Name>_spec.js, mirroring lib/config/ 1:1
    file/     <Name>_spec.js, mirroring lib/file/ 1:1
    packaging/ package-level specs (zero dependencies, import boundary)
    support/  spec support used only by these specs
  package.json, yarn.lock, eslint.config.mjs, README.md
```

## Import boundary

- `shared/lib/**` imports only `node:` built-ins (never a bare `'fs'`) and files
  under `shared/lib/`. Dynamic `import()` is not allowed. This is enforced by
  `eslint.config.mjs`.
- Everything under `shared/lib/` is public; there is no allowlist.
- `core/` and `cli/` may import `shared/lib/**` by relative path, but never
  `shared/spec/**`.
- `shared/spec/**` never imports anything outside `shared/`.

## Dependencies

`shared/` has **zero runtime dependencies**. Jasmine, c8 and ESLint are
devDependencies only. A spec (`spec/packaging/zeroDependencies_spec.js`)
enforces this.

## Running lint and specs

From the repo root, inside the test container (Docker required):

```bash
make shared-test    # Jasmine under c8, coverage thresholds enforced
make shared-lint
make shared-check   # lint, then test
```

Alternatively, inside `shared/` on the host, with Node 22.13+ and Yarn:

```bash
yarn install
yarn lint
yarn test   # Jasmine under c8, coverage thresholds enforced
```

The spec runner does not set `ARCANUM_STRICT_CONFIG_KEYS`; the strict-keys
guard is covered by explicit specs instead.
