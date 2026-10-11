# Add docker parity cases for the batch-4 commands

Add `core/spec/docker/` parity cases for the batch-4 commands. Where you can, use a credential-free remote that the container can reach through the existing mounts (e.g. a bare repo placed inside the mounted fixture tree as a `file://` origin), so fetch/push behavior is compared in every `make docker-parity` run. Cover the real ssh/https transport with opt-in cases gated by `itWithSsh` (`ARCANUM_DOCKER_PARITY_SSH=1`) and, for the `gh` rows, the existing `ARCANUM_DOCKER_PARITY_GH*` sandbox. Document any new env vars or fixture conventions in `docs/agents/specs/docker/testing.md`. Commands that can't have a safe case (irreversible remote side effects) get none: report them so the scripter adds a checklist `notes` entry.

## Files to Change

- `core/spec/docker/*_spec.js`: new or extended specs for the batch-4 commands
- `core/spec/support/factories/dockerParitySetup.js` / `core/spec/support/utils/dockerParity.js`: remote fixture helpers, if needed
- `docs/agents/specs/docker/testing.md`: document new parity conventions
