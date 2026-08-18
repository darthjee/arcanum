# Development tooling for the core/ Node.js package. See
# docs/agents/architecture/script-engine.md and core/docker-compose.yml —
# these targets run core/'s suite inside the darthjee/node-based test
# image, with core/ bind-mounted rather than baked into the image.

CORE_COMPOSE := docker compose -f core/docker-compose.yml

.PHONY: core-test core-lint core-check core-shell core-report core-audit

core-test:
	$(CORE_COMPOSE) run --rm core sh -c "yarn install --frozen-lockfile && yarn test"

core-lint:
	$(CORE_COMPOSE) run --rm core sh -c "yarn install --frozen-lockfile && yarn lint"

core-check: core-lint core-test

core-shell:
	$(CORE_COMPOSE) run --rm core sh

core-report:
	$(CORE_COMPOSE) run --rm core sh -c "yarn install --frozen-lockfile && yarn duplication"

core-audit:
	$(CORE_COMPOSE) run --rm core sh -c "yarn install --frozen-lockfile && yarn audit"
