# Rewrite the arcanum-cli specs

These are still specs (the CLI spec is promoted by #785). Rewrite every section that carries a "**Suspended:** … Until #826 rewrites it" banner so that it matches `shared/` as built, and delete the banner. Repoint the plain path mentions. Link to `../../architecture/shared-lib.md` (or `../architecture/shared-lib.md` from `arcanum-cli.md`) instead of `shared-lib.md` the spec.

- **`docs/agents/specs/arcanum-cli/shared-config-logic.md`:**
  - "Source stays in `core/`" (banner at line 13): the surface now lives in `shared/lib/`, owned by `shared`. Retitle the section (e.g. "Source lives in `shared/`"). Rewrite the file table with `shared/lib/...` paths. Keep the note on what stays in core. Update every in-repo anchor link to `#source-stays-in-core`; `grep -rn "source-stays-in-core" docs .claude` finds them all.
  - "Bundle at build time with `esbuild`" (banner at line 130): the metafile check allows `cli/lib/**` and `shared/lib/**`.
  - "Shared-surface lint rule" (banner at line 144): core's 9-file allowlist became the folder rule in `shared/eslint.config.mjs`, plus the consumer restrictions in `core/` and `cli/`.
  - "Future work" (banner at line 210) and the "Extracting a shared workspace package now. Rejected …" alternative (banner at line 218): record that #816 extracted the surface into `shared/`, a plain folder and not an npm/workspace package. Remove the entry from Future work, and drop the section if it ends up empty. Update the "Open points" line that points at Future work.
  - Repoint the remaining `core/lib/utils/...` paths (lines 36, 62, 80, 95).
- **`docs/agents/specs/arcanum-cli/key-registry.md`:** Location (banner at line 76; line 78): `shared/lib/config/keys.json` and `KeyRegistry.js`, owned by `shared`, with the `keys.json` exception; specs under `shared/spec/`.
- **`docs/agents/specs/arcanum-cli/packaging-and-release.md`:** the bullet at line 56 and its banner at line 58: the CLI bundles the surface from `shared/lib`. Check lines 64, 115, 173, 208 and 233 still read correctly, since "shared surface" is fine as a term.
- **`docs/agents/specs/arcanum-cli.md`:** the `node` row (banner at line 57): the surface is `shared`'s, so add or adjust the ownership row. Repoint the paths at lines 72–81, 108, 123 and 234, where line 234 says `keys.json` is "owned by `node`" and should say `shared`.
- **`docs/agents/specs/arcanum-cli/command-surface.md`:** lines 108, 144 and 153 (`RepoPath`, `RepoConfigWriter`, `Lock`).
- **`docs/agents/specs/arcanum-cli/shortcuts-and-setup.md`:** line 199 (`RepoConfig`).

Line numbers are from `main` at the time of planning; find the text by grepping if they have shifted.

## Files to Change

- `docs/agents/specs/arcanum-cli/shared-config-logic.md`
- `docs/agents/specs/arcanum-cli/key-registry.md`
- `docs/agents/specs/arcanum-cli/packaging-and-release.md`
- `docs/agents/specs/arcanum-cli.md`
- `docs/agents/specs/arcanum-cli/command-surface.md`
- `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md`
