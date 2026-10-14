# Issue: Enhance spec: arcanum-cli.md (index/overview)

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration). Deepen and review the index/overview spec file `docs/agents/specs/arcanum-cli.md` (written in #768): goals/non-goals, account and repo targeting (incl. `CLAUDE_CONFIG_DIR=~/.claude-favini` usage), version skew between one CLI and repos on different arcanum versions, relationship with `core/bin/arcanum`, and the `client` agent's role.

- **Owner:** `architect`.
- **Docs only** — no code. Edits only `docs/agents/specs/arcanum-cli.md` (sibling parts are handled by #770–#774, in parallel).
- **Dependencies:** after #768 (merged). Runs in parallel with the other "Enhance spec" sub-issues.

## Problem

The index currently leaves four open points unresolved — exact version-skew behaviour, minimum Node.js version, the fields of `arcanum config info`, and behaviour when `--repo`/cwd is not inside an arcanum-configured repo — and its "Version skew" and "Targeting" sections are underspecified: the spec only mentions the repo's `.version`, although each tier carries its own version pointer, and it implies `~` is expanded everywhere, which would diverge from how the skills read `CLAUDE_CONFIG_DIR`.

## Expected Behavior

After this issue, `docs/agents/specs/arcanum-cli.md`:

- records every decision below in its relevant section ("Version skew", "Targeting", a new "Runtime / Node.js" section, `info` fields, a new "Exit codes" section, an extended "Ownership" table);
- has no open points of its own — the "Open points" section becomes a short note that each part keeps its own list;
- links each decision to the part that must absorb its details ("detailed in [Command Surface](…)"), without editing the part files;
- covers backward compatibility, testing strategy and performance & security considerations for what the index describes.

## Solution

### Version skew

Resolves the open point "Exact version-skew behaviour". Facts from the codebase:

- Each tier carries its own shape pointer: repo tier `.version` in `.claude/configuration/arcanum-repo-config.json`; local tier `.migrations.version` in `.claude/state/arcanum-config.json`; global tier `.migrations.version` in `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`. Migrations are scoped per tier (`applies_to: repo|local|global`), so the three files can sit at different shape versions.
- Pointers hold an arcanum version (e.g. stamped by `init-claude`), not the last migration's folder version.

Decisions to record in `docs/agents/specs/arcanum-cli.md` (replacing the current "Version skew" section and its open point):

- **Detection:** compare each relevant tier's pointer against the CLI's own version (the CLI ships in lockstep with arcanum, so its version is the newest shape it can know). A missing pointer counts as `0.0.0`, as in `arcanum/migrations/run.sh`. On a write, only the target tier's pointer matters (e.g. `set --global` ignores the repo pointer).
- **Tier ahead (pointer > CLI version):** the CLI may not know renamed/moved keys.
  - Reads: allowed, with a stderr warning suggesting `npm i -g arcanum-cli@latest`.
  - Writes: refused with a dedicated exit code (name defined in `command-surface.md`), overridable with **`--force`** (the same flag the key registry uses to bypass validation).
- **Tier behind (pointer < CLI version):** the common case (repo not yet migrated).
  - Reads and writes: allowed.
  - A warning suggesting `/arcanum-migrate` is printed only when there are pending migrations for that tier's scope between the pointer and the CLI version. The build embeds the per-scope list of migration versions read from `arcanum/migrations/repos/*/migrations.json`, so patch bumps without shape changes raise no false alarm.
- **Equal:** silent.
- **Future work (note only):** per-key granularity — a `since`/`moved_in` field in the key registry so writes to a key touched by a pending migration can be refused, not just warned about.
- **Rejected:** comparing against the arcanum install's own version (`arcanum.json`): the CLI cannot reliably locate the install serving a repo, and the tier pointers are what describe the files' shape.
- **Cross-file follow-ups:** `command-surface.md` defines the skew exit code and documents `--force`'s extended meaning; `key-registry.md` notes `--force` also bypasses the skew refusal; `packaging-and-release.md` covers embedding the migration-version list in the build.

### Minimum Node.js version

Resolves the open point "Minimum supported Node.js version". Context: `core/package.json` declares `"engines": { "node": ">=22.13.0" }` (since #190); nothing checks the version at runtime today. As of 2026-10, Node 20 is EOL, Node 22 is maintenance LTS (until 2027-04), Node 24 is active LTS.

Decisions to record in `docs/agents/specs/arcanum-cli.md` (and reflected in `packaging-and-release.md`):

- **Floor: `>=22.13.0`, in lockstep with `core`.** The CLI bundles `core/lib` shared code, so it must accept exactly the Node versions `core` supports — no lower (the shared code would break), no higher (the host Node is the same one the native engine already requires).
- **Enforced lockstep:** a CLI spec (or CI check) asserts `cli/package.json`'s `engines.node` equals `core/package.json`'s. The `esbuild` `target` (`node22.13`) derives from the same value so the bundle never emits newer syntax.
- **Runtime check:** npm only warns on `engines` (unless `engine-strict`), so `cli/bin/arcanum` is a tiny, syntax-conservative entrypoint that compares `process.versions.node` against the floor, prints a clear "Node.js >= 22.13.0 required, found X" message and exits with the **generic error exit code** (no dedicated code) if too old, and only then dynamically `import()`s the bundle.
- **Testing at the floor:** CI runs the CLI specs on Node 22.13 exactly, in addition to the default image (a second CircleCI job, owned by `infra`), scoped to `cli/` only.
- **Raising the floor later:** follows `core`, decided by `node` with `architect`; called out in release notes as breaking for both the native engine and the CLI. No per-repo migration (no config-shape change).

### `arcanum config info` fields

Resolves the open point "The exact fields of `arcanum config info`". `info` describes the CLI's **environment** — where it would read/write and whether writing there is safe — never config values (that is `get`/`list`).

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
- **Account:** resolved Claude config dir and its source (`flag` / `env` / `default` / `unresolved`); global config file path and existence; global pointer and skew status.
- **Repo:** root and its source (`flag` / `cwd`); for each of the repo and local files: path, existence, pointer, skew status.
- **Skew status:** one of `up to date`, `behind (N pending)` — a **count** of pending migrations for that tier's scope, not the list — or `ahead (writes refused without --force)`.

Behaviour:

- `--json` emits the same data as a stable object (`cli`, `account`, `repo` blocks; `repo` is `null` when no repo is found), documented in `command-surface.md`.
- `info` never fails because of environment state (no repo, unresolved account dir, missing files are reported, not errors). It **always exits 0** except on usage errors; scripts inspect the JSON.
- Read-only: never creates files or takes locks.
- Deliberately excluded: the arcanum install's location/version (consistent with the version-skew decision not to depend on the install).
- Follow-up: `command-surface.md`'s `info` bullet and `--json` shape are updated to match.

### Repo targeting outside an arcanum-configured repo

Resolves the open point "Behaviour when `--repo` (or the current directory) is not inside an arcanum-configured repo". Context: `core/lib/utils/file/RepoPath.js` only validates "is a directory" and "is a git repo" (`git rev-parse --git-dir`); it neither normalizes to the root nor knows "arcanum-configured".

**Root resolution** (same for cwd and `--repo`):

- Normalize with `git -C <path> rev-parse --show-toplevel`: a subdirectory (cwd or `--repo`) targets the repo root; inside a worktree, the root is that worktree's own directory (each worktree has its own `.claude/state/`). `info` shows the resolved root.
- `--repo` pointing at a non-existent path or a non-directory is a usage error (generic exit code), reusing `RepoPath`'s messages.
- Git is required for the repo/local tiers; with no `git` on PATH the CLI treats it as "no repo" with a warning, and the global tier keeps working.

**States:**

| State | Detection | Reads | Writes `--repo` / `--local` |
| --- | --- | --- | --- |
| **No repo** (not git, bare repo, or no git) | `rev-parse --show-toplevel` fails | `get`/`list` without a tier use the global tier only, with a stderr note; explicit `--repo`/`--local` → error | error |
| **Git repo, not arcanum-configured** | `.claude/configuration/arcanum-repo-config.json` missing | missing tiers read as empty | **refused**, hinting at `/init-claude` |
| **Configured** | that file exists | normal | normal (the local file is created on first write, as the skills do) |

- Writing into an unconfigured repo is refused because creating the file by hand would half-initialize the repo outside `init-claude` (no version pointer → reads as `0.0.0`, every migration pending).
- **No override:** `--force` does **not** bypass this refusal — it bypasses registry validation and version skew only; initializing a repo is `init-claude`'s job.
- "No repo" and "not configured" errors use the dedicated **"target unavailable"** exit code (see "Account targeting edge cases" below; named in `command-surface.md`'s exit-code table) — scripts need to tell it apart from a usage error.
- Follow-ups: `command-surface.md` gets the new exit code and the `--repo` normalization rule; `RepoPath` (owned by `node`) may gain a root-normalizing helper as part of the shared surface, or the CLI implements it in `cli/lib/` — decided during implementation.

### Account targeting edge cases

Context: `ConfigChain` resolves `CLAUDE_CONFIG_DIR || $HOME/.claude` verbatim (no `~` expansion) and returns `null` when neither is set; an empty `CLAUDE_CONFIG_DIR=""` counts as unset (same as bash `${:-}`).

| Case | Reads (global tier) | Writes `--global` |
| --- | --- | --- |
| **Unresolved** (no flag, no `CLAUDE_CONFIG_DIR`, no `$HOME`) | tier empty, stderr warning | error, "target unavailable" |
| **Directory missing** (e.g. typo `~/.claude-favni`) | tier empty, warning naming the path | **refused** — the CLI never creates the directory, so a typo cannot silently create a phantom account |
| **Path is a file**, not a directory | error | error |
| **Directory exists, no `arcanum-config.json`** | tier empty | normal — file created on first write, as `global_config_write` does |
| **Directory exists, no arcanum install in it** | normal | normal — not checked, consistent with not depending on the install |

**Expansion / normalization:**

- `--claude-config-dir`: the CLI expands `~` and `~/...`; `~user` is unsupported (usage error); relative paths resolve against cwd to an absolute path, which `info` shows.
- `CLAUDE_CONFIG_DIR` env: used **verbatim, no `~` expansion**, matching `ConfigChain`, the shell helpers and Claude Code. Expanding it in the CLI only would make the CLI and the skills write to different places for a quoted `CLAUDE_CONFIG_DIR="~/.claude-favini"`. When the value starts with `~`, the CLI warns that it was not expanded (the shell passed it literally).
- Empty value counts as unset.

**Exit code:** one dedicated **"target unavailable"** code covers every tier — no repo, unconfigured repo, unresolved or missing account directory — so scripts handle "nowhere to write" in one place. Named in `command-surface.md`'s exit-code table.

Follow-up: the "Targeting" section of `docs/agents/specs/arcanum-cli.md` must be corrected — it currently says the CLI expands `~` generally; it should say the flag only.

### `client` agent's role

Context: #775 already creates `.claude/agents/client.md`, updates the roster, adds `.circleci/` to `infra`, and adds the `cli/` folder-structure row; its scope copies the spec's ownership and conventions.

- **Source of truth:** the spec keeps the ownership table and agent boundaries (the overview's job). Its `client` conventions list is the *input* for #775; once #775 lands, `.claude/agents/client.md` is the source of truth for `client`'s working conventions. The spec states this explicitly to avoid two drifting lists.
- **New ownership rows** (from this enhancement's decisions):

  | Piece | Owner |
  | --- | --- |
  | Runtime Node-version check in `cli/bin/arcanum` | `client` |
  | Spec asserting `cli/` `engines.node` equals `core/`'s | `client` |
  | Embedding the per-scope migration-version list in the build (reads `arcanum/migrations/repos/*/migrations.json`, read-only) | `client` |
  | CircleCI job running `cli/` specs on Node 22.13 | `infra` |
  | Repo-root normalizing helper (`rev-parse --show-toplevel`), if placed in the shared surface | `node` |
  | `no-restricted-imports` rule in `core/eslint.config.mjs` | `node` |

  The key registry's owner stays an open point of `key-registry.md`, not this file.
- **Cross-boundary changes:** a PR changing a shared-surface file must keep the CLI specs green in the same PR. The planner (`plan-issue` / `auto-plan-issue`) splits such plans across `node` and `client` using the existing per-agent split. `client` never edits `core/lib`; `node` never edits `cli/`.
- **Commit identity:** `client` gets a `git.agents` entry in this repo's `.claude/configuration/arcanum-repo-config.json`, **reusing an existing persona alias** rather than a new one (as `node` reuses `+backend`), since that config is shared with other contributors. Added to #775's scope via a comment.

### Cross-links and open points

- **#769 edits only `docs/agents/specs/arcanum-cli.md`.** The sibling "Enhance spec" issues (#770–#774) run in parallel, so their files are not edited here. Each decision is recorded in full in the index, naming the part that must absorb it ("detailed in [Command Surface](…)").
- **Hand-offs posted** as comments on the affected sibling issues: #770 (`command-surface.md`: new exit codes, `--force` scope, no-repo/unconfigured states, `--repo` normalization, `info` fields/JSON), #772 (`key-registry.md`: `migrations.version` is also a global-tier read-only key; `--force` scope; per-key skew future work), #773 (`shared-config-logic.md`: root-normalizing helper placement, cross-boundary PR rule, Node floor lockstep), #774 (`packaging-and-release.md`: Node floor resolved by the index, esbuild target, runtime-check entrypoint split, Node 22.13 CI job, migration-list embedding). `shortcuts-and-setup.md` (#771) is unaffected.
- **Index "Open points":** all four are resolved and move into their sections ("Version skew", "Targeting", a new "Runtime / Node.js" section, `info` fields). The section becomes a short note that the index has none and each part keeps its own list — no consolidated copy (it would drift).
- **New "Exit codes" section** in the index lists the two new codes by meaning only ("version skew refused", "target unavailable"); numbers/names are defined in `command-surface.md`.
- Each new index section links to the parts it affects.

## Benefits

- The index becomes a complete, unambiguous source of truth for cross-cutting CLI behaviour before implementation starts.
- The CLI and the skills stay consistent (same tier pointers, same `CLAUDE_CONFIG_DIR` resolution), so they never write to different places.
- Safe defaults: no write into an unconfigured repo, no directory creation for a mistyped account, no silent write over a newer config shape.
- Sibling spec issues receive their hand-offs up front, avoiding conflicting decisions.

## Still to cover during implementation

Backward compatibility, testing strategy and performance & security considerations for the index file, consistent with the decisions above (e.g. testing: temp-dir fake `CLAUDE_CONFIG_DIR`s/repos, Node 22.13 CI job; security: no directory creation for unknown accounts, no write into unconfigured repos, no `~` expansion of the env var).
