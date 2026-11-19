## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
|------|----------|
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Architecture](docs/agents/architecture.md) | Source layout, modules, code style, and implementation guidelines. |
| [Flow](docs/agents/flow.md) | Main runtime flow of the application. |
| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |
| [Issues](docs/agents/issues/) | Detailed specs for open issues. |
| [Specs](docs/agents/specs.md) | Index of every spec in `docs/agents/specs/`: forward-looking designs that guide future work, not yet implemented. |

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

### Specs (`docs/agents/specs/`)

Forward-looking designs that guide future work but are not implemented yet. Unlike issues and plans, a spec is not tied to one issue: it records the agreed direction, prerequisites, and open points for a later change. Naming convention (kebab-case topic):

```text
docs/agents/specs/<topic>.md
```

Example: `docs/agents/specs/user-authentication.md`.

A large spec may be split into an index file plus parts, in a folder named after the topic:

```text
docs/agents/specs/<topic>.md          # index: status, goal, decisions, links to each part
docs/agents/specs/<topic>/<part>.md   # one file per part
```

Every spec is listed in [`docs/agents/specs.md`](docs/agents/specs.md), the permanent specs index. Add an entry there when you create a spec, and remove it when the spec is removed.
