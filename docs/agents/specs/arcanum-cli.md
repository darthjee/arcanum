# Spec: Arcanum CLI

## Status

Proposed. Nothing in this spec is implemented yet.

Origin: epic #767 (design discussion); this spec supersedes the epic body.

From this spec's merge on, it is the source of truth for the CLI design. Later changes, from the "Enhance spec" sub-issues (#769–#774) or during implementation, are made here and are not back-ported to #767. The epic body is a historical snapshot; only its split list may still change.

## Goal

Provide an `arcanum` command that runs outside Claude Code and manages arcanum's configuration across all three tiers:

| Tier | File | Typical keys |
| --- | --- | --- |
| Global | `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` | the agents' email (`git.email`, `git.agents.<agent>`), `next_step.auto.<skill>` defaults |
| Repo (committed) | `.claude/configuration/arcanum-repo-config.json` | `engine.mode`, `auto-fix-all.ignored_check_patterns` |
| Local (gitignored) | `.claude/state/arcanum-config.json` | `engine.mode` override, `git.safe_branch`, toggles |

Resolution order is local → repo → global, as described in [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md).

**Non-goals:**

- Anything other than configuration, for now. All commands live under `arcanum config ...`, so the top-level `arcanum <command>` namespace stays free for later features.
- Installing, updating or removing arcanum itself.

## Distribution

