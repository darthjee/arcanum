# Write docker-engine.md

Create `docs/agents/architecture/docker-engine.md`, the permanent design of `engine.mode=docker`, condensed from `docs/agents/specs/docker.md` and `docs/agents/specs/docker/{image,mounts,environment,dispatch,testing}.md`.

Layout:

1. Intro: what `engine.mode=docker` does (scripts run in a per-call container, and each command keeps its stdout/exit-code contract), plus a link back to [Script Engine](script-engine.md).
2. **Security principles**, copied from the spec index: minimal read-only mounts, no baked tokens, host uid, no `--privileged` or Docker socket.
3. **Fallback rules**: not docker-ready, Docker unavailable, and 125–127 from `docker run` all mean native on the host with a warning; a native crash fails loud.
4. `## Image`, `## Mounts`, `## Environment`, `## Dispatch`, `## Testing`. Each takes the lasting `##` sections of its spec part as `###` subsections with **unchanged heading text** (see the anchor list in plan.md).

Drop rollout-only material: the sub-issue map, the status section, "Open points" (fold each resolved decision into its section), "Other readers #729 updates", "Migration of existing values" (keep only the final enum meaning), "The checklist stays hand-maintained", "Deriving the checklist `mounts`/`env` column", and "Ticking a checklist row" (replace with a short rule: a command becomes docker-ready by adding its `--needs`/`--path-arg` declarations, a shim-level docker routing case and a parity case, and flipping it to `"docker"` in `migration-status.json`). Rewrite future-tense wording ("#729 decides…") as the decision that was taken, citing the issue where it helps.

Mention `make docker-parity`, `make docker-benchmark`, `make core-build-runtime` and `make core-smoke-runtime` where they belong, and keep the benchmark threshold for revisiting `docker exec`.

## Files to Change
- `docs/agents/architecture/docker-engine.md` — new file.
