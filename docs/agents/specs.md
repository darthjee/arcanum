# Specs

Index of every spec under [`docs/agents/specs/`](specs/). A spec is a forward-looking design that guides future work but is not implemented yet. Unlike issues and plans, it is not tied to one issue: it records the agreed direction, prerequisites, and open points for a later change.

- Every new spec gets an entry here, with its link, a one-line summary, and its status.
- A spec is a single file, `docs/agents/specs/<topic>.md`. A large spec may be split into an index file, `docs/agents/specs/<topic>.md`, plus parts under `docs/agents/specs/<topic>/*.md`. Only the index file is listed here.
- When a spec is fully implemented and removed, its entry is removed too. This index itself is permanent.

| Spec | Summary | Status |
| --- | --- | --- |
| [Shell Engine Removal](specs/shell-engine-removal.md) | Remove `engine.mode=shell` and every `*_shell.sh` implementation once every entrypoint has a native counterpart. | Proposed |
| [Docker Engine](specs/docker.md) | Implement `engine.mode=docker`: run arcanum's scripts inside a container instead of on the host. Split spec: index plus parts under `specs/docker/`. | In progress (epic #724) |
