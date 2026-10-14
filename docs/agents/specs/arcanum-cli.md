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

Pieces introduced by this spec's decisions:

| Piece | Owner |
| --- | --- |
| Runtime Node-version check in `cli/bin/arcanum` (see "Runtime") | `client` |
| Spec asserting `cli/`'s `engines.node` equals `core/`'s | `client` |
| Embedding the per-scope migration-version list in the build (read-only on `arcanum/migrations/repos/*/migrations.json`) | `client` |
| CircleCI job running the `cli/` specs on Node 22.13 | `infra` |
| Repo-root normalizing helper (`rev-parse --show-toplevel`), if placed in the shared surface (placement detailed in [Shared Config Logic](arcanum-cli/shared-config-logic.md)) | `node` |
| `no-restricted-imports` rule in `core/eslint.config.mjs` | `node` |

The key registry's owner is decided in [Key Registry](arcanum-cli/key-registry.md), not here.

`client` gets `Read, Edit, Write, Bash` and no `Agent` tool. Its delegation goes through `architect`.

**Cross-boundary changes:**

- A PR changing a shared-surface file keeps the CLI specs green in the same PR.
- The planner (`plan-issue` / `auto-plan-issue`) splits such plans across `node` and `client`, using the usual per-agent split.
- `client` never edits `core/lib`; `node` never edits `cli/`.

**Commit identity:** `client` gets a `git.agents` entry in this repo's `.claude/configuration/arcanum-repo-config.json`. It reuses an existing persona alias rather than a new one (as `node` reuses `+backend`), since that config is shared with other contributors. The alias is chosen in #775.

**`client` conventions.** This list is the input for #775. Once #775 lands, `.claude/agents/client.md` is the source of truth for `client`'s working conventions, and this spec keeps only the ownership table and the agent boundaries, so the two lists do not drift.

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
- When neither is set, the default is `$HOME/.claude`, which matches Claude Code and arcanum's own resolution.
- An empty `CLAUDE_CONFIG_DIR=""` counts as unset, as with bash's `${CLAUDE_CONFIG_DIR:-...}`.
- `arcanum config info` shows which directory was resolved and where it came from (flag, env or default).

`~` expansion differs between the flag and the environment variable:

- **`--claude-config-dir`:** the CLI expands a leading `~` and `~/...` itself, because the shell does not expand it in every position (e.g. `--claude-config-dir=~/...`). `~user` is not supported and is a usage error. A relative path resolves against the current directory to an absolute path, which `info` shows.
- **`CLAUDE_CONFIG_DIR`:** used **verbatim, with no `~` expansion**, matching `ConfigChain` (`core/lib/utils/config/ConfigChain.js`), the shell helpers and Claude Code. Expanding it in the CLI only would make the CLI and the skills write to different places for a quoted `CLAUDE_CONFIG_DIR="~/.claude-favini"`. When the value starts with `~`, the CLI warns that it was not expanded.

Account edge cases:

| Case | Reads (global tier) | Writes `--global` |
| --- | --- | --- |
| **Unresolved** (no flag, no `CLAUDE_CONFIG_DIR`, no `$HOME`) | Tier empty, stderr warning. | Error, "target unavailable". |
| **Directory missing** (e.g. a typo such as `~/.claude-favni`) | Tier empty, warning naming the path. | **Refused**, "target unavailable". The CLI never creates the directory, so a typo cannot silently create a phantom account. |
| **Path is a file**, not a directory | Error. | Error. |
| **Directory exists, no `arcanum-config.json`** | Tier empty. | Normal. The file is created on first write, as `global_config_write` does. |
| **Directory exists, no arcanum install in it** | Normal. | Normal. Not checked, consistent with not depending on the install (see "Version skew"). |

**Repo (repo and local tiers).** These resolve from the current directory, which `--repo <path>` overrides.

