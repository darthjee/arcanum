# Issue: Write the arcanum CLI spec

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration).

Write the forward-looking spec for the `arcanum` CLI — an optional, separately installed npm package (`arcanum-cli`, command `arcanum`) for managing arcanum's global / repo / local configuration outside Claude Code — following `docs/agents/specs.md` (index file + parts), and add its entry to the `docs/agents/specs.md` table. Docs only.

## Problem

The design of the CLI was agreed in the body of epic #767, which is a discussion snapshot, not a maintained document. The 18 follow-up sub-issues (#769–#786) need a single, self-contained, authoritative place to read and refine that design.

## Expected Behavior

- `docs/agents/specs/arcanum-cli.md` (index) and five parts under `docs/agents/specs/arcanum-cli/` exist and together restate every decision from #767.
- `docs/agents/specs.md` lists the index with status `Proposed`.
- From merge on, the spec — not #767 — is the source of truth for the CLI design.

## Solution

### Files

- `docs/agents/specs/arcanum-cli.md` — index/overview: goals and non-goals, why a separate optional npm package `arcanum-cli` (one client for multiple arcanum installs / Claude accounts), relationship to the internal `core/bin/arcanum` dispatcher (untouched, never on PATH), runtime (host Node.js, no Docker fallback), account targeting (`CLAUDE_CONFIG_DIR` env, `--claude-config-dir`, `~` expansion, default `$HOME/.claude`) and repo targeting (`--repo`, cwd default), version skew, the new `client` agent owning `cli/`, links to the parts, open points.
- `docs/agents/specs/arcanum-cli/command-surface.md` — everything under `arcanum config`: `get/set/unset/list/info`, tier rules (tier required on `set`/`unset`), value parsing (JSON vs string, `--string`), dotted-path semantics, global flags (`--repo`, `--claude-config-dir`, `--json`), output, exit codes, `--help`/`--version`.
- `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` — the agreed shortcut set (`agents email`, `engine`, `next-step auto`, `git safe-branch`, `git merge-body`, `auto-fix-all clear-context`/`finish-on-empty-queue`/`ignore-checks`, `monitor-issues clear-context`) with default tiers and design rules; the TTY-only `config setup` wizard.
- `docs/agents/specs/arcanum-cli/key-registry.md` — shared machine-readable registry of known keys (type/enum, allowed tiers, read-only, default, description, wildcard segments), location/owner to settle, validation, `--force`, "new key ⇒ registry entry" rule, bundled into the npm package at build time.
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` — declared shared surface in `core/lib` (`utils/config/*`, `utils/file/Lock.js`), `ConfigError` decoupling from `DispatchFailure`, import-restriction lint rule, `esbuild` bundling (devDependency, zero runtime deps), CI coupling; future npm-package extraction noted as out-of-epic follow-up.
- `docs/agents/specs/arcanum-cli/packaging-and-release.md` — `cli/` layout, `package.json` (`name: arcanum-cli`, `bin: {arcanum}`, `files`, `engines`), build output, CircleCI publish job (owned by `infra`), npm token handling, provenance, version lockstep with arcanum.
- `docs/agents/specs.md` — one row for the index only, status `Proposed`.

### Source of truth

- The spec **copies** every design decision from epic #767 in full — it must be self-contained (readable without GitHub access).
- From merge on, **the spec is authoritative**: later changes (in #769–#774, or during implementation) are made in the spec, not back-ported to #767. The epic body is a historical snapshot (only its split list may still change).
- The index carries a one-line **Origin** note, e.g. `Origin: epic #767 (design discussion); this spec supersedes the epic body.`
- Each file gets a short **Alternatives considered** section recording rejected options and why, e.g. renaming `core/bin/arcanum` or merging both CLIs into one binary (index); a CLI framework like `commander`/`yargs` (command surface); a per-repo migration installing the CLI (packaging); extracting a shared package now, or reimplementing config logic in the CLI (shared config logic); an unvalidated free-form `set` (key registry).
- Sub-issues #769–#786 reference the spec files, not the epic.

### Depth and shape

- This first pass writes down the agreed decisions (no new design) plus an explicit **Open points** section in every file; #769–#774 resolve them and add edge cases, backward compatibility, testing and security per file.
- Index follows `docs/agents/specs/shell-engine-removal.md`'s shape (Status — `Proposed` — / Origin / Goal / … / Open points / See also); each part uses a lighter shape (Purpose / Decisions / Alternatives considered / Open points).
- See also: `shared-state-and-configuration.md`, `script-engine.md`, `install-and-release.md`, `agent-roster-and-delegation.md`, and `docs/guides/arcanum-global-config.md`.

### Scope boundaries

- Docs only: no code, no `cli/` folder, no agent creation (#775), no registry file (#777).
- No new root-level folder is created here; no migration needed.

### Owner

`architect`.

### Dependencies

First sub-issue of epic #767; every other sub-issue depends on it.

## Benefits

- One authoritative, self-contained design document for the whole epic, readable without GitHub.
- Recorded alternatives prevent re-litigating settled decisions.
- Explicit open points give each "Enhance spec" sub-issue a clear starting list.
