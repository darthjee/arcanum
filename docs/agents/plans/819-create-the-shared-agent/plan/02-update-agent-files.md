# Update the other agent files

Bring the existing agent files in line with ownership by folder. Paths that name the surface keep their current value (e.g. `core/lib/utils/config/keys.json`) and gain a note that the file moves to `shared/lib/` in #824.

- **`.claude/agents/node.md`:**
  - In "Your scope", state that `node` owns all of `core/`, including the shared config surface while it lives there (`core/lib/utils/`, then `core/lib/shared/` from #820 until #824 deletes that copy). `shared/` is `shared`'s, and `node` never edits it.
  - Next to the "Adding a config key…" convention, add the `keys.json` exception: `shared` owns `keys.json`, `KeyRegistry.js` and the schema, but any agent may add, edit or remove an entry for a key its own change introduces. Keep the path, with the #824 note.
  - Add the drift rule: during #822–#824, an unavoidable surface change is made in both `core/lib/shared/` (by `node`) and `shared/lib/` (by `shared`); #824 removes this rule.
  - Keep the existing "never edit `cli/`" bullet, and add "never edit `shared/`".
- **`.claude/agents/client.md`:**
  - The scope stays `cli/`. In "You do not own", add `shared/` (that is `shared`'s), and add the #824 note to the `core/lib/utils/config/keys.json` mention.
  - In "How to coordinate", surface changes are requested through `architect`, who plans them for the agent owning the folder the surface lives in: `node` until #824, then `shared`.
  - Add the drift rule.
  - Add the #824 note to the `core/lib` surface mentions (the build metafile check and the lint rule).
- **`.claude/agents/scripter.md`:** next to the "Adding a config key…" bullet, add the `keys.json` exception and the #824 note on the path.
- **`.claude/agents/architect.md`:** add a `shared` row to the "Specialist agents" table, with scope "all of `shared/` (`shared/lib/`, `shared/spec/`, `shared/package.json`, `shared/yarn.lock`, `shared/eslint.config.mjs`, `shared/README.md`): code consumed by both `core/` and `cli/`".
- **`.claude/agents/infra.md`:** in the "does not own" sentence, add that `shared/`'s Node side (source, specs, `package.json`, lint config) is `shared`'s.

## Files to Change

- `.claude/agents/node.md`: scope, the `keys.json` exception, the drift rule, the #824 path note.
- `.claude/agents/client.md`: does-not-own, coordination routing, the drift rule, the #824 path notes.
- `.claude/agents/scripter.md`: the `keys.json` exception, the #824 path note.
- `.claude/agents/architect.md`: a `shared` row.
- `.claude/agents/infra.md`: the does-not-own list.
