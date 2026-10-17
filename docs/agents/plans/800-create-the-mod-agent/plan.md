# Plan: Create the mod agent

Issue: [800-create-the-mod-agent.md](../../issues/800-create-the-mod-agent.md)

## Overview

Add a `mod` specialist agent that owns top-level Claude Code mod folders (starting with
`arcanum-next-step/`, introduced by #797), and register it everywhere the agent roster
and folder ownership are documented. Docs/agent-definition only: no mod code, no
`arcanum-next-step/` folder is created here.

## Context

#797 ships `arcanum-next-step/`, a TypeScript Claude Code mod at the repo root. `node`'s
conventions (Jasmine, c8, ESLint, shell/native parity, `core/bin/arcanum` routing) don't
fit a mod, which runs in Claude Code's own environment through `$` and is checked with
`claude plugin validate` / `claude plugin test` / `tsc`. #797's "Folder ownership"
section decided on a new `mod` agent, created here, before any mod code lands.

Every file touched is `architect`-owned (`.claude/agents/`, `AGENTS.md`, `docs/agents/`),
so no specialist is dispatched.

## Implementation Steps

### Step 1 — Write `.claude/agents/mod.md`

Create the agent definition, mirroring `.claude/agents/node.md`'s shape (frontmatter,
then `## Your scope`, `## Stack`, `## Conventions`, `## How to coordinate with the
architect`).

- **Frontmatter:** `name: mod`; `description:` along the lines of "Arcanum Claude Code
  mod specialist. Use for any task involving a top-level mod folder — currently
  `arcanum-next-step/` (`.claude-plugin/plugin.json`, `hooks/hooks.json`,
  `hooks/register.ts`, `types/index.d.ts`, `*.test.ts`, its `README.md`)."; `tools:
  Read, Edit, Write, Bash`.
- **Your scope:** the files above, for `arcanum-next-step/` and any future top-level
  mod folder. Like `node`, it owns the `docs/agents/` updates for the mods it builds:
  their `docs/agents/folder-structure.md` rows and any architecture doc under
  `docs/agents/architecture/` describing a mod's internals. Not owned: `core/`
  (`node`), Docker/docker-compose/Makefile (`infra`), skills that call a mod's tools
  (`skill-writer`, e.g. #798), `AGENTS.md`/root README/the roster (`architect`).
- **Stack:** TypeScript hooks module (`export const register: Register = (on, options)
  => …`) running in Claude Code's own environment: no Node, no DOM, everything through
  `$`. API reference: the bundled `plugin-authoring` skill and its generated
  `claude-code.d.ts`.
- **Conventions:**
  - guarding hooks (`tool.call`, `prompt.submit`, …) always carry a `.catch` handler;
  - `$.state` values are declared in `types/index.d.ts` and named in `plugin.json`'s
    `"types"`;
  - every change is checked with `claude plugin validate <folder>`, `tsc -p <folder>`
    and `claude plugin test <folder>`, with at least one `*.test.ts` per behavior;
  - a registered tool's name and input schema are a public contract for the skills
    that call it: changing them is breaking and must be documented in the mod's
    `README.md`.
- **How to coordinate with the architect:** align with `architect` before changing a
  tool contract or anything affecting another agent's scope; route Makefile/Docker
  needs to `infra` and calling-skill changes to `skill-writer` through `architect`.

### Step 2 — Register `mod` in the roster and folder docs

- `docs/agents/architecture/agent-roster-and-delegation.md` — add a `mod` row to the
  Agent Roster table (Scope: top-level Claude Code mod folders, e.g.
  `arcanum-next-step/`; When dispatched: whenever a mod's hooks, types, tests,
  manifest or README need to be written or edited).
- `AGENTS.md` — add a `mod` row to the `## Agents` table, after `infra`.
- `.claude/agents/architect.md` — add `node`, `infra` and `mod` rows to the
  `## Specialist agents` table (it currently lists only `scripter`, `skill-writer`,
  `skill-reviewer`), using the same scope wording as `AGENTS.md`.
- `docs/agents/folder-structure.md` — add an `arcanum-next-step/` row to the Project
  Root table: the Claude Code mod that clears context and submits the next command at
  a next-step handoff (#797), owned by the `mod` specialist agent. Note that the folder
  itself lands with #797.

## Files to Change

- `.claude/agents/mod.md` — new agent definition.
- `docs/agents/architecture/agent-roster-and-delegation.md` — `mod` roster row.
- `AGENTS.md` — `mod` row in the Agents table.
- `.claude/agents/architect.md` — `node`, `infra`, `mod` rows in the Specialist agents
  table.
- `docs/agents/folder-structure.md` — `arcanum-next-step/` row (owner `mod`).

## Notes

- `docs/agents/architecture.md`'s index line for the roster doc is left unchanged
  (out of scope, per the issue).
- The `folder-structure.md` row describes a folder that won't exist until #797 merges;
  that's intentional, since #800 has to land first.
- Once merged, `mod` shows up in `list_agents.sh` output, so #797's plan can assign
  the mod code to it.
