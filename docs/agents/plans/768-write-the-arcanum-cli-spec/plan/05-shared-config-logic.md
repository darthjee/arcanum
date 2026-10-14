# Write shared-config-logic.md

Create `docs/agents/specs/arcanum-cli/shared-config-logic.md`, restating #767's "Shared config logic" decisions.

Decisions to capture:

- The CLI reads/writes config exactly like the skills (same tier files, dotted-path semantics, locking).
- Source stays in `core/`, owned by `node`: `core/lib/utils/config/` (`ConfigChain`, `RepoConfig`, `RepoConfigWriter`, `BooleanKeyConfig`) and `core/lib/utils/file/Lock.js` (~900 lines, shell-lock compatible).
- The CLI build bundles the CLI, this shared surface and the key registry into a single self-contained file with **`esbuild`** (devDependency; runtime stays zero-dependency).
- Guardrails: a declared shared surface (exact file list) importing only node built-ins and each other, enforced by an ESLint `no-restricted-imports` rule; `DispatchFailure` replaced in the shared surface by a neutral error (e.g. `ConfigError`), mapped by the dispatcher (preserving today's stdout/exit codes) and by the CLI; CLI specs and the bundle build also run when a shared-surface file or the registry changes.
- Future work (separate follow-up, outside epic #767): extract the shared config logic into its own npm package — must respect that `core` ships with zero runtime npm deps inside the release zip / Docker image (likely an in-repo workspace package imported locally by `core`, published for the CLI).

Alternatives considered: extracting a shared workspace package now (new root folder, import churn, Docker/Makefile changes — too much for ~900 lines); a plain copy script instead of `esbuild`; reimplementing the logic in the CLI (drift, especially locking); importing `core/lib` at runtime (impossible — `core/` is not in the npm package).

Open points: exact shared-surface file list; `ConfigError` shape and mapping; how CI detects shared-surface changes; lock interoperability details with the shell `lock.sh`.

## Files to Change
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` — new part.
