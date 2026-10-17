# Issue: Create the mod agent

## Description

Part of epic #790, needed by #797 (ship the `arcanum-next-step` mod). See #797's
"Folder ownership" section for the decision.

Create the `mod` specialist agent owning top-level Claude Code mod folders (starting
with `arcanum-next-step/`), before any mod code is written. The name is `mod` (the
`plugin-authoring` skill's term) rather than `plugin`, which is ambiguous with Claude
Code marketplace plugins.

## Problem

#797 introduces `arcanum-next-step/`, a new root-level folder holding a TypeScript
Claude Code mod. No existing agent fits it: `node`'s conventions (Jasmine, c8, ESLint
flat config, shell/native byte parity, `core/bin/arcanum` routing) do not apply to a
mod, which runs in Claude Code's own environment (no Node, no DOM, everything through
`# Issue: Create the mod agent

## Description

Part of epic #790, needed by #797 (ship the `arcanum-next-step` mod). See #797's
"Folder ownership" section for the decision.

Create the `mod` specialist agent owning top-level Claude Code mod folders (starting
with `arcanum-next-step/`), before any mod code is written. The name is `mod` (the
`plugin-authoring` skill's term) rather than `plugin`, which is ambiguous with Claude
Code marketplace plugins.

) and is checked with `claude plugin validate` / `claude plugin test` / `tsc`.
Without an owner, the mod code in #797 has nowhere to be dispatched.

## Expected Behavior

- A `mod` agent exists in `.claude/agents/` and is listed everywhere the agent
  roster is documented, so planners and dispatchers route mod work to it.
- `arcanum-next-step/` appears in the folder structure doc with owner `mod`.

## Solution

### `.claude/agents/mod.md` (new)

Frontmatter: `name: mod`, a description naming top-level mod folders
(`arcanum-next-step/`), `tools: Read, Edit, Write, Bash`. Body follows the shape of
`.claude/agents/node.md` (Your scope / Stack / Conventions / How to coordinate with
the architect).

- **Scope:** top-level Claude Code mod folders — for `arcanum-next-step/`:
  `.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.ts`,
  `types/index.d.ts`, `*.test.ts`, the mod's `README.md`. Like `node`, it also owns
  the `docs/agents/` updates for the mods it builds (their `folder-structure.md` rows
  and any architecture doc describing a mod's internals).
- **Not owned:** `core/` (`node`), Docker/Makefile (`infra`), skills that call a
  mod's tools (`skill-writer`, e.g. #798), `AGENTS.md`/root README/roster
  (`architect`).
- **Stack/conventions:**
  - TypeScript hooks module (`export const register: Register = (on, options) => …`),
    running in Claude Code's own environment — no Node, no DOM, everything through `# Issue: Create the mod agent

## Description

Part of epic #790, needed by #797 (ship the `arcanum-next-step` mod). See #797's
"Folder ownership" section for the decision.

Create the `mod` specialist agent owning top-level Claude Code mod folders (starting
with `arcanum-next-step/`), before any mod code is written. The name is `mod` (the
`plugin-authoring` skill's term) rather than `plugin`, which is ambiguous with Claude
Code marketplace plugins.

## Problem

#797 introduces `arcanum-next-step/`, a new root-level folder holding a TypeScript
Claude Code mod. No existing agent fits it: `node`'s conventions (Jasmine, c8, ESLint
flat config, shell/native byte parity, `core/bin/arcanum` routing) do not apply to a
mod, which runs in Claude Code's own environment (no Node, no DOM, everything through
`# Issue: Create the mod agent

## Description

Part of epic #790, needed by #797 (ship the `arcanum-next-step` mod). See #797's
"Folder ownership" section for the decision.

Create the `mod` specialist agent owning top-level Claude Code mod folders (starting
with `arcanum-next-step/`), before any mod code is written. The name is `mod` (the
`plugin-authoring` skill's term) rather than `plugin`, which is ambiguous with Claude
Code marketplace plugins.

) and is checked with `claude plugin validate` / `claude plugin test` / `tsc`.
Without an owner, the mod code in #797 has nowhere to be dispatched.

## Expected Behavior

- A `mod` agent exists in `.claude/agents/` and is listed everywhere the agent
  roster is documented, so planners and dispatchers route mod work to it.
- `arcanum-next-step/` appears in the folder structure doc with owner `mod`.

;
  - guarding hooks (`tool.call`, `prompt.submit`, …) carry a `.catch` handler;
  - `$.state` values declared in `types/index.d.ts`, named in `plugin.json` `"types"`;
  - checked with `claude plugin validate <folder>`, `tsc -p <folder>` and
    `claude plugin test <folder>` (at least one `*.test.ts` per behavior);
  - the bundled `plugin-authoring` skill and its generated `claude-code.d.ts` are the
    API reference;
  - a registered tool's name and input schema are a public contract for the skills
    that call it — changes are breaking and documented in the mod's `README.md`.

### Roster and folder docs

- `docs/agents/architecture/agent-roster-and-delegation.md` — add the `mod` row.
- `AGENTS.md` — add the `mod` row to the Agents table.
- `.claude/agents/architect.md` — add the `mod` row to the Specialist agents table,
  and backfill the missing `node` and `infra` rows while there (the table is stale).
- `docs/agents/folder-structure.md` — add the `arcanum-next-step/` row (owner `mod`).
- Out of scope: the `docs/agents/architecture.md` index line describing the roster
  doc is left unchanged.

### Owner

`architect`.

### Dependencies

None. Must land before #797's mod code.

## Benefits

- #797's mod code can be dispatched to a specialist with the right conventions
  instead of being forced onto `node` or done ad hoc by `architect`.
- Future top-level mods get an owner from day one.
