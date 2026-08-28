# Migrate configChainPath in the dispatcher

Pure refactor — no behavior change. `core/lib/core/dispatcher.js` currently builds `configChainPath` with a 4-deep inline `path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'arcanum', '_lib', 'config_chain.sh')` from `core/lib/core/`.

- Import `resolveInstallPath` from `../utils/file/InstallRoot.js` (allowed: `core/` → `context`/`services` → `utils` is the sanctioned dependency direction; `dispatcher.js` already imports from `../context/` and `../utils/`).
- Replace `configChainPath` with `resolveInstallPath('arcanum', '_lib', 'config_chain.sh')`.
- Keep `const libDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')` as-is (separate concern — it is `core/lib/`, not the install root, and is used for module resolution).
- Update the comment above `configChainPath` ("Three levels up from core/lib/core, mirroring how engine_dispatch.sh…") to note the walk now lives in `InstallRoot.js`, keeping the `engine_dispatch.sh` cross-reference.
- `configChainPath` is still passed into `new InvocationLog({ configChainPath })` exactly as before — same absolute string, so `InvocationLog` and its `config_chain_read` shell-out are unaffected.

Specs:

- `core/spec/lib/core/dispatcher_spec.js` — does not assert on `configChainPath` (it injects a `fakeInvocationLog`), so it stays green. Confirm, no change expected.
- `core/spec/lib/utils/logging/InvocationLog_spec.js` — constructs its own `configChainPath`; unaffected. Confirm.
- `core/spec/bin/arcanum_spec.js` (dispatch parity/entrypoint) — run it; it exercises real dispatch but not the config-chain path value. No change expected.

## Files to Change

- `core/lib/core/dispatcher.js` — `configChainPath` → `resolveInstallPath('arcanum', '_lib', 'config_chain.sh')`; refresh the comment; leave `libDir` untouched.
