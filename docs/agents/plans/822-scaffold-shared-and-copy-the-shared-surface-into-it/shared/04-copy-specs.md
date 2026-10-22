# Copy support and specs

Follow the spec's [Spec-file inventory](../../../specs/shared-lib.md#spec-file-inventory).

**Support** (copied, never imported across folders):

- `core/spec/support/utils/tempDir.js` → `shared/spec/support/utils/tempDir.js`
- `core/spec/support/utils/gitFixtureRepo.js` → `shared/spec/support/utils/gitFixtureRepo.js`
- `core/spec/support/fixtures/agentEmailFixtures.js` → `shared/spec/support/fixtures/agentEmailFixtures.js`
- `shared/spec/support/factories/repoContextFactory.js` — a **reduced** copy: keep the `createRepoContextMock({ repoPath = '/fake/repo', ...overrides } = {})` export so the copied specs need no change, but return a plain object `{ repoPath }` (plus any overridden collaborator the specs pass, e.g. `configChain`) instead of core's `RepoContext`. Check `ConfigChain_spec.js` and `RepoConfig_spec.js` for what they actually read; `ConfigChain` and `RepoConfig` only read `repoContext.repoPath`. Keep a JSDoc comment explaining why it is reduced.

**Moved specs** — copy from `core/spec/lib/shared/` into `shared/spec/`, rewriting only import paths (`../../../../lib/shared/<area>/X.js` → `../../lib/<area>/X.js`, `../../../support/...` → `../support/...`) and any `import.meta.url`-relative path (e.g. `keys_spec.js`'s `KEYS_FILE` → `../../lib/config/keys.json`):

- `config/AgentEmail_spec.js`, `config/ConfigChain_spec.js`, `config/ConfigError_spec.js`, `config/KeyRegistry_spec.js`, `config/keys_spec.js`, `config/RepoConfig_spec.js`, `config/RepoConfigWriter_spec.js`
- `file/LockTimeoutError_spec.js`, `file/RepoPath_spec.js`

`KeyRegistry_spec.js` keeps asserting the error text with `core/lib/shared/config/keys.json` (matching the byte-identical lib). Its case "defaults to process.env, which the spec runner sets" is replaced in step 05.

**`Lock_spec.js`** — `shared/spec/file/Lock_spec.js` gets the unit `describe`s only: `#acquire`, mutual exclusion, `#release`, stale locks (including `#_parseId` / `#_isAlive`), bound. Drop the `cross-implementation race with arcanum/_lib/lock.sh` block and anything only it uses (`REPO_ROOT`, `LOCK_SH`, and helpers such as `bashAvailable`/`run` if nothing else uses them). Core's `Lock_spec.js` stays whole.

Then grep `shared/spec` for `core/`, `arcanum/` and `../../../` to confirm nothing reaches outside `shared/`.

## Files to Change

- `shared/spec/support/utils/tempDir.js`, `shared/spec/support/utils/gitFixtureRepo.js`, `shared/spec/support/fixtures/agentEmailFixtures.js` — new, copied.
- `shared/spec/support/factories/repoContextFactory.js` — new, reduced.
- `shared/spec/config/*_spec.js`, `shared/spec/file/{LockTimeoutError,RepoPath,Lock}_spec.js` — new, copied.
