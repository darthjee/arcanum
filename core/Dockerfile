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
FROM darthjee/node:0.2.1

# jq is a genuine runtime dependency of the shell scripts under
# arcanum/_lib/ and auto-fix-all/scripts/ (e.g. repo_config.sh) that
# native-invocation/parity specs shell out to, and that the
# engine.mode=docker execution path shells out to as well — not just a
# test-only tool. darthjee/node doesn't include it, so install it here.
RUN apt-get update && apt-get install -y --no-install-recommends jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/node/app

# Starts as root to fix ownership of mount points the non-root `node`
# user needs to write to, then drops privileges to `node` before
# running CMD — see core/docker-entrypoint.sh for details.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "yarn install --frozen-lockfile && yarn test"]
