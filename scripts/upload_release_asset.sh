#!/usr/bin/env bash
# Publish a release asset to a GitHub Release via raw REST calls (curl),
# mirroring the mechanism documented in release-zip.md (ported from Tent's
# CircleCI pipeline). Does NOT use the `gh` CLI on purpose: `gh` auto-detects
# GH_TOKEN/GITHUB_TOKEN in the environment and authenticates with it, which
# made the previous `gh auth login --with-token` step redundant and, when
# GH_TOKEN was set, an outright failure ("value of the GH_TOKEN environment
# variable is being used for authentication"). Raw curl calls sidestep that
# entirely and make every HTTP status explicit.
#
# Usage: upload_release_asset.sh <tag> <asset-path>
#
# Required env:
#   GH_TOKEN — GitHub token with `repo` scope (or a fine-grained PAT with
#              Contents: Read and write on the target repo).
#
# Behavior:
#   1. Find the release for <tag>; create it (with auto-generated notes) if
#      it doesn't exist yet.
#   2. Delete any pre-existing asset with the same filename (idempotency —
#      safe to re-run e.g. on a retried CI build).
#   3. Upload <asset-path> as a release asset.

set -euo pipefail

OWNER_REPO="darthjee/arcanum"
API="https://api.github.com/repos/${OWNER_REPO}"

TAG="${1:?Usage: $0 <tag> <asset-path>}"
ASSET_PATH="${2:?Usage: $0 <tag> <asset-path>}"
ASSET_NAME="$(basename "$ASSET_PATH")"

: "${GH_TOKEN:?GH_TOKEN env var is required}"

auth_curl() {
  curl -s -u "x-access-token:${GH_TOKEN}" -H "Accept: application/vnd.github+json" "$@"
}

echo "Looking up release for tag ${TAG}..."
response="$(auth_curl -w '\n%{http_code}' "${API}/releases/tags/${TAG}")"
http_code="$(echo "$response" | tail -n1)"
body="$(echo "$response" | sed '$d')"

if [[ "$http_code" == "404" ]]; then
  echo "No release for ${TAG} yet — creating it."
  body="$(auth_curl --fail -X POST \
    -d '{"tag_name":"'"${TAG}"'","name":"'"${TAG}"'","generate_release_notes":true}' \
    "${API}/releases")"
elif [[ "$http_code" != "200" ]]; then
  echo "Unexpected status ${http_code} looking up release ${TAG}:" >&2
  echo "$body" >&2
  exit 1
fi

RELEASE_ID="$(echo "$body" | jq -r '.id')"
UPLOAD_URL="$(echo "$body" | jq -r '.upload_url' | cut -d'{' -f1)"

echo "Release id: ${RELEASE_ID}"

echo "Checking for a pre-existing asset named ${ASSET_NAME}..."
EXISTING_ASSET_ID="$(auth_curl --fail "${API}/releases/${RELEASE_ID}/assets" \
  | jq -r --arg name "$ASSET_NAME" '.[] | select(.name == $name) | .id')"

if [[ -n "$EXISTING_ASSET_ID" ]]; then
  echo "Deleting pre-existing asset id ${EXISTING_ASSET_ID}."
  auth_curl --fail -X DELETE "${API}/releases/assets/${EXISTING_ASSET_ID}" > /dev/null
fi

echo "Uploading ${ASSET_PATH} as ${ASSET_NAME}..."
auth_curl --fail -X POST \
  -H "Content-Type: application/zip" \
  --data-binary @"${ASSET_PATH}" \
  "${UPLOAD_URL}?name=${ASSET_NAME}" > /dev/null

echo "Uploaded ${ASSET_NAME} to release ${TAG}."
