# Plan: Create the client agent

Issue: [775-create-the-client-agent.md](../../issues/775-create-the-client-agent.md)

## Overview

Docs/config-only change that creates the `client` specialist agent owning the future root-level `cli/` folder, formally adds `.circleci/` to `infra`'s scope, records the reciprocal `node` ↔ `client` boundary, gives `client` a commit identity, and updates every roster. No `cli/` code is written. Every touched file (`.claude/agents/*.md`, `.claude/configuration/`, `AGENTS.md`, `docs/agents/**`) is `architect`-owned, so this plan has no specialist owner.

## Context

Part of epic #767. The spec (`docs/agents/specs/arcanum-cli.md`, "Ownership") defines `client`'s scope, boundaries and conventions as input for this issue, and says that once it lands `.claude/agents/client.md` is the source of truth for those conventions. All spec sub-issues (#768–#774) are closed; this must land before #779 (scaffold `cli/`). Decisions made during refinement: `client` reuses the `+frontend` alias; the spec's conventions list is trimmed here; `node.md` and `AGENTS.md` are updated too.

## Steps

- [01 — Create the client agent file](plan/01-create-client-agent.md)
- [02 — Update infra and node agent files](plan/02-update-infra-and-node.md)
- [03 — Add client commit identity](plan/03-add-commit-identity.md)
- [04 — Update rosters and folder structure](plan/04-update-rosters.md)
- [05 — Trim the CLI spec](plan/05-trim-cli-spec.md)

## CI Checks

- No CI job covers `.claude/` or `docs/` content directly. Keep the JSON valid (`python3 -m json.tool .claude/configuration/arcanum-repo-config.json`) and keep markdown consistent with `.markdownlint.json` (e.g. `npx markdownlint-cli2` on the changed `.md` files, if available).

## Notes

- `cli/` does not exist yet; the `folder-structure.md` row must say it is created by #779 so readers don't look for it.
- `.claude/agents/client.md`'s `description` matters: `list_agents.sh` and the planners match issues to agents by it, so it must name `cli/` and its main paths explicitly.
- `docs/agents/architecture/dispatch-permissions.md` mentions `infra` only as a historical example; it needs no change.
- Permanent architecture docs for the CLI are #785's job, not this issue's.
