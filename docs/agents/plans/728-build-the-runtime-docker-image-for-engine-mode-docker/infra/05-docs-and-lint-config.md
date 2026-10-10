# Record decisions in the spec and lint config

- `docs/agents/specs/docker/image.md`: replace the "#728 decides / picks one / makes the final choice" wording with the settled choices (nss_wrapper with the `/usr/local/lib/libnss_wrapper.so` path; gh release tarball + per-arch SHA-256; tag-only base pin; credential helper stays in dispatch env). Point publishing at #737 instead of "#728 or a new sub-issue".
- `docs/agents/specs/docker.md`: sub-issue map — #728 row drops "(plus the release-CI multi-arch publishing job…)", add a #737 row (infra, depends on #728, Open); "Image publishing" open point now references #737.
- `.codacy.yml`: the `opengrep` exclusion for `core/Dockerfile` stays (the `test` stage still has no `USER`); update its comment to say it covers the `test` stage only and that the `runtime` stage sets `USER 1000:1000`.
- `.claude/agents/infra.md`: update the "Conventions" bullet about the test image to mention the multi-stage `base`/`test`/`runtime` layout and the runtime entrypoint.

## Files to Change
- `docs/agents/specs/docker/image.md` — record #728's decisions.
- `docs/agents/specs/docker.md` — sub-issue map and open points (#737).
- `.codacy.yml` — comment update for the opengrep exclusion.
- `.claude/agents/infra.md` — conventions reflect the multi-stage image.
