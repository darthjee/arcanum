# Shortcut dispatch and single-value shortcuts
Route the shortcut namespaces (`engine`, `git`, `auto-fix-all`, `monitor-issues`, `next-step`, `agents`) under `arcanum config`, alongside the generic subcommands, and implement the single-value shortcuts (spec "Shortcut set", "Design rules", "Output").

- A small table maps each single-value shortcut to its key, its default write tier and its value kind (enum, ref string or boolean): `engine` → `engine.mode` (local), `git safe-branch` → `git.safe_branch` (local), `git merge-body` → `git.merge_body_mode` (local), `auto-fix-all clear-context`/`finish-on-empty-queue`, `monitor-issues clear-context` (local).
- No value means the generic `get` path (resolved, or a single tier with a tier flag, plus `--all-tiers`). The unset read exits `1`, and the registry `default` appears in the human line and the JSON. A value means the generic `set` path at the default tier unless a tier flag overrides it. `--unset` means the generic `unset` path. `--unset` together with a value is exit `2`. Tier restrictions come from the registry (e.g. `git safe-branch --repo` is exit `3`).
- Boolean tokens: `on`/`true` become `true`, and `off`/`false` become `false`, lowercase only, stored as JSON booleans. Anything else is exit `3` with a hint listing the accepted tokens.
- Writing to a tier shadowed by a higher-precedence tier adds a stderr note naming the overriding tier.

## Files to Change
- `cli/lib/commands/config.js` — dispatch the shortcut namespaces.
- `cli/lib/commands/config/shortcuts/` (new) — the shortcut table and the single-value runner that delegates to the generic get/set/unset.
- `cli/lib/booleanToken.js` (new) — token parsing with the exit-`3` hint.
- `cli/spec/lib/commands/config/shortcuts/singleValue_spec.js`, `cli/spec/lib/booleanToken_spec.js` (new) — per shortcut: read, set, `--unset`, and tier override, each byte-identical to the generic command. Also: the unset read with and without a registry default, boolean tokens (each accepted token, an uppercase one, a non-boolean one), `--unset` together with a value, `--force`/`--string` refused, and the shadowing note.
