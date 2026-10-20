# Update infra and node agent files

- `.claude/agents/infra.md`: add `.circleci/` to the `description` and to "Your scope" — the `test` and `release` workflows, including the upcoming `cli` test job, the Node 22.13 floor job for the `cli/` specs, the `publish-cli` job with `scripts/publish_cli_package.sh` and the `NPM_TOKEN` setup. Mention that Makefile `cli-*` targets are covered by the existing repo-wide Makefile scope, and that the Node.js side of `cli/` belongs to `client` (coordinate through `architect`, like `node`).
- `.claude/agents/node.md`: add the reciprocal cross-boundary rule to "Conventions" or "How to coordinate": `node` never edits `cli/` (owned by `client`); a change to a shared-surface file in `core/lib` keeps the CLI specs green in the same PR, with the `cli/` side planned for `client`.

## Files to Change
- `.claude/agents/infra.md` — add `.circleci/` ownership and `cli/` boundary.
- `.claude/agents/node.md` — add the `node` ↔ `client` boundary rule.
