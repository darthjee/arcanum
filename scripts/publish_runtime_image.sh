#!/usr/bin/env bash
# Publish the runtime target of core/Dockerfile to Docker Hub as one
# multi-arch manifest (linux/amd64 + linux/arm64), tagged with the release
# version. Run by the `publish-image` job of the CircleCI `release`
# workflow, after the release zip is uploaded. See
# docs/agents/specs/docker/image.md#distribution-and-versioning.
#
# Usage: publish_runtime_image.sh <tag>
#
# Expects, already set up by the caller:
#   - a docker login with push rights on the image repository;
#   - a buildx builder able to build every platform in PLATFORMS (QEMU
#     binfmt registered for the non-native one).
#
# Behavior:
#   1. Immutability guard: fail if <image>:<tag> already exists, even on a
#      workflow re-run. Published tags are never overwritten; a fix ships as
#      a new arcanum version.
#   2. Build the runtime target from the repo root (filtered by the root
#      .dockerignore) for every platform and push only the version tag (no
#      `latest`).
#   3. Verify the pushed manifest lists every platform.

set -euo pipefail

IMAGE_REPO="darthjee/arcanum"
PLATFORMS="linux/amd64,linux/arm64"
DOCKERFILE="core/Dockerfile"
TARGET="runtime"

TAG="${1:?Usage: $0 <tag>}"
IMAGE="${IMAGE_REPO}:${TAG}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "Checking that ${IMAGE} is not published yet..."
if docker buildx imagetools inspect "$IMAGE" > /dev/null 2>&1; then
  echo "${IMAGE} already exists; published tags are immutable" >&2
  exit 1
fi

echo "Building and pushing ${IMAGE} for ${PLATFORMS}..."
docker buildx build \
  -f "$DOCKERFILE" \
  --target "$TARGET" \
  --platform "$PLATFORMS" \
  --build-arg ARCANUM_VERSION="$TAG" \
  -t "$IMAGE" \
  --push \
  .

echo "Verifying the pushed manifest for ${IMAGE}..."
manifest="$(docker buildx imagetools inspect "$IMAGE")"
echo "$manifest"

IFS=',' read -r -a platform_list <<< "$PLATFORMS"
for platform in "${platform_list[@]}"; do
  if ! grep -qE "Platform:[[:space:]]+${platform}(/.*)?$" <<< "$manifest"; then
    echo "${IMAGE} manifest is missing platform ${platform}" >&2
    exit 1
  fi
done

echo "Published ${IMAGE} (${PLATFORMS})."
