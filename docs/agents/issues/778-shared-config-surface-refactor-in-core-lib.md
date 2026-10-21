# Issue: Shared config surface refactor in core/lib

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration). Prepare the `core/lib` config logic to be bundled into the `arcanum-cli` package, as designed in `docs/agents/specs/arcanum-cli/shared-config-logic.md` (the spec is authoritative; this issue scopes the `core/` implementation).

Owner: `node`. Scope is limited to `core/`; the CLI-side guardrails (`cli/eslint.config.mjs` restriction on `core/lib` imports, esbuild metafile surface check) belong to #779.

## Problem

- The CLI must read and write config exactly like the skills, but it cannot import `core/lib` at runtime, so the files it bundles need a declared, enforced boundary (node built-ins and each other only).
- The surface files throw bare `Error`s, so the CLI cannot map failures to its exit codes by `code`.
- The agent-email wrapper is duplicated in three native `_agentEmailGet` copies, none exposes provenance (tier/key), and native diverges from the shell on an explicit `""` (native yields an empty co-author email; shell falls back to the model email).
- The CLI needs `--repo` normalization to the git toplevel, which `RepoPath` does not offer.

## Expected Behavior

- Dispatcher (`core/bin/arcanum`) stdout, stderr and exit codes stay byte-identical — no new mapping branch.
- Under `ARCANUM_STRICT_CONFIG_KEYS=1` (specs only), an unregistered key throws `ConfigError` with `code: 'UNREGISTERED_KEY'`.
- `AgentEmail#get` returns the model email when the resolved value is `null`/absent **or** `""` (deliberate native fix, aligned with shell; to be called out in release notes).
- Lint fails if a shared-surface file imports anything other than `node:` built-ins and other surface files, or uses dynamic `import()`.

## Solution

1. **Shared-surface declaration** — new block in `core/eslint.config.mjs` with an explicit `files` list (authoritative declaration): `ConfigChain.js`, `RepoConfig.js`, `RepoConfigWriter.js`, `ConfigError.js`, `AgentEmail.js`, `KeyRegistry.js` (+ `keys.json`), `file/Lock.js`, `file/RepoPath.js`. `no-restricted-imports` allowlist (`node:*` and surface files) plus `no-restricted-syntax` banning `ImportExpression`, exactly as in the spec. `BooleanKeyConfig.js` stays off the surface and keeps `DispatchFailure`.
2. **`core/lib/utils/config/ConfigError.js`** — `class ConfigError extends Error { constructor(code, message, { file } = {}) }`. Convert:
   - `RepoConfigWriter` `_readBase` / namespace / intermediate-path throws → `NOT_AN_OBJECT` (messages unchanged);
   - `RepoConfigWriter#_readLegacy` parse error → `INVALID_JSON` (message unchanged);
   - the strict-keys guard from #777 (`assertRegisteredConfigKey`, used by `ConfigChain#read` and `RepoConfig`) → `UNREGISTERED_KEY`.
   `LockTimeoutError` (`LOCK_TIMEOUT`, from #807) stays as-is. Native fs errors propagate unwrapped.
3. **`ConfigChain#readWithSource(repoPath, namespace, ...keys)`** → `{ value, tier, file, key } | undefined`; `read` becomes a thin wrapper over it (single resolution loop).
4. **`core/lib/utils/config/AgentEmail.js`** (imports only `ConfigChain`):
   - `resolve(repoPath, agent)` → `{ email, raw, tier, key } | undefined` (`email: undefined` on a resolved `""`);
   - `get(repoPath, agent, modelEmail)` → `string`, with the verbatim `() => agent` replacer for `{agent}`.
   Replace the `_agentEmailGet` copies in `AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan`, `AutoFixIssueCommitChange`. `arcanum/_lib/agent_email.sh` stays; add one shared fixture table (null, `""`, generic-beats-specific across tiers, `{agent}` substitution) exercised by both shell and native specs.
5. **`RepoPath#toplevel(repoPath)`** — `git -C <path> rev-parse --show-toplevel` via `execFile` with an argument array.
6. **JSDoc** — reword the `RepoContext` references in `ConfigChain`/`RepoConfig` to "optional, core-only".
7. **Specs** — one per `ConfigError` code, `readWithSource`, `AgentEmail` (incl. the `""` change), `RepoPath#toplevel`, updated specs for the three commit commands, and the shell/native parity fixtures.

### Dependencies

- After #777 (KeyRegistry + strict-keys guard, in progress) — this issue converts that guard to `ConfigError`.
- #807 (lock protocol) already landed.
- Before #779 (`cli/` scaffold), which adds the CLI-side lint and the build metafile check.

### Out of scope

- CLI-side guardrails and bundling (#779).
- The four `_modelCoauthorOmitted` copies (stay duplicated).
- Extracting the shared logic into its own npm package (future work).

## Benefits

- The CLI bundles exactly the same config code the skills run — same tiers, dotted paths and locking — with an enforced boundary.
- Errors carry stable `code`s for the CLI exit-code mapping, without changing dispatcher output.
- One agent-email implementation with provenance, and native/shell parity on `""`.
