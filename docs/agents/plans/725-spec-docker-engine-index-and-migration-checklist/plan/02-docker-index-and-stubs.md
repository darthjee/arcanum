# Docker spec index and stub parts

Write `docs/agents/specs/docker.md` in the style of `docs/agents/specs/shell-engine-removal.md`, with these sections (see the issue's "Index content"):

1. **Status**: In progress; links to epic #724 and `docker/checklist.md`.
2. **Goal**: `engine.mode=docker` runs arcanum's scripts inside a container instead of on the host.
3. **Decisions so far**:
   - Scope: no top-level `scripts/`, no shell-engine removal, no Claude Code in docker.
   - Fallback rules: an entrypoint that is not docker-ready falls back to native (then to shell if no native exists). Docker unavailable also falls back to native. Both fallbacks happen inside `engine_dispatch.sh` with a stderr warning, and stdout/exit code are unchanged.
   - The checklist is hand-maintained; each PR ticks its own rows.
4. **Security principles**:
   - Mount the minimum, read-only by default.
   - No tokens baked into the image or passed as CLI arguments; use env or mounted config only.
   - Run as the host uid, not root.
   - No `--privileged`, no Docker socket mount.
5. **Parts**: a table linking `docker/image.md`, `mounts.md`, `environment.md` (#726), `dispatch.md`, `testing.md` (#727) and `checklist.md` (#725), each with a one-line purpose. Add a note that non-dispatched scripts are decided in #733.
6. **Sub-issue map**: #725–#733 in dependency order (#725 → #726, #727 → #728 → #729 → #730 → #731 → #732; #733 alongside the spec phase), each with its owner and status.
7. **Open points**, each pointing to the part/issue that resolves it:
   - TTY handling
   - Performance: per-call `docker run` vs. a long-lived container + `docker exec`, with a rough target of < 1s overhead per call on Linux (#727)
   - The docker-readiness source of truth (#727)
   - Worktrees and same-path mounts, file ownership, credentials, platforms (#726)
   - Nested calls, exit-code passthrough, concurrency (#727)
   - Non-dispatched scripts (#733)
8. **Maintenance rule (drift)**: while #724 is open, any PR that adds or removes a script under `<skill>/scripts/` or `arcanum/_lib/` updates `docker/checklist.md`.
9. **See also**: `../architecture/script-engine.md`, `shell-engine-removal.md`, `../architecture/entrypoint-migration-status.md`, `../specs.md`.

Create five stub files, each with an `# <Title>` heading and one line: "To be written in #726." (image, mounts, environment) or "To be written in #727." (dispatch, testing). Each stub links back to `../docker.md`.

## Files to Change
- `docs/agents/specs/docker.md` — new docker spec index.
- `docs/agents/specs/docker/image.md` — stub (#726).
- `docs/agents/specs/docker/mounts.md` — stub (#726).
- `docs/agents/specs/docker/environment.md` — stub (#726).
- `docs/agents/specs/docker/dispatch.md` — stub (#727).
- `docs/agents/specs/docker/testing.md` — stub (#727).
