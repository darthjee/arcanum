# Setup Documentation Structure

Create the standard `docs/agents/` directory structure and register it in `AGENTS.md`.

## Step 1 — Create the directory structure

Create the following files and directories:

- `docs/agents/issues/.gitkeep`
- `docs/agents/plans/.gitkeep`
- `docs/agents/architecture.md` with content:

```markdown
# Architecture

## Overview

_Describe the high-level architecture of the project here._

## Source Code Layout

_Describe the directory structure and the role of each module._
```

- `docs/agents/flow.md` with content:

```markdown
# Flow

## Overview

_Describe the main runtime flow of the application here._
```

## Step 2 — Update AGENTS.md

Append the following section to `AGENTS.md` if it does not already contain a `## Documentation` section:

```markdown
## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
|------|----------|
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Architecture](docs/agents/architecture.md) | Source layout, modules, code style, and implementation guidelines. |
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
```

## Step 3 — Confirm

Tell the user:

```
Documentation structure created under docs/agents/:
- docs/agents/folder-structure.md
- docs/agents/architecture.md
- docs/agents/flow.md
- docs/agents/issues/   (ready for issue files)
- docs/agents/plans/    (ready for plan files)

AGENTS.md updated with the Documentation section.
Fill in architecture.md and flow.md with your project details.
```
