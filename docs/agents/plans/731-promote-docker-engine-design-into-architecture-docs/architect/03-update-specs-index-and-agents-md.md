# Update specs.md, AGENTS.md and shell-engine-removal.md

- `docs/agents/specs.md`: the Docker Engine row keeps its spec link (the file still exists until #732), sets status to **Implemented — pending removal (#732)**, and adds "Design: [Docker Engine](architecture/docker-engine.md)" to the summary.
- `AGENTS.md:101`: replace ``Example: `docs/agents/specs/docker.md` with its parts under `docs/agents/specs/docker/`.`` with a generic placeholder, e.g. ``Example: `docs/agents/specs/<topic>.md` with its parts under `docs/agents/specs/<topic>/`.``, or drop the line if the code block above it already says the same.
- `docs/agents/specs/shell-engine-removal.md`: the prerequisite at line 16 ("`engine.mode=docker` is actually implemented… Today it prints a warning and falls back to shell") becomes met: state that it is implemented, and link [Docker Engine](../architecture/docker-engine.md). Point the "See also" entry at the architecture doc too.

## Files to Change
- `docs/agents/specs.md` — docker row status and design link.
- `AGENTS.md` — generic split-spec example.
- `docs/agents/specs/shell-engine-removal.md` — docker prerequisite met, links repointed.
