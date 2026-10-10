# Development tooling for the core/ Node.js package. See
# docs/agents/architecture/script-engine.md and core/docker-compose.yml —
# these targets run core/'s suite inside the darthjee/node-based test
# image, with core/ bind-mounted rather than baked into the image.

CORE_COMPOSE := docker compose -f core/docker-compose.yml

# The engine.mode=docker runtime image (the `runtime` target of
# core/Dockerfile, built from the install root). See
# docs/agents/specs/docker/image.md. #729's docker-parity reuses
# core-build-runtime.
CORE_DOCKERFILE := core/Dockerfile
RUNTIME_IMAGE ?= darthjee/arcanum:local-test
RUNTIME_VERSION ?= $(shell tr -d '[:space:]' < arcanum.version 2>/dev/null)
RUNTIME_ROOT := /opt/arcanum
RUNTIME_ENV_SCRIPT := /usr/local/lib/arcanum-runtime-env.sh
# Dispatch-like flags: the host uid, read-only root, /tmp a tmpfs.
RUNTIME_RUN := docker run --rm --user "$$(id -u):$$(id -g)" --read-only --tmpfs /tmp
RUNTIME_SMOKE_COMMAND := arcanum-smoke-check

.PHONY: core-test core-lint core-check core-shell core-report core-audit \
	core-build-runtime core-smoke-runtime

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

core-build-runtime:
	@test -n "$(RUNTIME_VERSION)" || { echo "RUNTIME_VERSION is empty (no arcanum.version?); pass RUNTIME_VERSION=<version>" >&2; exit 1; }
	docker build -f $(CORE_DOCKERFILE) --target runtime --build-arg ARCANUM_VERSION=$(RUNTIME_VERSION) -t $(RUNTIME_IMAGE) .

# Runs the runtime image as the host uid with dispatch-like flags and
# checks: (1) the arcanum CLI starts through the real entrypoint (an
# unknown command is the side-effect-free probe: it must fail with the
# CLI's own error); (2) the entrypoint's nss_wrapper setup gives that uid
# a passwd entry that getent and ssh accept, and git/gh run; (3) the baked
# arcanum.json reports RUNTIME_VERSION.
core-smoke-runtime: core-build-runtime
	@echo "smoke: arcanum CLI starts as uid $$(id -u)"
	@out="$$($(RUNTIME_RUN) $(RUNTIME_IMAGE) $(RUNTIME_SMOKE_COMMAND) 2>&1)" && { echo "expected a non-zero exit, got: $$out" >&2; exit 1; }; \
		echo "$$out" | grep -qF "arcanum: unknown command '$(RUNTIME_SMOKE_COMMAND)'" \
		|| { echo "unexpected CLI output: $$out" >&2; exit 1; }
	@echo "smoke: passwd entry, ssh, git and gh"
	$(RUNTIME_RUN) --entrypoint sh $(RUNTIME_IMAGE) -euc '. $(RUNTIME_ENV_SCRIPT); getent passwd "$$(id -u)"; getent group "$$(id -g)"; ssh -T -G localhost >/dev/null; ssh -V; git --version; gh --version'
	@echo "smoke: arcanum.json version"
	@version="$$($(RUNTIME_RUN) --entrypoint jq $(RUNTIME_IMAGE) -r .version $(RUNTIME_ROOT)/arcanum.json)" \
		&& test "$$version" = "$(RUNTIME_VERSION)" \
		|| { echo "arcanum.json version '$$version' != '$(RUNTIME_VERSION)'" >&2; exit 1; }
	@echo "smoke: ok"
