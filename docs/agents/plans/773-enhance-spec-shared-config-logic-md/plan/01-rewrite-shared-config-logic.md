# Rewrite shared-config-logic.md

Rewrite `docs/agents/specs/arcanum-cli/shared-config-logic.md` from the issue's `## Solution` section, keeping its current shape (`Purpose` / `Decisions` / `Alternatives considered` / `Open points`).

Under `## Decisions`:

- **Source stays in `core/`** — replace the file list with the final surface (see plan Notes), and state that the explicit `files` list in `core/eslint.config.mjs`'s shared-surface block is the authoritative declaration. Drop `BooleanKeyConfig` and explain why (the `config.sh` dispatch layer; keeps `DispatchFailure`; the CLI writes every key through `RepoConfigWriter`). Keep the strict-keys guard paragraph, noting it throws `ConfigError('UNREGISTERED_KEY')`. Mention the "optional, core-only" JSDoc `RepoContext` references and why they pull nothing in.
- **`ConfigError`** (new subsection, replaces the "Decouple `DispatchFailure`" guardrail) — class shape, the code table, errno pass-through, "dispatcher: no mapping, byte-identical", the CLI mapping, and the non-object-intermediate edge case (→ `7`).
- **Lock** (new subsection, replaces the "Bounded lock for the CLI" guardrail and the lock open point) — the protocol flaw, the #807 design summary, #807 as a hard blocker for `set`/`unset` and writing shortcuts (reads unblocked), #807 standalone outside the epic, timeout semantics (nothing written, nothing to clean up), mixed-version safety.
- **Repo-root normalizing helper** (new subsection) — `RepoPath.js` on the surface with `toplevel(repoPath)` (see plan Notes).
- **Shared agent-email helper** (new subsection) — `ConfigChain#readWithSource`, `AgentEmail.js` (`resolve`, `get`), the `""` alignment (deliberate native fix, release-notes call-out), shell side unchanged with shared parity fixtures, non-string values documented as unsupported, `_modelCoauthorOmitted` out of scope.
- **Bundle at build time with `esbuild`** — expand with entry/output, unbundled `cli/bin/arcanum`, the options table, the metafile surface check reading the list from core's ESLint block, `package.json` wiring, source vs. smoke specs, and the Node 22.13 JSON-module verification with the `keys.js` fallback.
- **Guardrails** — rewrite as the two-sided lint rule (include the core-side snippet and the CLI-side rule) and the **CI coupling** decision (always-on `cli` job, no path filters, rationale, shape, shared build script, revisit condition; mention it complements the index's Node 22.13 floor job). Keep "Malformed files stay the CLI's concern" unchanged.
- **Future work** — keep the npm-package extraction paragraph (anchor `#future-work` must survive).

Under `## Alternatives considered`, add: path-filtered CI; a CLI-only stricter lock; keeping `BooleanKeyConfig` on the surface; a path-resolving lint via `eslint-plugin-import`. Keep the existing four.

Add a short `## Backward compatibility, testing and security` section (mirroring the index's shape) from the issue's "Remaining concerns".

Replace `## Open points` with a single line stating there are none left (future work is above) — keep the heading so `#open-points` links still resolve until step 05 retargets them.

## Files to Change
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` — full rewrite as above.
