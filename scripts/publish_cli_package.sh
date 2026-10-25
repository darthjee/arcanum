#!/usr/bin/env bash
# Publish the arcanum-cli npm package (cli/) to the npm registry, with the
# release version. Run by the `publish-cli` job of the CircleCI `release`
# workflow, after the release zip is uploaded. See
# docs/agents/architecture/install-and-release.md#job-and-script.
#
# Usage: publish_cli_package.sh <tag> [--dry-run]
#
# Authentication is npm trusted publishing only (CircleCI OIDC): the script
# mints a CircleCI OIDC token with the npm audience and hands it to npm as
# NPM_ID_TOKEN, which npm exchanges for a short-lived publish credential.
# No long-lived token is used; a real publish refuses to run when NPM_TOKEN
# or NODE_AUTH_TOKEN is set, so a stray token cannot silently bypass trusted
# publishing. npm does not attach provenance to CircleCI publishes. The
# package's trusted publisher must have been bootstrapped once by hand (see
# docs/agents/architecture/install-and-release.md#npm-trusted-publishing).
#
# Behavior (each step fails the script on error, except step 7):
#   0. Preflight: <tag> must be a bare X.Y.Z and node >= 22.14.0; unless
#      --dry-run, npm >= 11.5.1, no npm token in the environment and the
#      CircleCI `circleci` CLI present (to mint the OIDC token).
#   1. Version check: cli/package.json's version must equal <tag>.
#   2. Already published? (skipped on --dry-run) If arcanum-cli@<tag> is on
#      the registry, stop with success: npm versions are immutable, so a
#      re-run is a no-op.
#   3. yarn install --frozen-lockfile.
#   4. yarn lint, yarn build, yarn test.
#   5. Content check: the `npm pack --dry-run` file list must be exactly
#      README.md, bin/arcanum, dist/arcanum.mjs and package.json.
#   6. npm publish, with NPM_ID_TOKEN set to a CircleCI OIDC token whose
#      audience is npm:registry.npmjs.org (npm publish --dry-run with
#      --dry-run, no token). publishConfig pins access=public and tag=latest.
#   7. Verify: (skipped on --dry-run) poll the registry until
#      arcanum-cli@<tag> is visible, then print its dist.integrity. The
#      publish already succeeded, so a timeout (registry lag) only warns
#      and still exits with success.

set -euo pipefail

PACKAGE_NAME="arcanum-cli"
MIN_NODE_VERSION="22.14.0"
MIN_NPM_VERSION="11.5.1"
EXPECTED_FILES="README.md
bin/arcanum
dist/arcanum.mjs
package.json"
VERIFY_INTERVAL=5
VERIFY_TIMEOUT=300
BOOTSTRAP_DOC="docs/agents/architecture/install-and-release.md#npm-trusted-publishing"

usage() {
  echo "Usage: $0 <tag> [--dry-run]" >&2
  exit 1
}

