# Verify on macOS and Linux, update docs

Since no CI job currently exercises `core/Dockerfile` (see [infra.md](../infra.md)'s Notes), verification here is manual:

1. Run `make core-test` and `make core-check` locally (macOS) and confirm `yarn install --frozen-lockfile && yarn test`/`yarn lint` still succeed with no permission errors, and confirm the effective user inside the running container is `node`, not `root` (e.g. `docker compose run --rm core whoami`).
2. Repeat on a Linux host (or a Linux VM/CI-equivalent), since the bind-mounted repo root's UID behavior differs from macOS/Docker Desktop — this is the scenario the entrypoint's chown step is meant to cover.
3. If either run surfaces a permission error the entrypoint doesn't already handle, widen its chown scope (step 01) rather than reintroducing a `USER root`/no-`ENTRYPOINT` fallback.
4. Re-read `docs/agents/architecture/script-engine.md`'s "The Docker test image" section and update it if the non-root switch changes any assumption documented there about the `engine.mode=docker` execution path (e.g. it currently doesn't mention user/permissions at all — a brief note that the image now drops to `node` via an entrypoint may be worth adding).

## Files to Change

- `docs/agents/architecture/script-engine.md` — add a brief note about the non-root entrypoint, only if the verification above surfaces something worth documenting beyond what's already said.
