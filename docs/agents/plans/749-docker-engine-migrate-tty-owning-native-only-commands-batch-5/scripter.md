# Scripter Plan: Docker engine: migrate TTY-owning native-only commands (batch 5)

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce the two shim lines given in [plan.md](plan.md#shared-contracts): `--native-only --needs=global-config,gitconfig,gh HOME`, no `--path-arg`.
- Rely on node having already flipped both keys to `"docker"` in `arcanum/_lib/migration-status.json` (node step 01).
- Tick both checklist rows with `#749` only after node's parity step (node step 03) has landed, so its `notes` text matches what was actually covered.

## Implementation Steps

### Step 1 — Declare docker needs and fix the shim headers

In `arcanum-create-issue/scripts/start.sh` and `arcanum-create-issue/scripts/publish.sh`:

- Add `--needs=global-config,gitconfig,gh` to the `engine_dispatch` call (exact lines in the shared contracts).
- Rewrite the header comments:
  - Drop "(except engine.mode=docker, which errors out)" and the "or from engine_dispatch's docker error" wording.
  - Add a docker paragraph in the batch-4 style ("now that its status is docker, under engine.mode=docker it runs in the container with ..."). Say the container has no TTY, so any call that would prompt takes the exit-4 `FALLBACK=chat` path. For `start` that is when drafts exist and neither `--new` nor `--resume` is given; for `publish` it is when `--confirmed` / `--shipit-confirmed` is missing. Calls that pass those flags behave as they do natively.
  - Say why there is no `--path-arg`: drafts are inside the repo mount.
- Check the checklist rows' `mounts`/`env` columns against the shim. `CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN` come from the `global-config`/`gitconfig`/`gh` needs. Keep the rows unchanged unless the check finds a mismatch.

### Step 2 — Regenerate status docs and tick the checklist rows

- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` with the repo's generator (same as batch 4) after node's status flip.
- In `docs/agents/specs/docker/checklist.md`, tick ✅ both `arcanum-create-issue-*` rows with `#749`. Update their `notes`:
  - `start`: keep the TTY-owning note, and add that the parity cases cover the `--new`/`--resume`/fallback paths with the native side detached from any terminal.
  - `publish`: keep the TTY-owning note, and add that the GitHub-writing success path has no parity case because it would create a real issue. Parity covers invalid input, a missing draft and the no-TTY fallback.
- Update the batch status line in `docs/agents/specs/docker.md` to mention batch 5. If the TTY section of `docs/agents/specs/docker/dispatch.md` says "always" exit 4, add that this applies only to prompting calls.

## Files to Change

- `arcanum-create-issue/scripts/start.sh` — `--needs`, header rewrite.
- `arcanum-create-issue/scripts/publish.sh` — `--needs`, header rewrite.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated.
- `docs/agents/specs/docker/checklist.md` — tick both rows with `#749`, update notes.
- `docs/agents/specs/docker.md` — status mentions batch 5.
- `docs/agents/specs/docker/dispatch.md` — TTY wording, only if needed.

## CI Checks

- Shell lint and shellcheck over the touched shims, plus `arcanum/_lib/test_engine_dispatch.sh` (same commands as batch 4's scripter steps).

## Notes

- Do not touch `TtyPrompt` or the `/arcanum-create-issue` skill's chat fallback. Both are out of scope.
