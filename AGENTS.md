# Project Instructions

Arcanum — a collection of Claude Code skills (slash commands), reusable across projects.

## Stack

Markdown files drive every skill — there is no build step and no application runtime for the skills themselves. A Node.js `core/` package holds the ongoing shell→native migration. Skill entrypoint scripts (`<skill>/scripts/*.sh`, `arcanum/_lib/*.sh`) are migrating, per-entrypoint, from bash to native Node.js — see [Script Engine](docs/agents/architecture/script-engine.md) for the full design. `core/` exists as scaffolding today: Yarn, Jasmine, c8, jscpd (the duplication-detection tool), and ESLint. Every entrypoint still runs as shell until its native counterpart ships.

## Conventions

- Each skill is a folder at the project root containing a `SKILL.md` as entrypoint (loaded when `/skill-name` is invoked) and optional auxiliary markdown files, referenced from `SKILL.md`.
- `SKILL.md` requires frontmatter with `name` and `description`.
- Paths referenced in instructions (e.g. "look for file X") must be relative, never absolute. The one exception is substituting a resolved value like `REPO_PATH` as literal text into a spawned agent's prose instructions, since that agent has no shell variable of its own to resolve it (see [Repo Path Threading](docs/agents/architecture/repo-path-threading.md)).
- When an absolute path is required (e.g. inside a script), it must be extracted into a variable instead of repeated inline, with no exceptions — an inlined absolute path breaks silently once a script or its caller moves, with nothing to catch it.
- Whenever possible, extract skill logic into scripts (instead of natural-language instructions), to make behavior deterministic and reduce token consumption.
- For skills that need user confirmation/selection, prefer the single-script pattern driving the interaction via `/dev/tty` — see [Per-Repo Migrations](docs/agents/architecture/per-repo-migrations.md) and [Repo Path Threading](docs/agents/architecture/repo-path-threading.md).

## Agents

Specialist agents are defined in `.claude/agents/`. Each has a specific scope within the repository.

| Agent | Scope |
| --- | --- |
| `architect` | Project documentation, root-level files, and decisions that span more than one agent. Coordinates the other specialists. |
| `scripter` | `<skill-name>/scripts/` and `arcanum/_lib/` — bash scripts that extract deterministic logic out of skills. |
| `skill-writer` | `SKILL.md` and auxiliary `steps/*.md` files of any skill — writes or edits skill files. |
| `skill-reviewer` | Reviews skill files (SKILL.md and step `.md` files) modified in a PR and flags any complex inline bash that should be extracted to a script. Reports violations to the architect; does not fix them. |
| `node` | `core/`'s Node.js source/config (`core/lib/`, `core/spec/`, `core/bin/`, `core/package.json`, `core/eslint.config.mjs`) — the native counterpart of scripts migrating from bash. |
| `infra` | Docker, docker-compose, and Makefile files repo-wide — e.g. `core/Dockerfile`, `core/docker-compose.yml`, the root `Makefile`'s `core-*` targets. |

## Boundaries

Concrete off-limits actions for any agent working in this repo:

- **Never hand-edit an auto-generated file — if it needs to change, regenerate it instead.** `docs/agents/tag-mutations.md` and `docs/agents/architecture/entrypoint-migration-status.md` are marked with the literal header text `AUTO-GENERATED, DO NOT EDIT BY HAND`; regenerate them via their `scripts/generate_*.sh` instead.
- **Never embed deterministic logic in skill markdown, unless it is trivial enough that AI misinterpretation risk is negligible.** Otherwise extract it into `<skill>/scripts/*.sh` or `arcanum/_lib/` instead of prose relying on AI judgment (see [Script Preference](docs/agents/architecture/script-preference.md)'s guideline for judging that risk).
- **Never touch another specialist agent's owned scope directly.** Route cross-scope work through the `architect` agent instead of reaching into it directly — bypassing the owning specialist causes scope drift and uncoordinated edits (see [Agent Roster and Architect Delegation](docs/agents/architecture/agent-roster-and-delegation.md)).
- **Never run a bare git-mutating command (`git add`/`commit`/`checkout`/`merge`/`push`/`fetch`/`rm`/`branch`) trusting the ambient cwd.**
- **Never call a git-mutating command without scoping it explicitly to the resolved `REPO_PATH`.**
- **Never re-derive the repo path from `pwd` partway through a run.**
- **Never assume a `cd` anywhere downstream (including inside a spawned subagent) is safe — it could silently redirect mutations to the wrong repo** (see [Repo Path Threading](docs/agents/architecture/repo-path-threading.md)).
- **Never mutate shared JSON state (e.g. the `auto-fix-all` queue) with a direct write.**
- **Never skip the write/mutate/release lock sequence when mutating shared JSON state.**
- **Never risk concurrent-writer corruption of shared state — the lock sequence exists specifically to prevent it** (see [Lock System](docs/agents/architecture/lock-system.md)).
- **Never preapprove broad or ad hoc destructive commands.** The one exception is a narrow, fixed, low-risk script common to most specialist dispatches — those are candidates for a permission-grant allowlist entry. Agent-specific or ad hoc commands instead rely on the blocked-dispatch escalation path (see [Dispatch Permissions](docs/agents/architecture/dispatch-permissions.md)).

## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
| --- | --- |
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Architecture](docs/agents/architecture.md) | Hub linking to `docs/agents/architecture/` — arcanum's internals by topic: source layout and overview, agent roster and delegation, repo path threading, shared state and configuration, per-repo migrations, the script engine, script preference guidelines, dispatch permissions, the lock system, issue tags, branch bootstrap and merge conflicts, install and release, cross-skill references, and entrypoint migration status. |
| [Flow](docs/agents/flow.md) | Main runtime flow of the application. |
| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |
| [Issues](docs/agents/issues/) | Detailed specs for open issues. |

### Issues (`docs/agents/issues/`)

Each file documents an issue in detail. Naming convention:

```text
docs/agents/issues/<issue_id>_<issue_name>.md
```

Example: `docs/agents/issues/5_release_docker_image.md` for issue #5.

### Plans (`docs/agents/plans/`)

Each plan is a directory named after the issue ID and topic, containing one or more related files:

```
docs/agents/plans/<issue_id>_<topic>/<related_files>.md
```

Example: `docs/agents/plans/12_add-auth/plan.md` for issue #12.
