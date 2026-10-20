# Issue: Create the client agent

## Description
Part of epic #767 (Arcanum user-facing CLI for configuration). See the epic and the spec (`docs/agents/specs/arcanum-cli.md`, "Ownership") for the full design decisions.

Create the `client` specialist agent owning the new root-level `cli/` folder, before any CLI code is written (#779 onward), and formally add `.circleci/` to `infra`'s scope.

## Problem
The CLI epic introduces a new root-level folder, `cli/`, and arcanum's rule is that a new root folder needs an explicit owning agent. Today no agent owns `cli/`, and `.circleci/` has no formal owner even though the epic adds several CI jobs to it. Without this, implementation sub-issues can't be planned or dispatched to the right specialist.

## Expected Behavior
- A `client` agent exists, appears in every roster, and planners can split CLI work to it.
- `infra` owns `.circleci/`.
- `client` has a commit identity in the repo config.
- `.claude/agents/client.md` is the single source of truth for `client`'s conventions; the spec no longer duplicates them.

## Solution

Docs/config-only change (owner: `architect`). No `cli/` code is written here.

### `.claude/agents/client.md` (new)

- **Frontmatter:** `name: client`, a `description` naming `cli/` and its contents (so planners/dispatchers can match it), `tools: Read, Edit, Write, Bash` — no `Agent` tool; delegation goes through `architect`.
- **Scope:** all of `cli/` — `cli/bin/arcanum`, `cli/lib/`, `cli/spec/`, `cli/scripts/build.mjs` (the `esbuild` build with the metafile shared-surface check and the embedded per-scope migration-version list, read-only on `arcanum/migrations/repos/*/migrations.json`), `cli/package.json`, `cli/eslint.config.mjs` (including the rule restricting `core/lib` imports to the shared-surface entry files), `cli/README.md`. Also the `cli/` row in `docs/agents/folder-structure.md`, an architecture doc for the CLI's internals, and the end-user guide (e.g. `docs/guides/arcanum-cli.md`).
- **Explicitly owned pieces:** the runtime Node-version check in `cli/bin/arcanum`; the spec asserting `cli/package.json`'s `engines.node` equals `core/package.json`'s (and the `cli/bin/arcanum` floor literal equals both); the specs asserting `cli/package.json`'s `version` equals `arcanum.version`, the manifest shape and the `npm pack` contents.
- **Not owned:** `core/lib` / `core/spec` (`node`); Docker, docker-compose, Makefile `cli-*` targets, `.circleci/`, `scripts/publish_cli_package.sh`, `scripts/bump-version.sh` (`infra`); `AGENTS.md`, root `README.md`, the agent roster (`architect`).
- **Stack/conventions** (this file becomes their source of truth): Node ESM, Yarn, Jasmine, c8, ESLint with the same style rules as `core/`; zero runtime npm deps (`node:util` `parseArgs`); config written only through the shared config logic, never by writing a config file directly; human-readable output by default plus `--json`; specs use temp dirs as fake `CLAUDE_CONFIG_DIR`s and repos, never the real `~/.claude`; `child_process` only via `execFile`/`spawn` with argument arrays.
- **Cross-boundary rule:** `client` never edits `core/lib`; it requests shared-surface changes through `architect`. A PR changing a shared-surface file in `core/lib` keeps the CLI specs green in the same PR, with the plan split across `node` and `client`.

### `.claude/agents/infra.md`

- Add `.circleci/` to its scope (and to its `description`): the `test` and `release` workflows, including the future `cli` test job, the Node 22.13 floor job for `cli/` specs, and the `publish-cli` job plus `NPM_TOKEN` setup.

### `.claude/agents/node.md`

- Add the reciprocal cross-boundary rule: `node` never edits `cli/`; a change to a shared-surface file keeps the CLI specs green in the same PR, with `client` handling the `cli/` side.

### `.claude/configuration/arcanum-repo-config.json`

- Add `"client": "darthjee+frontend@gmail.com"` to `git.agents` — reusing the existing `+frontend` alias (shared with `skill-writer`) rather than creating a new one, since this config is shared with other contributors.

### Docs

- `docs/agents/architecture/agent-roster-and-delegation.md` — add the `client` row (scope + when dispatched); update the `infra` row to include `.circleci/`.
- `AGENTS.md` — add `client` to its agent table and update the `infra` row.
- `docs/agents/folder-structure.md` — add the `cli/` row (owner `client`, noting it is created by #779); note `infra` ownership in the `.circleci/` row.
- `docs/agents/specs/arcanum-cli.md` — replace the "`client` conventions" list with a pointer to `.claude/agents/client.md`, keeping only the ownership table and agent boundaries, as the spec itself requires once this issue lands; replace "The alias is chosen in #775" with the chosen `+frontend` alias.

### Dependencies

All spec sub-issues (#768–#774) are closed. Must land before any `cli/` code (#779+).
