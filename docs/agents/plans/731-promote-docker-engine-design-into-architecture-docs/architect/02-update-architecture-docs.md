# Update the other architecture docs

- `docs/agents/architecture/script-engine.md`: rewrite the docker wording as implemented. Line 9 describes `docker` as running "inside the Docker test image" ("the eventual runtime"); the runtime image is the `runtime` target now. Fix "The Docker test image" section's forward-looking sentences ("later doubles as…", "eventual runtime `docker run`"), and any remaining "not implemented"/"future" phrasing about docker. Keep the fallback rules, and link "The docker branch" to `docker-engine.md#dispatch`. Repoint every `../specs/docker/...` link per the mapping table. Replace the "See also" entry for the Docker Engine spec with `docker-engine.md`.
- `docs/agents/architecture/shared-state-and-configuration.md`: where `engine.mode` is `"docker"`, add a pointer to `docker-engine.md`. Also check whether the global config's read-only mount in the container (see Mounts → Global arcanum config) or the shared state/lock behaviour across host and container deserves a sentence here, linking to `docker-engine.md#shared-state-and-locks`.
- `docs/agents/architecture/entrypoint-migration-status.md`: do **not** hand-edit it. scripter changes the generator header and regenerates this file. Review the result.
- `docs/agents/architecture.md` (the architecture index): add `docker-engine.md` next to the other architecture docs, if the index lists them.

## Files to Change
- `docs/agents/architecture/script-engine.md` — docker path as implemented, repointed links.
- `docs/agents/architecture/shared-state-and-configuration.md` — `engine.mode=docker` pointer.
- `docs/agents/architecture.md` — list the new doc.
