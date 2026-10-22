# Issue: Create the shared agent

## Description

Part of epic #816 (item 2): extract the shared config logic into a root `shared/` lib with its own agent. The design lives in [docs/agents/specs/shared-lib.md](docs/agents/specs/shared-lib.md) (#818), which supersedes the epic body.

This issue creates the `shared` specialist agent that owns `shared/`, and updates the agent roster and the other agents' files to match. It changes documentation and agent files only, no code.

## Problem

The config surface that the CLI bundles (`ConfigChain`, `RepoConfig`, `RepoConfigWriter`, `ConfigError`, `AgentEmail`, `KeyRegistry`, `keys.json`, `Lock`, `LockTimeoutError`, `RepoPath`) is owned by `node`, but `client` also depends on it. So every CLI change that touches it becomes a `node` + `client` change. The spec moves this surface to `shared/`, and that folder needs an owning agent before #820–#825 can be dispatched to it.

## Expected Behavior

- A `.claude/agents/shared.md` agent exists. Its scope is "code consumed by both `core/` and `cli/`": `shared/lib/`, `shared/spec/`, `shared/package.json`, `shared/yarn.lock`, `shared/eslint.config.mjs` and `shared/README.md`.
- The roster docs list `shared`. Ownership follows the folder: `shared` owns `shared/` and `node` owns `core/`, including the surface for as long as it lives there. This reaches the spec's [Ownership](docs/agents/specs/shared-lib.md#ownership) end state once #824 deletes the copy in `core/`.
- The `keys.json` exception, the drift rule and the reserved `shared` skill name are written down where the spec says they go.

## Solution

### New agent: `.claude/agents/shared.md`

- **Frontmatter:** `name: shared`, a dispatch-friendly `description` listing its paths, and `tools: Read, Edit, Write, Bash`.
- **Scope:** all of `shared/`, as listed above.
- **It does not own:**
  - `core/` (that is `node`'s) or `cli/` (that is `client`'s);
  - the `shared` compose service, the `shared-*` Makefile targets, the CircleCI `shared` jobs and the packaging specs (those are `infra`'s);
  - `AGENTS.md`, the roster and `folder-structure.md` (those are `architect`'s).
- **Stack:** Node ESM, Yarn, Jasmine, c8, ESLint with core's style rules, and zero runtime dependencies.
- **Conventions:**
  - Carried over from `node`:
    - `execFile`/`spawn` with an argument array, never `exec()` with a built-up string;
    - no real network calls in specs;
    - never print a token;
    - zero runtime dependencies.
  - The import boundary: `shared/lib/**` imports only `node:` built-ins and `shared/lib/**`, with no dynamic `import()`.
  - Everything under `shared/lib` is public.
  - Behaviour changes must keep both consumers green: core's parity tests and the CLI specs, in the same PR.
- **Coordination:** `node` and `client` request changes to `shared/` through `architect`. `shared` never edits `core/` or `cli/`, not even the copy of the surface in `core/lib/shared/`.
- **The `keys.json` exception:** `shared` owns `keys.json`, `KeyRegistry.js` and the schema. Any agent may still add, edit or remove an entry for a config key its own change introduces.
- **The drift rule:** during the copy window (#822–#824), any unavoidable change to the surface is made in both `core/lib/shared/` (by `node`) and `shared/lib/` (by `shared`). #824 removes this rule.

### Ownership is by folder

No change to the surface is planned while it moves, so ownership simply follows the folder:

- `shared` owns `shared/` (from #822 on, once the folder exists).
- `node` owns everything under `core/`, including the surface while it still lives there: in `core/lib/utils/` until #820, then in `core/lib/shared/` until #824 deletes that copy.
- Neither agent edits the other's folder.

### Other agent files

- **`node.md`:**
  - Its scope stays all of `core/`; add that `shared/` is `shared`'s, and that `node` never edits it.
  - Add the `keys.json` exception and the drift rule.
- **`client.md`:**
  - Its scope stays `cli/`.
  - Changes to the surface are requested through `architect`, who plans them for the agent owning the folder the surface lives in (`node` until #824, then `shared`).
  - Add the drift rule.
- **`scripter.md`:** add the `keys.json` exception.
- **Path references:** `node.md`, `scripter.md` and `client.md` keep naming the surface's current paths (e.g. `core/lib/utils/config/keys.json`), each with a note that the file moves to `shared/lib/` in #824. #820 and #824 update these paths as they move the files.
- **Spec fix:** update the "Implementation order" note in `docs/agents/specs/shared-lib.md`, which says agent files are repointed in #819. They are repointed in #820 and #824 instead.
- **`architect.md`:** add a `shared` row to the specialist agents table.
- **`infra.md`:** add `shared/`'s Node side to its "does not own" list.

### Roster docs

- **`AGENTS.md`:** add a `shared` row to the agents table.
- **`docs/agents/architecture/agent-roster-and-delegation.md`:**
  - add a `shared` row;
  - rewrite the "`node`/`client` shared surface" paragraph so it describes ownership by folder: `node` owns the surface while it lives in `core/`, then `shared` owns it in `shared/`.
- **`docs/agents/folder-structure.md`:** add a `shared/` row. It notes that `shared/` lands in the install's skills dir, which reserves `shared` as a skill name; Claude Code ignores the folder because it has no `SKILL.md`.

### Out of scope

- Creating `shared/` itself (#822).
- Moving any code (#820, #824).
- Rewriting the suspended `arcanum-cli` spec sections and the architecture docs (#826).

## Benefits

- The later items of #816 have a real owner to dispatch to.
- CLI-driven changes to the config surface stop going through `node`.
- The `keys.json` exception keeps adding a config key a one-agent change.
