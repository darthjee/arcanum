# Document the core/lib/ layering

Now that `core/lib/services/` exists (Step 03), document it as a peer of `commands/`/`context/`/`utils/` in `docs/agents/architecture/script-engine.md`'s "The `core/` package layout" section (right after the paragraph ending "`core/bin/arcanum` is the one executable entrypoint described above.").

Add a paragraph plus a 4-item list describing the folders and the one-way dependency direction:

```markdown
`core/lib/` is split into 4 folders, with a one-way dependency direction — `commands` → `context`/`services` → `utils` — enforced by convention (no lint rule):

- `commands/` — CLI entrypoints, one per `core/bin/arcanum` dispatch-table module. May depend on `context/`, `services/`, and `utils/`.
- `context/` — per-call-site bundles of a `repoPath` plus its resolved collaborators (e.g. `RepoContext`, built fresh per call since `repoPath` differs call to call). May depend on `services/` and `utils/`.
- `services/` — stateful or I/O-owning logic shared by multiple commands/contexts, but not itself a CLI entrypoint (e.g. `IssueStateService`). May depend on `utils/`.
- `utils/` — stateless or narrowly-scoped helpers with no knowledge of the CLI dispatch surface.

Nothing under `context/`, `services/`, or `utils/` may import from `commands/` — a command is an entrypoint, not a library other layers should reach back into.

Because `core/bin/arcanum`'s dispatcher instantiates every command with zero constructor arguments and passes `repoPath` only as a per-call method argument, a command that needs a context-bound `services/` collaborator (fixed to that call's `repoPath`) builds it fresh per call via a small private helper, rather than receiving it ready-made at construction — see `AutoFixAllGithub#_prOperations` for the reference shape.
```

Adjust wording as needed to fit the surrounding doc's voice, but keep the substance: the 4-folder split, the one-way dependency direction, the "no lint rule, convention + review only" caveat, and the per-call-builder note.

## Files to Change

- `docs/agents/architecture/script-engine.md` — add the layering documentation described above.
