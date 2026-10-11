# Node Plan: Docker engine: migrate local commands with path arguments or global config (batch 2)

Main plan: [plan.md](plan.md)

## Shared contracts

Assert the shim flags and resulting `docker run` mounts/env listed in [plan.md → Shared contracts](plan.md#shared-contracts). Path-arg mounts appear only when the path is outside the repo. Inside the repo, the run is repo-mount-only, the same as batch 1.

## Steps

- [01 — Generalize the docker routing assertion](node/01-generalize-routing-assertion.md)
- [02 — Docker routing callbacks for the batch-2 shims](node/02-docker-routing-callbacks.md)
- [03 — Docker parity cases](node/03-docker-parity-cases.md)

## CI Checks

- `core/`: `make core-test` / `npm test` and `npm run lint` in `core/` (the existing CI jobs for core).
- Docker parity: `make docker-parity`, run locally. Report the platform in the PR.

## Notes

- On macOS Docker Desktop, mounted paths must be inside shared directories. Put out-of-repo fixtures under the temp dir `tempDir.js` already uses (`os.tmpdir()`), as batch 1 did.
- If the stamp parity case shows a mismatch for a dev install between tags, do not hide it: report it to scripter so it goes into the checklist notes.
