# Registry file and KeyRegistry loader/matcher/validator

Create the registry and its accessor, following [Entry shape](../../../specs/arcanum-cli/key-registry.md#entry-shape), [Wildcard matching](../../../specs/arcanum-cli/key-registry.md#wildcard-matching) and [Validation](../../../specs/arcanum-cli/key-registry.md#validation).

**`keys.json`**

- Shape: `{"format_version": 1, "keys": [...]}`.
- Contents: one entry per key in plan.md's shared-contracts table, each with `type` (plus `values` / `items` / `format` / `integer` / `min` / `max` as listed), `tiers`, `read_only` where true, `default` where listed, and a short `description`.
- `setup` entries, exactly:
  - `identity`: `git.email` (order 1), then `git.agents.<agent>` (order 2, no `instances`);
  - `engine`: `engine.mode`;
  - `git`: `git.safe_branch` (1), then `git.merge_body_mode` (2);
  - `flow`: `next_step.auto.<skill>`, with `instances: ["enhance-issue", "discuss-issue", "auto-plan-issue"]`;
  - `ci`: `auto-fix-all.ignored_check_patterns`.
- No other entry carries `setup`.

**`KeyRegistry.js`**

- Import with `import keys from './keys.json' with { type: 'json' }`, never `fs`.
- Refuse a `format_version` higher than 1.
- Expose:
  - `lookup(key)`: the matching entry or `null`. An exact entry beats a wildcard; a `<name>` segment matches exactly one concrete segment `[A-Za-z0-9_-]+`; the segment count must match.
  - `check(op, key, tier, value)`, with `op` one of `set` / `unset`. It returns `{ok: true}` or `{ok: false, reason, ...details}`. Checks run in this order, and the first failure wins:
    1. `unknown`
    2. `read_only`
    3. `tier`. `unset` stops here.
    4. value checks: `null` (with the `use 'config unset'` hint data), `type` (`expected` / `got`), `enum`, `empty` (non-empty string/enum unless `allow_empty`), `integer` / `min` / `max`, `format` (regex compiled with `new RegExp(p, 'i')`, failure carrying the element index and the compile error message).
  - A validation helper used by the validator spec, e.g. `validateRegistry(data)` returning a list of problems. It is exported so the spec and a future CLI build step share it.
- Keep it on the shared surface's import rules: only `node:` built-ins and other surface files. No `DispatchFailure`; return results, never throw for validation failures.
- JSDoc on public methods, matching the style of `ConfigChain.js`.

## Files to Change
- `core/lib/utils/config/keys.json` — new registry data.
- `core/lib/utils/config/KeyRegistry.js` — new loader, matcher, `check` and registry validator.
