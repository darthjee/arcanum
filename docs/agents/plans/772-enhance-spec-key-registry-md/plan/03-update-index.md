# Update the index

Keep `docs/agents/specs/arcanum-cli.md` consistent with the rewritten part.

- The "Future work: per-key granularity" paragraph (~line 199): keep it as future work, but link to the new `key-registry.md` future-work section anchor instead of the file only.
- The parts list entry for Key Registry (~line 230): update its one-line summary to mention the location (`core/lib/utils/config/keys.json`, owner `node`), wildcard matching and the sync/enforcement layers.
- Line ~70 ("The key registry's owner is decided in Key Registry"): optionally state the outcome (`node`) inline.
- The index keeps no consolidated open-points list (per its own `## Open points`), so nothing to update there.

## Files to Change
- `docs/agents/specs/arcanum-cli.md` — future-work link, parts-list summary, owner sentence.
