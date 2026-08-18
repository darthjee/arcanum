# Test image for the core/ Node.js package.
#
# See docs/agents/architecture/script-engine.md — this same image later
# doubles as the base for the `engine.mode=docker` execution path, not
# just this test-image use case.
#
# Source is intentionally NOT copied/baked in here: core/ is bind-mounted
# at runtime (see docker-compose.yml), so local edits are picked up
# without a rebuild. Dependency installation happens at container start,
# reusing the warm Yarn cache this base image already provides.
FROM darthjee/node:latest

WORKDIR /home/node/app

CMD ["sh", "-c", "yarn install --frozen-lockfile && yarn test"]
