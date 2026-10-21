# Add ConfigChain#readWithSource

Add `readWithSource(repoPath, namespace, ...keys)` returning `{ value, tier, file, key } | undefined`, where `tier` is `local`/`repo`/`global`, `file` the tier's absolute path (resolve like `readTiers`), and `key` the winning key as passed (e.g. `agents.node` or `email`). Move the resolution loop from `read` into it; `read` becomes `(await this.readWithSource(...))?.value`. Keep the strict-keys guard on the read path so both entry points are covered, and keep the `repoContext` fallback.

Same semantics as today: `null` falls through, `""` stops the chain, fail-open on missing/malformed files, per-tier key order.

## Files to Change
- `core/lib/utils/config/ConfigChain.js` — add `readWithSource`; `read` wraps it.
- `core/spec/lib/utils/config/ConfigChain_spec.js` — specs for tier/file/key provenance, generic-beats-specific across tiers, `""` reported, `undefined` when nothing resolves; existing `read` specs unchanged.
