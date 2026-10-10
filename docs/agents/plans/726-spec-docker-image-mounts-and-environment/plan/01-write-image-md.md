# Write image.md

Replace the stub with the runtime image spec, recording the decisions from the issue as decided. Consult `infra` (owner of `core/Dockerfile`) on the stage layout and pins if anything is unclear.

Sections:

- **Strategy:** a multi-stage `core/Dockerfile`:
  - a shared `base` stage: `darthjee/node` plus pinned `jq`, `git`, `gh`, `openssh-client`;
  - a `test` target: identical behavior to today, still used by `core/docker-compose.yml` and the root `Makefile` `core-*` targets;
  - a `runtime` target: `COPY` `core/`, then `yarn install --production --frozen-lockfile`.
  - Say why this was chosen over a separate Dockerfile (one set of pins) and over reusing the test image (a slow start, and a root `chown` against a user's repo).
- **Runtime user and entrypoint:** runs as the host `--user uid:gid`, with no root phase, no `chown`, no `su`. `core/docker-entrypoint.sh` stays test-only. Cover what an arbitrary uid with no `/etc/passwd` entry needs:
  - a writable `HOME` (for example `HOME=/tmp/arcanum-home`, or a tmpfs);
  - nothing that depends on `whoami`/`getent`;
  - git's `safe.directory` (the repo is owned by the host uid, which is now the container uid, so it is fine; state why).
  - The entrypoint executes `core/bin/arcanum` directly.
- **Version pins:** pin the base image tag and apt packages, following the existing `jq` pin convention and its "how to refresh" comment. Make sure the `gh` source is pinned too (apt repo vs. release tarball). Leave the final choice to #728.
- **Distribution and versioning:**
  - Release CI publishes `darthjee/arcanum:<arcanum version>` as a multi-arch image (amd64 + arm64, via buildx).
  - Dispatch uses the tag that matches the installed arcanum version (where it reads that version from, for example `arcanum.json` or the install's version file).
  - If the pull fails, dispatch builds locally from the install's `core/` with `--target runtime`, under the same tag.
  - If both fail, that counts as "Docker unavailable" (the native fallback with a warning, see `docker.md`).
  - Old tags are never reused, and `/arcanum-update` naturally switches tags.
  - Note that the release-CI publishing job is follow-up work: part of #728, or a new sub-issue.
- **Platforms:** amd64 and arm64 manifests. On macOS Docker Desktop, note the VM and file-sharing overhead (link to the performance open point in #727). On Linux, note native speed.

## Files to Change

- `docs/agents/specs/docker/image.md` — replace the stub with the full spec above.
