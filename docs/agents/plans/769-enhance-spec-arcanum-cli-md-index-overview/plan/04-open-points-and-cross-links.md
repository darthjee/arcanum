# Open points, cross-cutting concerns and cross-links

Close out the index.

- **"Open points" section:** remove the four resolved points; replace with a short note that the index has no open points of its own and each part keeps its own list (no consolidated copy).
- **New "Backward compatibility, testing and security" section** (concise, consistent with the decisions above):
  - Backward compatibility: the CLI never changes config shapes; it reads/writes the existing tier files through the shared logic; version-skew handling protects older/newer repos; `core/bin/arcanum` untouched; no per-repo migration.
  - Testing: `cli/` specs use temp dirs as fake `CLAUDE_CONFIG_DIR`s and repos (never the real `~/.claude`); cover each skew case, each repo state, each account edge case, `info` JSON shape; Node 22.13 CI job; CLI specs also run on shared-surface changes (detailed in Shared Config Logic).
  - Security: zero runtime dependencies; no directory creation for unknown accounts; no writes into unconfigured repos; no `~` expansion of the env var (no divergence from skills); `child_process` only via `execFile`/`spawn` with argument arrays; writes only through the shared locking logic.
  - Performance: note only — single-file bundle, one `git rev-parse` per invocation; nothing load-sensitive.
- **Cross-links:** every new section links to the part that holds the details (Command Surface for exit codes/`info` JSON/`--repo` rule; Key Registry for `--force` and `migrations.version` in the global tier; Shared Config Logic for the root helper and CI coupling; Packaging and Release for `engines.node`, esbuild target, CI job, migration-list embedding). Update the "Parts" bullets if a part's summary now mentions something decided in the index.
- Check every relative link in the file resolves (`../architecture/...`, `../../guides/...`, `arcanum-cli/...`).
- Leave `docs/agents/specs.md`'s entry unchanged (status stays "Proposed").

## Files to Change

- `docs/agents/specs/arcanum-cli.md` — "Open points" replaced; new "Backward compatibility, testing and security" section; cross-links in new sections and "Parts".
