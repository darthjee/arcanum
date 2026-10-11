# Update the docker spec
Bring the spec in line with what ships:
- `docs/agents/specs/docker/image.md`, "Distribution and versioning" → **Publishing**: the job is `publish-image` in the `release` workflow. It runs after `build-and-release` (the zip upload), logs in with `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`, pushes only the version tag (no `latest`), and fails if the tag already exists, including on re-runs.
- `docs/agents/specs/docker/image.md`, "Platforms": drop the "`darthjee/node:0.2.1` is published for `linux/amd64` only…" caveat and name the new multi-arch base tag.
- `docs/agents/specs/docker.md`: in the "Image publishing" note (line ~85), drop "It needs an arm64 `darthjee/node` base first" (or point to darthjee/docker#148 as resolved). Mark #737 done in the sub-issue map row when the PR lands.
- `docs/agents/architecture/install-and-release.md`: one sentence saying release CI also publishes the runtime image after the zip.

## Files to Change
- `docs/agents/specs/docker/image.md` — publishing details, platforms caveat removed
- `docs/agents/specs/docker.md` — image-publishing note and sub-issue map
- `docs/agents/architecture/install-and-release.md` — mention the image publish step