TAG="${1:-}"
[[ -n "$TAG" ]] || usage
DRY_RUN=false
if [[ $# -ge 2 ]]; then
  [[ "$2" == "--dry-run" && $# -eq 2 ]] || usage
  DRY_RUN=true
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/cli"

# version_ge <a> <b>: true when version a >= version b (numeric X.Y.Z).
version_ge() {
  local a b i
  IFS='.' read -r -a a <<< "$1"
  IFS='.' read -r -a b <<< "$2"
  for i in 0 1 2; do
    if (( 10#${a[i]:-0} > 10#${b[i]:-0} )); then return 0; fi
    if (( 10#${a[i]:-0} < 10#${b[i]:-0} )); then return 1; fi
  done
  return 0
}

echo "Preflight checks for ${PACKAGE_NAME}@${TAG}..."
if [[ ! "$TAG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Tag '${TAG}' is not a bare X.Y.Z version; refusing to publish" >&2
  exit 1
fi

node_version="$(node -p 'process.versions.node')"
if ! version_ge "$node_version" "$MIN_NODE_VERSION"; then
  echo "node ${node_version} is too old; trusted publishing needs >= ${MIN_NODE_VERSION}" >&2
  exit 1
fi
if [[ "$DRY_RUN" == false ]]; then
  # The npm floor exists for trusted publishing, which a dry run never does
  # (so the dry run also works with the compose test image's npm 10).
  npm_version="$(npm --version)"
  if ! version_ge "$npm_version" "$MIN_NPM_VERSION"; then
    echo "npm ${npm_version} is too old; trusted publishing needs >= ${MIN_NPM_VERSION}" >&2
    exit 1
  fi
  if [[ -n "${NPM_TOKEN:-}" || -n "${NODE_AUTH_TOKEN:-}" ]]; then
    echo "NPM_TOKEN or NODE_AUTH_TOKEN is set; publishing is OIDC-only (trusted publishing), unset it" >&2
    exit 1
  fi
  if ! command -v circleci > /dev/null; then
    echo "No circleci CLI to mint the OIDC token; trusted publishing only works in a CircleCI job." >&2
    echo "See ${BOOTSTRAP_DOC} for the trusted-publisher bootstrap." >&2
    exit 1
  fi
fi

echo "Checking that cli/package.json's version matches ${TAG}..."
package_version="$(node -p "require('./package.json').version")"
if [[ "$package_version" != "$TAG" ]]; then
  echo "cli/package.json version ${package_version} does not match tag ${TAG}" >&2
  exit 1
fi

if [[ "$DRY_RUN" == false ]]; then
  echo "Checking whether ${PACKAGE_NAME}@${TAG} is already published..."
  published="$(npm view "${PACKAGE_NAME}@${TAG}" version 2> /dev/null || true)"
  if [[ "$published" == "$TAG" ]]; then
    echo "${PACKAGE_NAME}@${TAG} is already published; nothing to do."
    exit 0
  fi
fi

echo "Installing dependencies..."
yarn install --frozen-lockfile

echo "Linting, building and testing..."
yarn lint
yarn build
yarn test

echo "Checking the package contents..."
# --ignore-scripts: the bundle was just built above, and keeping prepack's
# output out of stdout keeps the JSON parseable.
pack_json="$(npm pack --dry-run --json --ignore-scripts)"
actual_files="$(node -e '
  let input = "";
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    const [pack] = JSON.parse(input);
    console.log(pack.files.map((file) => file.path).sort().join("\n"));
  });
' <<< "$pack_json")"
if [[ "$actual_files" != "$EXPECTED_FILES" ]]; then
  echo "Unexpected package contents." >&2
  echo "Expected:" >&2
  echo "$EXPECTED_FILES" >&2
  echo "Actual:" >&2
  echo "$actual_files" >&2
  exit 1
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry-run publishing ${PACKAGE_NAME}@${TAG}..."
  npm publish --dry-run
  echo "Dry run of ${PACKAGE_NAME}@${TAG} done."
  exit 0
fi

echo "Publishing ${PACKAGE_NAME}@${TAG}..."
# npm only uses an OIDC token passed as NPM_ID_TOKEN, with the npm audience
# (CircleCI's default CIRCLE_OIDC_TOKEN_V2 has the org ID as its audience).
NPM_ID_TOKEN="$(circleci run oidc get --claims '{"aud": "npm:registry.npmjs.org"}')"
export NPM_ID_TOKEN
npm publish

echo "Verifying ${PACKAGE_NAME}@${TAG} on the registry..."
elapsed=0
while true; do
  published="$(npm view "${PACKAGE_NAME}@${TAG}" version 2> /dev/null || true)"
  if [[ "$published" == "$TAG" ]]; then
    break
  fi
  if (( elapsed >= VERIFY_TIMEOUT )); then
    echo "Warning: ${PACKAGE_NAME}@${TAG} was published but is not visible after ${VERIFY_TIMEOUT}s (registry lag); check it later with: npm view ${PACKAGE_NAME}@${TAG} version" >&2
    exit 0
  fi
  sleep "$VERIFY_INTERVAL"
  elapsed=$(( elapsed + VERIFY_INTERVAL ))
done
integrity="$(npm view "${PACKAGE_NAME}@${TAG}" dist.integrity)"
echo "Published ${PACKAGE_NAME}@${TAG} (integrity ${integrity})."
