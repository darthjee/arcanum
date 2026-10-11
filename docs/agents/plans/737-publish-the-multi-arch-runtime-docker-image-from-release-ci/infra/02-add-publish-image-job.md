# Add the publish-image release job
Add a `publish-image` job to `.circleci/config.yml` and wire it into the `release` workflow.

Job:
- Executor: a CircleCI `machine` image (e.g. `ubuntu-2204:current`), which ships Docker with buildx.
- Steps:
  1. `checkout`.
  2. Register QEMU for the non-native platform: `docker run --privileged --rm tonistiigi/binfmt --install arm64`. Then create and select a buildx builder that can build multi-platform: `docker buildx create --name arcanum --use`, then `docker buildx inspect --bootstrap`.
  3. Log in: `echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin`.
  4. Immutability guard: if `docker buildx imagetools inspect "darthjee/arcanum:$CIRCLE_TAG"` succeeds, print `darthjee/arcanum:$CIRCLE_TAG already exists; published tags are immutable` to stderr and `exit 1`.
  5. Build and push, from the repo root as the context (filtered by the root `.dockerignore`):
     `docker buildx build -f core/Dockerfile --target runtime --platform linux/amd64,linux/arm64 --build-arg ARCANUM_VERSION="$CIRCLE_TAG" -t "darthjee/arcanum:$CIRCLE_TAG" --push .`
  6. Verify that the pushed manifest lists both platforms: `docker buildx imagetools inspect "darthjee/arcanum:$CIRCLE_TAG"`.
- No `latest` or other moving tag.

Workflow (`release`):
```yaml
      - publish-image:
          requires: [build-and-release]
          filters:
            branches:
              ignore: /.*/
            tags:
              only: /^\d+\.\d+\.\d+$/
```
The tag filter must be repeated on the dependent job, or CircleCI won't run it for tag pushes.

Extend the header comment at the top of the file to document the `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` env vars (same style as the existing `GH_TOKEN` note), the Docker Hub repo, and the fail-on-existing-tag rule.

If the multi-step shell gets long, it may move into a `scripts/publish_runtime_image.sh` helper (next to `scripts/upload_release_asset.sh`) that takes the tag as its argument. Keep it plain bash with `set -euo pipefail`.

## Files to Change
- `.circleci/config.yml` — new `publish-image` job, `release` workflow entry, header comment
- `scripts/publish_runtime_image.sh` — optional helper holding the guard + build/push logic
