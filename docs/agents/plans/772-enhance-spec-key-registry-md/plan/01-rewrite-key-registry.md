# Rewrite key-registry.md

Rewrite `docs/agents/specs/arcanum-cli/key-registry.md` from the issue's `## Solution`, keeping `## Purpose`, the `### Entry shape` heading (its anchor is linked from `shortcuts-and-setup.md`) and `## Alternatives considered`.

Under `## Decisions`:

- **Entry shape / file format**: plain JSON table, `{"format_version": 1, "keys": [...]}`; entries are an array (duplicates rejected by spec); closed type vocabulary `string`/`boolean`/`number`/`enum`(+`values`)/`array`(+`items`); optional `format` (closed vocabulary, only `regex`), `read_only`, `default` (absent → `null` in `config get`; must match type), `integer`/`min`/`max` (number only), `allow_empty` (string/enum only), `setup`; unknown fields rejected. Include the JSON example.
- **Location**: replace the current section with `core/lib/utils/config/keys.json` + `KeyRegistry.js`, owner `node`, on the declared shared surface; static JSON import (`with { type: 'json' }`), never `readFileSync`; ships with `core/` (jq-readable); no new root folder. Keep the "packed into `arcanum-cli` at build time" bullet.
- **Wildcard matching**: new subsection with the six rules (one-segment `<name>`, charset `[A-Za-z0-9_-]+`, exact beats wildcard + overlapping wildcards rejected, leaf integrity, no existence check with stderr warning for missing `.claude/agents/<agent>.md`, `setup.instances` wizard-only).
- **Validation**: expand with the fixed check order, `check()` returning a structured result, number constraints, non-empty strings, `null` on known key → exit `3` with the `config unset` hint, regex element-index error message, `--force` semantics, reads never validate. Link to [Command Surface](command-surface.md) for the generic contract instead of restating it.
- **Rule / Keeping it in sync**: replace `### Rule` with the "no runtime consumption in this epic" decision + defaults drift spec, and the three enforcement layers (strict-keys guard in `ConfigChain#read` and `RepoConfig`'s read under `ARCANUM_STRICT_CONFIG_KEYS=1`; shell static scan with `# config-key:` annotation; docs checklist in `shared-state-and-configuration.md` and the `node`/`scripter` agent docs). Note: no reverse check.
- **Seed keys**: replace the indicative table with the final 17-row table (types, tiers, defaults, notes), drop "This table is indicative", state that #777 transcribes it, and state the `setup` assignments mirroring the wizard table. Mark `monitor-issues.clear_context` as added with #776.

Add sections `## Edge cases`, `## Backward compatibility`, `## Testing`, `## Performance and security` (including the pre-existing ReDoS note), and `## Future work` with the per-key skew design (`since`, `moved_in`, `removed_in`; refusal with exit `5`; no `format_version` bump needed while bundled). Add alternatives rejected in the dialogue (JSON Schema, JS module; `core/registry/`, `arcanum/_lib/`, new root folder).

Replace `## Open points` with only what remains genuinely open (expected: none — write "None." if so, keeping the heading so existing `#open-points` links still resolve).

## Files to Change
- `docs/agents/specs/arcanum-cli/key-registry.md` — full rewrite per above.
