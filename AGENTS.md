# Project Instructions

Arcanum — a collection of Claude Code skills (slash commands), reusable across projects.

## Stack

No programming language — the project is composed of markdown files.

## Conventions

- Each skill is a folder at the project root containing a `SKILL.md` as entrypoint (loaded when `/skill-name` is invoked) and optional auxiliary markdown files, referenced from `SKILL.md`.
- `SKILL.md` requires frontmatter with `name` and `description`.
- Paths referenced in instructions (e.g. "look for file X") must be relative, never absolute.
- When an absolute path is required (e.g. inside a script), it must be extracted into a variable instead of repeated inline.
- Whenever possible, extract skill logic into scripts (instead of natural-language instructions), to make behavior deterministic and reduce token consumption.
- For skills that need user confirmation/selection, prefer the single-script pattern driving the interaction via `/dev/tty` — see [Per-Repo Migrations](docs/agents/architecture/per-repo-migrations.md) and [Repo Path Threading](docs/agents/architecture/repo-path-threading.md).

## Agents

Specialist agents are defined in `.claude/agents/`. Each has a specific scope within the repository.

| Agent | Scope |
|-------|-------|
| `architect` | Project documentation, root-level files, and decisions that span more than one agent. Coordinates the other specialists. |
| `scripter` | `<skill-name>/scripts/` and `arcanum/_lib/` — bash scripts that extract deterministic logic out of skills. |
| `skill-writer` | `SKILL.md` and auxiliary `steps/*.md` files of any skill — writes or edits skill files. |
| `skill-reviewer` | Reviews skill files (SKILL.md and step `.md` files) modified in a PR and flags any complex inline bash that should be extracted to a script. Reports violations to the architect; does not fix them. |

## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
|------|----------|
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Architecture](docs/agents/architecture.md) | Hub linking to `docs/agents/architecture/` — arcanum's internals by topic (source layout, agents, repo path threading, config, migrations, etc.). |
| [Flow](docs/agents/flow.md) | Main runtime flow of the application. |
| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |
| [Issues](docs/agents/issues/) | Detailed specs for open issues. |

### Issues (`docs/agents/issues/`)

Each file documents an issue in detail. Naming convention:

```
docs/agents/issues/<issue_id>_<issue_name>.md
```

Example: `docs/agents/issues/5_release_docker_image.md` for issue #5.

### Plans (`docs/agents/plans/`)

Each plan is a directory named after the issue ID and topic, containing one or more related files:

```
docs/agents/plans/<issue_id>_<topic>/<related_files>.md
```

Example: `docs/agents/plans/12_add-auth/plan.md` for issue #12.
