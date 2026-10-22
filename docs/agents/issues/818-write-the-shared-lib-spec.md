# Issue: Write the shared lib spec

## Description

Part of epic #816 (extract the shared config logic into a `shared/` lib with its own agent). See the epic for the full design decisions: Scope, Edge Cases, Testing Strategy, Performance and Security, Backward Compatibility.

Write the design spec for the `shared/` lib at `docs/agents/specs/shared-lib.md`, turning the decisions in #816 into the contract the implementation items follow.

### Scope

- What `shared/` is for: code shared by `core/` and `cli/`, with the config surface as its first content. Its layout: `shared/lib/{config,file}/`, `shared/spec/`, and its own `package.json`, `yarn.lock`, ESLint config and README.
- The surface being moved: the 9 files plus `keys.json`. What stays in core: `BooleanKeyConfig` and `DispatchFailure`.
- **Spec inventory:** every affected spec file, classified as *moved*, *stays in core* or *duplicated* (see #816 → Edge Cases).
- The two-way import boundary and the lint rules. Relative imports, and why a mount or copy at a core path was rejected.
- The steps: consolidate inside core → copy → switch, including the drift rule and item 7's diff check.
- `keys.json` ownership, the strict-keys guard, the testing strategy, security, and backward compatibility, all as decided in #816.

## Expected Behavior

- `docs/agents/specs/shared-lib.md` exists. It follows the outline in [Spec Shape](#spec-shape) and holds every decision from #816, including the full spec-file inventory.
- The new spec has an entry in the specs index `docs/agents/specs.md` (link, one-line summary, status "Proposed"), as `AGENTS.md` requires for every new spec.
- The 8 sections of the `arcanum-cli` specs listed below carry a "Suspended" banner pointing at `shared-lib.md`. Nothing else in those specs changes.
- No code changes.

## Solution

### Existing CLI Specs: Mark as Suspended

The `arcanum-cli` specs (epic #767) contain decisions that #816 reverses. #818 does **not** rewrite them; that is #826's job. Instead, #818 adds a short banner at the top of each affected section:

> **Suspended:** under revision by epic #816; see [Shared Lib](../shared-lib.md) (adjust the relative path per file). Until #826 rewrites it, `shared-lib.md` wins where the two disagree.

Sections to mark:

| File | Section |
| --- | --- |
| `docs/agents/specs/arcanum-cli/shared-config-logic.md` | "Source stays in `core/`" |
| same | "Bundle at build time with `esbuild`": only the build-time surface check, which reads the list from core's ESLint block |
| same | "Guardrails → Shared-surface lint rule" |
| same | "Future work" |
| same | "Alternatives considered": the "Extracting a shared workspace package now" bullet |
| `docs/agents/specs/arcanum-cli.md` | "Ownership": the `node` row ("`core/lib` source, including the shared config services the CLI bundles") |
| `docs/agents/specs/arcanum-cli/key-registry.md` | "Location" (`core/lib/utils/config/keys.json`, owned by `node`) |
| `docs/agents/specs/arcanum-cli/packaging-and-release.md` | "Build output": the "shared config surface from `core/lib`" bullet |

Plain `core/lib/...` path mentions elsewhere (e.g. `RepoPath.js`, `Lock.js` in `command-surface.md`) get no banner. They are repointed in #826.

### Spec Shape

**One file:** `docs/agents/specs/shared-lib.md`. The design is mostly settled in #816; it is a restructuring, not a new product, so the spec should come to roughly 300–400 lines. One file also means one review, and #819–#827 each read most of it anyway.

**Outline.** The spec uses these sections, in this order:

| # | Section | Content |
| --- | --- | --- |
| 1 | Status | "Proposed", the origin (#816), and the source-of-truth rule |
| 2 | Goal and Non-goals | what `shared/` is for: code shared by core and cli. Non-goals: npm publishing, the `ClaudeContext` config-dir consolidation, the shell config helpers, #817 |
| 3 | Layout | the `shared/` tree; what moves; what stays in core (`BooleanKeyConfig`, `DispatchFailure`) |
| 4 | Ownership | the `shared` agent; the narrowed `node` and `client` scopes; the `keys.json` exception; the reserved skills-dir name |
| 5 | Import boundary | relative imports, and why a mount, copy or symlink at a core path was rejected; the two-way lint rules; everything under `shared/lib` is public |
| 6 | Migration steps | consolidate → copy → switch; the drift rule and the diff check; the spec-file inventory |
| 7 | Packaging and runtime | the dev bind mount; the zip and the runtime image; not shipping specs; the updater's `MANIFEST` diff |
| 8 | Tooling and CI | the package; the compose service; Makefile targets; CircleCI jobs; the Node floor; Codacy partial uploads |
| 9 | Writer additions | `unset`, `timeoutMs`, top-level writes |
| 10 | Backward compatibility | the compatibility table, plus the packaging and runtime-smoke guards |
| 11 | Testing | enforced coverage; the strict-keys guard; interop specs staying in core; testing during the copy window |
| 12 | Performance and security | the zero-dependency spec; the boundary; the safety conventions; `yarn audit`; the read-only image |
| 13 | Alternatives considered | a published or workspace package; a mount, copy or symlink at a core path; one big move instead of steps; keeping the surface in core (the previous decision) |
| 14 | Implementation order | the item → issue map (#818–#827), with owners and dependencies |
| 15 | Open points and See also | anything left open; links to the `arcanum-cli/*` specs and the architecture docs |

Testing, Backward compatibility, and Performance and security are separate sections, because each has real content. There is no Parts section unless the split rule triggers.

**Split rule.** Split only if the file exceeds about **500 lines**. Then turn it into an index plus parts under `docs/agents/specs/shared-lib/`, along these seams, and create one "Enhance spec: …" sub-issue of #816 per part at that point:

| Candidate part | Holds |
| --- | --- |
| `shared-lib/migration-steps.md` | consolidate → copy → switch, the spec-file inventory, the drift rule and the diff check |
| `shared-lib/writer-api.md` | the `unset`, `timeoutMs` and top-level-write additions |
| `shared-lib/tooling-and-ci.md` | package, lint boundary, compose, Makefile, CircleCI, Codacy, Node floor, packaging specs |

### Further Decisions

- **Source of truth.** From its merge on, `shared-lib.md` supersedes #816's body, as `arcanum-cli.md` did for #767. Later changes are made in the spec and not back-ported; only #816's split list may still change.
- **Spec-file inventory.** The spec contains the **full** list, as #816 decided: every affected file under `core/spec` and `cli/spec`, classified as *moved*, *stays in core* or *duplicated*. #820 and #822 follow the list; they don't re-derive it.
- **Writer additions.** The spec fixes the **behaviour contract** for #825:
  - `unset` of a missing key is a no-op, and empty parents are not pruned;
  - `timeoutMs` is optional, and omitting it waits forever, as today;
  - top-level writes keep siblings.

  Exact method names and signatures are left to #825.
- **Out of scope for #818:** writing any code, rewriting the `arcanum-cli` specs (#826), the `ClaudeContext` config-dir consolidation, and #817.

### Owner

`architect`.

### Dependencies

None. This is the first item of #816.

## Benefits

- Every implementation item (#819–#827) builds on one reviewed contract, not on an epic body spread across a long discussion.
- Readers of the `arcanum-cli` specs see straight away which of their decisions are under revision.
