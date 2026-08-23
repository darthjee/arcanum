# ConfigChain.js (3-tier config reader)

Create the reusable native equivalent of `arcanum/_lib/config_chain.sh`'s `config_chain_read`, since `pr-merge`'s body-mode logic (Step 3) is the first native entrypoint that needs 3-tier config resolution and no such reader exists yet in `core/lib/` — `RepoConfig.js` only does single-tier reads, `AutoFixAllConfig.js` re-derives its own narrower new/legacy-file split.

Extract this as a standalone module, following the same precedent as `Tags.js` and `GithubToken.js` (both built for one entrypoint's need, then exported for reuse — `Tags.js`'s `LABEL_TO_TAG` is already reused by `AutoFixAllQueue.js`). A future entrypoint needing 3-tier config resolution (e.g. `engine.mode` itself) should reuse `ConfigChain.js` rather than re-deriving the chain again.

Read `arcanum/_lib/config_chain.sh`, `arcanum/_lib/repo_config.sh`, and `arcanum/_lib/global_config.sh` for the exact resolution order and semantics:

1. Three tiers, in order: local state (`.claude/state/arcanum-config.json`), repo config (`.claude/configuration/arcanum-repo-config.json`), global config (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`).
2. `read(repoPath, namespace, ...keys)` accepts one or more keys (each possibly a dot-separated nested path); within a tier, keys are tried in order and the first one that resolves there wins — a tier is always fully resolved (every key tried) before the chain advances to the next tier.
3. A JSON `null` value at any tier/key is treated the same as absent and falls through. An explicit empty string (`""`) is a real value and stops the chain there.
4. Returns the raw resolved value (or `undefined`/equivalent "nothing found" sentinel when all tiers/keys are exhausted) — callers apply their own hardcoded default on top, same convention as the shell version.
5. Missing file / unreadable / malformed JSON at any tier must not throw — treat as "no value at this tier" and continue to the next tier, matching every other native config reader's fail-open convention (`RepoConfig.js`, `AutoFixAllConfig.js`).

## Files to Change

- `core/lib/ConfigChain.js` — new module, `read(repoPath, namespace, ...keys)` (async), zero runtime deps, built-in `node:fs/promises` + `node:path` only.
