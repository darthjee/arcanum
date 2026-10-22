# Development tooling for the core/ Node.js package. See
# docs/agents/architecture/script-engine.md and core/docker-compose.yml —
# these targets run core/'s suite inside the darthjee/node-based test
# image, with core/ bind-mounted rather than baked into the image.
#
# The cli-* targets do the same for the cli/ package (the `cli` compose
# service: same test image, whole repo mounted, cli/ as working dir).
# cli-test builds cli/dist/arcanum.mjs before running the specs, since
# `yarn test` does not build; cli-check runs lint then test.
#
# The shared-* targets do the same for the shared/ package (the `shared`
# compose service). shared/ has no build step, so shared-test only runs
# the specs (under c8); shared-check runs lint then test.
#
# mod-check gates the Claude Code mods shipped with arcanum (MOD_DIRS):
# for each, `claude plugin validate`, `tsc -p` and `claude plugin test`,
# run on the host (the Claude Code CLI must be on PATH), stopping at the
# first failure.

CORE_COMPOSE := docker compose -f core/docker-compose.yml
CLI_SERVICE := cli
SHARED_SERVICE := shared
YARN_INSTALL := yarn install --frozen-lockfile

# The engine.mode=docker runtime image (the `runtime` target of
# core/Dockerfile, built from the install root). See
# docs/agents/architecture/docker-engine.md#image. #729's docker-parity
# reuses core-build-runtime.
CORE_DOCKERFILE := core/Dockerfile
RUNTIME_IMAGE ?= darthjee/arcanum:local-test
RUNTIME_VERSION ?= $(shell tr -d '[:space:]' < arcanum.version 2>/dev/null)
RUNTIME_ROOT := /opt/arcanum
RUNTIME_ENV_SCRIPT := /usr/local/lib/arcanum-runtime-env.sh
# Dispatch-like flags: the host uid, read-only root, /tmp a tmpfs.
RUNTIME_RUN := docker run --rm --user "$$(id -u):$$(id -g)" --read-only --tmpfs /tmp
RUNTIME_SMOKE_COMMAND := arcanum-smoke-check

# Docker-engine parity specs and benchmark (#741), run on the host. See
# docs/agents/architecture/docker-engine.md#testing.
CORE_DIR := core
PARITY_IMAGE_VAR := ARCANUM_DOCKER_PARITY_IMAGE
BENCH_IMAGE_VAR := ARCANUM_BENCH_IMAGE
BENCH_SCRIPT := scripts/docker_benchmark.sh
BENCH_ARGS ?=

# Claude Code mods (#797), checked on the host by mod-check. tsc is the
# host's if installed, else a pinned TypeScript through npx. tsc -p needs
# the engine-generated .claude-plugin/types/ (never committed), which the
# engine writes when it loads the mod from its folder in a session.
MOD_DIRS := arcanum-next-step
CLAUDE ?= claude
TYPESCRIPT_VERSION := 5.9.3
TSC ?= $(shell command -v tsc 2>/dev/null || echo npx --yes -p typescript@$(TYPESCRIPT_VERSION) tsc)
MOD_TYPES_TSCONFIG := .claude-plugin/types/tsconfig.json

.PHONY: core-test core-lint core-check core-shell core-report core-audit \
	core-build-runtime core-smoke-runtime docker-parity docker-benchmark \
	mod-check cli-install cli-lint cli-build cli-test cli-check cli-shell \
	cli-audit shared-install shared-lint shared-test shared-check \
	shared-shell shared-audit

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

cli-install:
	$(CORE_COMPOSE) run --rm $(CLI_SERVICE) sh -c "$(YARN_INSTALL)"

cli-lint:
	$(CORE_COMPOSE) run --rm $(CLI_SERVICE) sh -c "$(YARN_INSTALL) && yarn lint"

cli-build:
	$(CORE_COMPOSE) run --rm $(CLI_SERVICE) sh -c "$(YARN_INSTALL) && yarn build"

cli-test:
	$(CORE_COMPOSE) run --rm $(CLI_SERVICE) sh -c "$(YARN_INSTALL) && yarn build && yarn test"

cli-check: cli-lint cli-test

cli-shell:
	$(CORE_COMPOSE) run --rm $(CLI_SERVICE) sh

cli-audit:
	$(CORE_COMPOSE) run --rm $(CLI_SERVICE) sh -c "$(YARN_INSTALL) && yarn audit"

shared-install:
	$(CORE_COMPOSE) run --rm $(SHARED_SERVICE) sh -c "$(YARN_INSTALL)"

shared-lint:
	$(CORE_COMPOSE) run --rm $(SHARED_SERVICE) sh -c "$(YARN_INSTALL) && yarn lint"

shared-test:
	$(CORE_COMPOSE) run --rm $(SHARED_SERVICE) sh -c "$(YARN_INSTALL) && yarn test"

shared-check: shared-lint shared-test

shared-shell:
	$(CORE_COMPOSE) run --rm $(SHARED_SERVICE) sh

shared-audit:
	$(CORE_COMPOSE) run --rm $(SHARED_SERVICE) sh -c "$(YARN_INSTALL) && yarn audit"

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

# Parity specs (core/spec/docker/, yarn test:docker): each case runs a
# command natively and inside the runtime image and compares the two.
# Local-only, not in CI (docs/agents/architecture/docker-engine.md#not-in-ci-and-why):
# it needs a real Docker daemon and the host's Docker CLI, so
# it runs node on the host rather than inside the `core` compose service.
# ARCANUM_DOCKER_PARITY_GH=1 / ARCANUM_DOCKER_PARITY_SSH=1 pass through
# from the caller's env to enable the opt-in credential cases.
docker-parity: core-build-runtime
	cd $(CORE_DIR) && yarn install --frozen-lockfile && $(PARITY_IMAGE_VAR)=$(RUNTIME_IMAGE) yarn test:docker

# Per-call docker-vs-native overhead through the real dispatch path.
# Local-only, like docker-parity. Pass script flags through BENCH_ARGS,
# e.g. `make docker-benchmark BENCH_ARGS=--cold` (restart Docker first)
# or `BENCH_ARGS="--runs 50"`.
docker-benchmark: core-build-runtime
	$(BENCH_IMAGE_VAR)=$(RUNTIME_IMAGE) $(BENCH_SCRIPT) $(BENCH_ARGS)

mod-check:
	@set -e; for dir in $(MOD_DIRS); do \
		echo "mod-check: $$dir: validate"; \
		$(CLAUDE) plugin validate "$$dir"; \
		echo "mod-check: $$dir: tsc"; \
		test -f "$$dir/$(MOD_TYPES_TSCONFIG)" || { echo "mod-check: $$dir/$(MOD_TYPES_TSCONFIG) is missing; start a Claude Code session with the mod loaded so the engine writes its types" >&2; exit 1; }; \
		$(TSC) -p "$$dir" --noEmit; \
		echo "mod-check: $$dir: test"; \
		$(CLAUDE) plugin test "$$dir"; \
	done
	@echo "mod-check: ok"
