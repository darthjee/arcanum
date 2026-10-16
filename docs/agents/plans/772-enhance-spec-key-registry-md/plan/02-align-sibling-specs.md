# Align sibling spec parts

Bring the other parts of the arcanum CLI spec in line with the new registry decisions.

- `shared-config-logic.md`:
  - "Source stays in `core/`" / "Declared shared surface": add `core/lib/utils/config/keys.json` and `core/lib/utils/config/KeyRegistry.js` to the shared-surface list; note the static JSON import that lets esbuild inline the registry.
  - Mention that `ConfigChain#read` and `RepoConfig`'s read gain the test-only strict-keys guard (`ARCANUM_STRICT_CONFIG_KEYS=1`), linking to [Key Registry](key-registry.md).
- `shortcuts-and-setup.md`:
  - Open points at lines ~376–377 (whether `<skill>` must exist; final `setup`/`instances` shape) are now resolved by the registry spec — remove them, or replace with a pointer to the relevant `key-registry.md` sections.
  - Check the `git merge-body` / `git safe-branch` text and JSON examples against the final seed list (default `empty`; `git.safe_branch` local-only — the shortcut's default tier is already `local`, so a `--repo`/`--global` override is now exit `3`). Adjust any example that contradicts it.
- `command-surface.md`:
  - Value parsing: note that `null` on a **known** key is a type mismatch (exit `3`, `hint: use 'config unset' to remove it`); storing `null` remains possible only for unknown keys with `--force`.
  - Error messages table: optionally add the regex example (`... ignored_check_patterns[2] is not a valid regex: ...`) and the `null` example.

## Files to Change
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` — shared-surface list + strict-keys guard mention.
- `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` — resolve registry-owned open points; check merge-body/safe-branch consistency.
- `docs/agents/specs/arcanum-cli/command-surface.md` — `null` on known keys; optional error-message rows.
