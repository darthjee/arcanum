# Copy the lib

Copy the 10 surface files byte-for-byte:

- `core/lib/shared/config/{AgentEmail,ConfigChain,ConfigError,KeyRegistry,RepoConfig,RepoConfigWriter}.js` and `keys.json` → `shared/lib/config/`;
- `core/lib/shared/file/{Lock,LockTimeoutError,RepoPath}.js` → `shared/lib/file/`.

Do not edit them — not import paths (all already relative inside the folder), not comments, not message strings. In particular `KeyRegistry.js` keeps `is not in core/lib/shared/config/keys.json`; #824 rewrites it. Verify with `diff -r core/lib/shared shared/lib` (empty output).

## Files to Change

- `shared/lib/config/*` — new, copied.
- `shared/lib/file/*` — new, copied.