- The CLI is **optional**. It is packaged and installed **separately** from arcanum, as the npm package `arcanum-cli` (`npm i -g arcanum-cli`). The installed command is `arcanum`.
- One machine-wide install serves every arcanum install and every Claude account on the machine. Users with more than one arcanum install (for example one per `CLAUDE_CONFIG_DIR`) must not end up with several competing clients.
- No per-repo migration installs the CLI or nudges the user to install it. The docs (README and guides) explain how to install it.
- It runs on the **host's Node.js**, with no Docker fallback. Node is already a prerequisite of arcanum's native engine. The minimum version is set in [Runtime](#runtime).

Details: [Packaging and Release](arcanum-cli/packaging-and-release.md).

## Relationship to `core/bin/arcanum`

Decision: **separate entrypoint, shared logic.**

- `core/bin/arcanum` is the internal native dispatcher, called by `arcanum/_lib/engine_dispatch.sh` (see [Script Engine](../architecture/script-engine.md)). It stays untouched: no rename, and no change to `engine_dispatch.sh`, the Docker image or `migration-status.json`.
- The internal dispatcher is never on the user's PATH, so it does not collide with the user-facing `arcanum` command. User and developer docs must state this distinction.
- The user-facing CLI is its own entrypoint in a new root folder, `cli/`. It has its own small command registry, its own `--help`, repo resolution that defaults to the current directory, and human-readable output.
- It reads and writes config exactly like the skills do: same tier files, same dotted-path semantics, same locking. See [Shared Config Logic](arcanum-cli/shared-config-logic.md).

## Ownership

A new root-level folder needs a new specialist agent. A `client` agent owns `cli/` and must be created (`.claude/agents/client.md` plus the [agent roster](../architecture/agent-roster-and-delegation.md)) before any CLI code is written. That is sub-issue #775.

| Agent | Owns for this feature |
| --- | --- |
| `client` | All of `cli/` (`cli/bin/arcanum`, `cli/lib/`, `cli/spec/`, `cli/package.json`, `cli/eslint.config.mjs`, `cli/README.md`); the `cli/` row in `docs/agents/folder-structure.md`; an architecture doc for the CLI's internals; the end-user guide (e.g. `docs/guides/arcanum-cli.md`); the build/bundling step. |
| `node` | `core/lib` source, including the shared config services the CLI bundles. `client` requests changes there through `architect`. |
| `infra` | Docker, docker-compose and Makefile `cli-*` targets; `.circleci/`, including the npm publish job and npm token setup. `.circleci/` is formally added to `infra`'s scope. |
| `architect` | `AGENTS.md`, the root `README.md`, the agent roster, and this spec. |

`client` gets `Read, Edit, Write, Bash` and no `Agent` tool. Its delegation goes through `architect`.

**`client` conventions:**

- Node.js ESM, Yarn, Jasmine, c8, and ESLint with the same style rules as `core/`.
- Zero runtime npm dependencies (see [Command Surface](arcanum-cli/command-surface.md)).
- Config is written only through the shared config logic, never by writing a config file directly.
- Human-readable output by default, `--json` for scripting.
- Specs use temp dirs as fake `CLAUDE_CONFIG_DIR`s and repos, and never touch the real `~/.claude`.
- `child_process` is used only through `execFile`/`spawn` with argument arrays.

## Targeting

**Account (global tier).** Users with several installs must be able to target any of them:

- The `CLAUDE_CONFIG_DIR` environment variable is honoured. For example, `CLAUDE_CONFIG_DIR=~/.claude-favini arcanum config agents email set ...` targets `~/.claude-favini/arcanum-config.json`.
- `--claude-config-dir <dir>` overrides the environment variable.
- The CLI expands a leading `~` itself, because the shell does not expand it in every position (e.g. `--claude-config-dir=~/...`).
- When neither is set, the default is `$HOME/.claude`, which matches Claude Code and arcanum's own resolution.
- `arcanum config info` shows which directory was resolved and where it came from (flag, env or default).

**Repo (repo and local tiers).** These resolve from the current directory, which `--repo <path>` overrides.

## Version skew

One CLI may face repos and accounts on different arcanum versions.

**Version pointers.** Each tier records the shape of its own file:

| Tier | Pointer |
| --- | --- |
| Global | `.migrations.version` in `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` |
| Repo | `.version` in `.claude/configuration/arcanum-repo-config.json` (see [the repo version guide](../../guides/arcanum-repo-version.md)) |
| Local | `.migrations.version` in `.claude/state/arcanum-config.json` |

- Migrations are scoped per tier (`applies_to: repo|local|global`), so the three files can sit at different versions.
- A pointer holds an arcanum version (e.g. stamped by `init-claude`), not a migration number.
- A missing pointer counts as `0.0.0`, as in `arcanum/migrations/run.sh`.

**Detection.** The CLI compares a tier's pointer with its own version. The CLI ships in lockstep with arcanum, so its version is the newest shape it can know. On a write, only the target tier's pointer matters: `set --global` ignores the repo pointer.

| Case | Reads | Writes |
| --- | --- | --- |
| **Tier ahead** (pointer > CLI version) | Allowed, with a stderr warning suggesting `npm i -g arcanum-cli@latest`. | Refused with the "version skew refused" exit code, unless `--force` is passed. The CLI may not know renamed or moved keys. |
| **Tier behind** (pointer < CLI version) | Allowed. | Allowed. |
| **Equal** | Silent. | Silent. |

- "Tier behind" is the common case: the repo is not migrated yet. The CLI prints a stderr warning suggesting `/arcanum-migrate` **only** when that tier's scope has pending migrations between the pointer and the CLI version. Patch bumps with no shape change raise no warning.
- To know which migrations are pending, the build embeds the per-scope list of migration versions, read from `arcanum/migrations/repos/*/migrations.json`. Detailed in [Packaging and Release](arcanum-cli/packaging-and-release.md).
- `--force` is the same flag that bypasses key registry validation. Detailed in [Command Surface](arcanum-cli/command-surface.md) and [Key Registry](arcanum-cli/key-registry.md).

**Future work:** per-key granularity. A `since`/`moved_in` field in the key registry would let the CLI refuse a write to a key touched by a pending migration, not just warn. Detailed in [Key Registry](arcanum-cli/key-registry.md).

## Runtime

The CLI runs on the host's Node.js (see "Distribution").

- **Floor: `>=22.13.0`, in lockstep with `core`.** `core/package.json` already declares `"engines": { "node": ">=22.13.0" }`. The CLI bundles `core/lib` shared code, so it accepts exactly the Node versions `core` supports: no lower (the shared code would break), no higher (the host Node is the one the native engine already requires).
- **Lockstep is enforced.** A `cli/` spec (or CI check) asserts that `cli/package.json`'s `engines.node` equals `core/package.json`'s. The `esbuild` `target` (`node22.13`) derives from the same value, so the bundle never emits newer syntax.
- **Runtime check.** npm only warns on `engines` (unless `engine-strict` is set). So `cli/bin/arcanum` is a tiny, syntax-conservative entrypoint: it compares `process.versions.node` with the floor, prints `Node.js >= 22.13.0 required, found X` and exits with the generic error code when too old, and only then dynamically `import()`s the bundle.
- **Tested at the floor.** A CircleCI job, owned by `infra`, runs the `cli/` specs on Node 22.13 exactly, in addition to the default image.
- **Raising the floor** follows `core`, decided by `node` with `architect`. It is called out in the release notes as breaking for both the native engine and the CLI. It needs no per-repo migration, since no config shape changes.

Details: [Packaging and Release](arcanum-cli/packaging-and-release.md).

## Exit codes

Besides the generic codes, the index fixes two dedicated exit codes, named here by meaning only. Their numbers and identifiers are defined in [Command Surface](arcanum-cli/command-surface.md).

| Meaning | When |
| --- | --- |
| **Version skew refused** | A write to a tier whose pointer is ahead of the CLI, without `--force`. |
| **Target unavailable** | Nowhere to read or write the requested tier: no repo, an unconfigured repo, or an unresolved or missing Claude config directory. One code covers every tier, so scripts handle "nowhere to write" in one place. |

- `--force` bypasses registry validation and version skew. It **never** bypasses "target unavailable".
- A Node.js older than the floor exits with the generic error code (no dedicated code).
- Usage errors (e.g. `--repo` pointing at a non-existent path) use the generic usage code.

## Parts

- [Command Surface](arcanum-cli/command-surface.md): the generic `arcanum config` layer (`get/set/unset/list/info`), tier rules, value parsing, global flags, output, exit codes, `--help`/`--version`.
- [Shortcuts and Setup](arcanum-cli/shortcuts-and-setup.md): the curated shortcuts, their default tiers and design rules, and the TTY-only `config setup` wizard.
- [Key Registry](arcanum-cli/key-registry.md): the shared, machine-readable registry of known config keys that drives validation, listing, help, the wizard and the shortcuts.
- [Shared Config Logic](arcanum-cli/shared-config-logic.md): the declared shared surface in `core/lib`, `ConfigError` decoupling, the import lint rule, `esbuild` bundling and CI coupling.
- [Packaging and Release](arcanum-cli/packaging-and-release.md): the `cli/` layout, `package.json`, build output, and the CircleCI npm publish job.

## Related work outside this spec

- **Consolidating `monitor-issues.clear_context`** (#776). This toggle lives today in its own file, `.claude/state/monitor-issues-config.json`, outside the three-tier chain. #776 moves it into `.claude/state/arcanum-config.json` as `monitor-issues.clear_context`, routes it through the shared config helpers, and copies the existing value forward with a per-repo migration (the same `repo_config_seed` pattern used when `auto-fix-all`'s legacy files were superseded). It also updates `monitor-issues/scripts/config.sh`, `/toggle-monitor-clear-context` and [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md). It must land before the CLI exposes the key, so the CLI only ever deals with the three-tier files.
- **Extracting the shared config logic into its own npm package** is a follow-up outside epic #767. See [Shared Config Logic](arcanum-cli/shared-config-logic.md#future-work).

## Alternatives considered

- **Renaming `core/bin/arcanum` to free the name.** Rejected: it touches `engine_dispatch.sh`, the Docker image and older installs, for no user benefit, since the internal dispatcher is never on PATH.
- **One binary for both internal and user commands**, with an `internal` namespace. Rejected: it mixes two argv conventions and exposes internal commands to users.
- **Shipping the CLI inside each arcanum install**, plus a PATH migration. Rejected: users with several installs would get several competing clients.
- **Detecting version skew against the arcanum install's own version** (`arcanum.json`). Rejected: the CLI cannot reliably locate the install serving a repo, and the tier pointers are what describe the files' shape.

## Open points

- Exact version-skew behaviour: when to warn and when to refuse writes, and how "newer than understood" is detected.
- Minimum supported Node.js version (also `engines.node`, see [Packaging and Release](arcanum-cli/packaging-and-release.md)).
- The exact fields of `arcanum config info`.
- Behaviour when `--repo` (or the current directory) is not inside an arcanum-configured repo.

## See also

- [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md): the three tier files and their resolution.
- [Script Engine](../architecture/script-engine.md): the internal `core/bin/arcanum` dispatcher.
- [Install and Release](../architecture/install-and-release.md): the release pipeline the npm publish job joins.
- [Agent Roster and Delegation](../architecture/agent-roster-and-delegation.md): where the `client` agent is added.
- [Global Config guide](../../guides/arcanum-global-config.md): the global config file and its resolution.
