# Makefile dry-run target
- **The target.** Add `cli-publish-dry-run` next to the other `cli-*` targets in the root `Makefile`, and add it to `.PHONY`. It runs `$(CORE_COMPOSE) run --rm $(CLI_SERVICE) sh -c "../scripts/publish_cli_package.sh $(VERSION) --dry-run"`.
  - `VERSION` defaults to the version in `cli/package.json`, e.g. `VERSION ?= $(shell node -p "require('./cli/package.json').version" 2>/dev/null)`. If it is empty, fall back to a `jq`/`sed` read so the target works without a host `node`.
- **The header comment.** Extend the Makefile header's `cli-*` paragraph with one line about this target.
- **The image floor.** Make sure the compose test image meets the dry run's npm floor. If its npm is older than 11.5.1, either:
  - let the preflight's version check apply only to real publishes (the dry run does not need OIDC); or
  - bump npm in `core/Dockerfile`'s test target to an exact version.

  Prefer the first: the floor exists for trusted publishing, which a dry run never does. Step 01's preflight should then skip the npm floor on `--dry-run`, and its test cases should reflect that.

## Files to Change
- `Makefile` — the `cli-publish-dry-run` target, `.PHONY` and the header comment.
- `scripts/publish_cli_package.sh`, `scripts/test_publish_cli_package.sh` — only if the npm floor moves to real publishes only, as above.
