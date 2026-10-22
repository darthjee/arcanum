# Infra Plan: Switch core and cli to shared/ and remove the core copy

Main plan: [plan.md](plan.md)

## Shared contracts

- After this PR, the runtime image's native config commands load the surface from `$ARCANUM_ROOT/shared/lib/`. That path ships through `COPY . $ARCANUM_ROOT`, and `.dockerignore` drops only `shared/spec/` and `shared/eslint.config.mjs`.

## Implementation Steps

### Step 1 — Add a native config command to the runtime smoke

Extend `core-smoke-runtime` in the root `Makefile` with a step, e.g. `@echo "smoke: native config command resolves shared/"`. It runs `arcanum-check-config git.authors` inside `$(RUNTIME_IMAGE)` with `$(RUNTIME_RUN)`, and asserts:

- exit code 0;
- the pretty-printed JSON output has `.key == "git.authors"`, checked with the image's `jq` as the existing version step does.

If the command needs a repo working directory, run it from a throwaway dir: `-w /tmp` with `git init` inside `sh -euc`, as the passwd step uses `--entrypoint sh`. Add a variable (e.g. `RUNTIME_CONFIG_SMOKE_KEY := git.authors`) next to `RUNTIME_SMOKE_COMMAND`.

Verify that the step fails against an image without `shared/`. For example, temporarily add `shared/` to `.dockerignore` locally, rebuild, see the step fail, then revert.

## Files to Change

- `Makefile`: the new `core-smoke-runtime` step and variable.

## CI Checks

- `make core-smoke-runtime` (CI: the job that runs the runtime smoke, in `.circleci/config.yml`)

## Notes

- `--read-only` with a `/tmp` tmpfs: `arcanum-check-config` only reads the config tiers, so a read-only root must be fine. If it tries to write local state, point `HOME` at `/tmp` in the run.
