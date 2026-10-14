# Plan: Enhance spec: arcanum-cli.md (index/overview)

Issue: [769-enhance-spec-arcanum-cli-md-index-overview.md](../../issues/769-enhance-spec-arcanum-cli-md-index-overview.md)

## Overview

Docs-only update of `docs/agents/specs/arcanum-cli.md` (the CLI spec's index), owned by `architect`. It records the decisions taken while enhancing #769 — version skew, minimum Node.js version, `arcanum config info` fields, repo and account targeting edge cases, the `client` agent's role, and two new exit codes — resolves all four of the index's open points, and adds backward-compatibility, testing and security notes. The five part files under `docs/agents/specs/arcanum-cli/` are **not** edited: their sibling issues (#770–#774) run in parallel and already received hand-off comments.

## Context

- The index was written in #768. Its current open points: version-skew behaviour, minimum Node.js version, `info` fields, behaviour outside an arcanum-configured repo.
- Each tier has its own version pointer: repo `.version` in `.claude/configuration/arcanum-repo-config.json`; local `.migrations.version` in `.claude/state/arcanum-config.json`; global `.migrations.version` in `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` (see `docs/guides/arcanum-repo-version.md`).
- `core/package.json` declares `"engines": { "node": ">=22.13.0" }`.
- `core/lib/utils/config/ConfigChain.js` resolves `CLAUDE_CONFIG_DIR || $HOME/.claude` verbatim (no `~` expansion; empty counts as unset; `null` when neither is set).
- `core/lib/utils/file/RepoPath.js` only validates "directory + git repo"; it does not normalize to the root.
- The full decisions are in the issue's "Solution" section; this plan says where each lands in the spec.

## Steps

- [01 — Version skew, runtime and exit codes](plan/01-version-skew-runtime-exit-codes.md)
- [02 — Targeting and `config info`](plan/02-targeting-and-info.md)
- [03 — Ownership and the `client` agent](plan/03-ownership-and-client.md)
- [04 — Open points, cross-cutting concerns and cross-links](plan/04-open-points-and-cross-links.md)

## Notes

- Write in the spec's existing style: short sentences, bullet lists, tables where already used.
- Do not edit `docs/agents/specs/arcanum-cli/*.md`; where a decision needs detail in a part, the index says "detailed in [<Part>](arcanum-cli/<part>.md)" and leaves the detail to that part's issue.
- Exit codes are named by meaning only ("version skew refused", "target unavailable"); numbers and identifiers belong to `command-surface.md` (#770).
- The `client` persona email for `git.agents` is left to #775 (reuse an existing persona alias); do not name one in the spec.
- No CI job covers `docs/`; verify by re-reading the rendered Markdown and checking every relative link resolves.