- Both are normalized with `git -C <path> rev-parse --show-toplevel`. A subdirectory targets the repo root. Inside a worktree, the root is that worktree's own directory, since each worktree has its own `.claude/state/`. `info` shows the resolved root.
- `--repo` pointing at a non-existent path or a non-directory is a usage error, reusing `RepoPath`'s messages (`core/lib/utils/file/RepoPath.js`).
- Git is required for the repo and local tiers. With no `git` on PATH, the CLI treats the target as "no repo", with a warning. The global tier keeps working.
- The normalization rule is detailed in [Command Surface](arcanum-cli/command-surface.md). Where the root-normalizing helper lives is detailed in [Shared Config Logic](arcanum-cli/shared-config-logic.md).

Repo states:

| State | Detection | Reads | Writes `--repo` / `--local` |
| --- | --- | --- | --- |
| **No repo** (not git, bare repo, or no git) | `rev-parse --show-toplevel` fails | `get`/`list` without a tier read the global tier only, with a stderr note. An explicit `--repo`/`--local` is an error. | Error. |
| **Git repo, not arcanum-configured** | `.claude/configuration/arcanum-repo-config.json` is missing | Missing tiers read as empty. | **Refused**, hinting at `/init-claude`. |
| **Configured** | That file exists | Normal. | Normal. The local file is created on first write, as the skills do. |

- Writing into an unconfigured repo is refused because creating the file by hand would half-initialize the repo outside `init-claude`: with no version pointer it reads as `0.0.0`, so every migration would look pending.
- **No override.** `--force` does not bypass this refusal. Initializing a repo is `init-claude`'s job.
- "No repo" and "not configured" errors use the "target unavailable" exit code (see "Exit codes").

### `arcanum config info`

`info` describes the CLI's **environment**: where it would read and write, and whether writing there is safe. It never shows config values; that is `get`/`list`'s job.

Example (human output):

```text
arcanum-cli 2.4.0 (node 22.14.0, requires >=22.13.0)

Account
  claude config dir  /Users/x/.claude-favini   (from: env CLAUDE_CONFIG_DIR)
  global config      /Users/x/.claude-favini/arcanum-config.json   [exists]
  global version     2.3.0   behind — 1 pending migration, run /arcanum-migrate

Repo
  root               /Users/x/projects/foo   (from: cwd)
  repo config        .claude/configuration/arcanum-repo-config.json   [exists]
  repo version       2.4.0   up to date
  local config       .claude/state/arcanum-config.json   [missing]
  local version      0.0.0 (no pointer)   behind — 3 pending migrations, run /arcanum-migrate
```

Fields:

- **CLI:** CLI version, running Node version, required Node floor.
- **Account:** resolved Claude config directory and its source (`flag`, `env`, `default` or `unresolved`); global config file path and whether it exists; global pointer and skew status.
- **Repo:** root and its source (`flag` or `cwd`); for each of the repo and local files: path, whether it exists, pointer and skew status.
- **Skew status:** one of `up to date`, `behind (N pending)`, or `ahead (writes refused without --force)`. `N` is a **count** of pending migrations for that tier's scope, not the list.

Behaviour:

- `--json` emits the same data as a stable object with `cli`, `account` and `repo` blocks. `repo` is `null` when no repo is found. The shape is detailed in [Command Surface](arcanum-cli/command-surface.md).
- `info` never fails because of environment state: no repo, an unresolved account directory and missing files are reported, not errors. It **always exits 0**, except on usage errors. Scripts inspect the JSON.
- Read-only: it never creates files and never takes locks.
- It deliberately leaves out the arcanum install's location and version, consistent with "Version skew" not depending on the install.

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

