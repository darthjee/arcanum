# Write the shared agent file

Create `.claude/agents/shared.md`, modelled on `.claude/agents/node.md` and `.claude/agents/client.md`.

- **Frontmatter:**
  - `name: shared`;
  - `description:` "Arcanum shared-lib specialist. Use for any task involving shared/ — code consumed by both core/ and cli/: shared/lib/, shared/spec/, shared/package.json, shared/yarn.lock, shared/eslint.config.mjs, shared/README.md."
  - `tools: Read, Edit, Write, Bash`.
- **Your scope:**
  - all of `shared/`, with the paths above;
  - its scope rule is "code consumed by both `core/` and `cli/`", and new code that both consumers need goes into `shared/`, not into `core/lib`;
  - note that `shared/` is created by #822, and until #824 the surface also exists in `core/`, which is `node`'s.
- **It does not own:**
  - `core/`, including the copy of the surface in `core/lib/shared/` (that is `node`'s);
  - `cli/` (that is `client`'s);
  - the `shared` compose service, the `shared-*` Makefile targets, the CircleCI `shared` jobs and the packaging specs (those are `infra`'s);
  - `AGENTS.md`, the agent roster and `docs/agents/folder-structure.md` (those are `architect`'s).
- **Stack:** Node.js ESM, Yarn, Jasmine, c8, ESLint with core's style rules (2-space indent, single quotes, semicolons, `const`/`let`, strict `===`, no `console.log`, JSDoc on public functions), and zero runtime npm dependencies.
- **Conventions:**
  - `shared/spec/` mirrors `shared/lib/` 1:1, with `<Name>_spec.js` files.
  - The import boundary: `shared/lib/**` imports only `node:` built-ins (never a bare `'fs'`) and files under `shared/lib/`, with no dynamic `import()`. Everything under `shared/lib` is public; there is no allowlist.
  - Behaviour stays compatible for both consumers. A change keeps core's parity tests and the CLI specs green in the same PR, with the `core/` and `cli/` sides planned for `node` and `client`.
  - Safety conventions carried over from `node`:
    - `child_process` only through `execFile`/`spawn` with an argument array, never `exec()` with a built-up string;
    - no real network calls in specs;
    - never print a GitHub token;
    - zero runtime dependencies.
  - **The `keys.json` exception:** `shared` owns `keys.json`, its loader `KeyRegistry.js` and its schema, but any agent may add, edit or remove an entry for a config key its own change introduces.
  - **The drift rule** (copy window, #822–#824): no surface change is planned, but an unavoidable one is made in both copies, `core/lib/shared/` by `node` and `shared/lib/` by `shared`. Mark it as removed by #824.
- **How to coordinate with the architect:**
  - `node` and `client` request changes to `shared/` through `architect`;
  - `shared` never edits `core/` or `cli/`;
  - CI, Docker, compose and Makefile needs go to `infra` through `architect`;
  - until #826 promotes it, the design lives in the [Shared Lib spec](../../docs/agents/specs/shared-lib.md).

## Files to Change

- `.claude/agents/shared.md`: new.