- [Command Surface](arcanum-cli/command-surface.md): the generic `arcanum config` layer (`get/set/unset/list/info`), tier rules, value parsing, global flags, output, exit codes (including the numbers for "version skew refused" and "target unavailable"), `--force`'s scope, `--repo` normalization, the `info` JSON shape, `--help`/`--version`.
- [Shortcuts and Setup](arcanum-cli/shortcuts-and-setup.md): the curated shortcuts, their default tiers and design rules, and the TTY-only `config setup` wizard.
- [Key Registry](arcanum-cli/key-registry.md): the shared, machine-readable registry of known config keys that drives validation, listing, help, the wizard and the shortcuts; `--force` and per-key skew granularity.
- [Shared Config Logic](arcanum-cli/shared-config-logic.md): the declared shared surface in `core/lib`, `ConfigError` decoupling, the import lint rule, `esbuild` bundling, CI coupling, and where the repo-root normalizing helper lives.
- [Packaging and Release](arcanum-cli/packaging-and-release.md): the `cli/` layout, `package.json` (`engines.node`), build output (`esbuild` target, embedded migration-version list), the runtime-check entrypoint, the Node 22.13 CI job, and the CircleCI npm publish job.

## Related work outside this spec

- **Consolidating `monitor-issues.clear_context`** (#776). This toggle lives today in its own file, `.claude/state/monitor-issues-config.json`, outside the three-tier chain. #776 moves it into `.claude/state/arcanum-config.json` as `monitor-issues.clear_context`, routes it through the shared config helpers, and copies the existing value forward with a per-repo migration (the same `repo_config_seed` pattern used when `auto-fix-all`'s legacy files were superseded). It also updates `monitor-issues/scripts/config.sh`, `/toggle-monitor-clear-context` and [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md). It must land before the CLI exposes the key, so the CLI only ever deals with the three-tier files.
- **Extracting the shared config logic into its own npm package** is a follow-up outside epic #767. See [Shared Config Logic](arcanum-cli/shared-config-logic.md#future-work).

## Alternatives considered

- **Renaming `core/bin/arcanum` to free the name.** Rejected: it touches `engine_dispatch.sh`, the Docker image and older installs, for no user benefit, since the internal dispatcher is never on PATH.
- **One binary for both internal and user commands**, with an `internal` namespace. Rejected: it mixes two argv conventions and exposes internal commands to users.
- **Shipping the CLI inside each arcanum install**, plus a PATH migration. Rejected: users with several installs would get several competing clients.
- **Detecting version skew against the arcanum install's own version** (`arcanum.json`). Rejected: the CLI cannot reliably locate the install serving a repo, and the tier pointers are what describe the files' shape.

## Backward compatibility, testing and security

**Backward compatibility:**

- The CLI never changes config shapes. It reads and writes the existing tier files through the shared config logic.
- "Version skew" protects both older and newer repos and accounts: writes to a newer shape are refused, and older ones get a migration hint only when migrations are actually pending.
- `core/bin/arcanum` is untouched, and no per-repo migration is needed.

**Testing:**

- `cli/` specs use temp dirs as fake `CLAUDE_CONFIG_DIR`s and repos, never the real `~/.claude`.
- They cover each skew case, each repo state, each account edge case, and the `info` JSON shape.
- A CircleCI job runs the `cli/` specs on Node 22.13 (see "Runtime").
- The CLI specs also run when a shared-surface file changes. Detailed in [Shared Config Logic](arcanum-cli/shared-config-logic.md).

**Security:**

- Zero runtime npm dependencies.
- No directory creation for an unknown account, and no write into an unconfigured repo.
- No `~` expansion of `CLAUDE_CONFIG_DIR`, so the CLI never diverges from the skills.
- `child_process` only through `execFile`/`spawn` with argument arrays.
- Writes only through the shared locking logic.

**Performance:** nothing load-sensitive. The CLI is a single-file bundle and runs one `git rev-parse` per invocation.

## Open points

The index has no open points of its own. Each part keeps its own list; there is no consolidated copy here, since it would drift.

## See also

- [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md): the three tier files and their resolution.
- [Script Engine](../architecture/script-engine.md): the internal `core/bin/arcanum` dispatcher.
- [Install and Release](../architecture/install-and-release.md): the release pipeline the npm publish job joins.
- [Agent Roster and Delegation](../architecture/agent-roster-and-delegation.md): where the `client` agent is added.
- [Global Config guide](../../guides/arcanum-global-config.md): the global config file and its resolution.
