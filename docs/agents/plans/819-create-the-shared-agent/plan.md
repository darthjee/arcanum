# Plan: Create the shared agent

Issue: [819-create-the-shared-agent.md](../../issues/819-create-the-shared-agent.md)

## Overview

Add the `shared` specialist agent (`.claude/agents/shared.md`), which will own the root `shared/` lib introduced by epic #816. Update the other agent files and the roster docs to match. Ownership goes by folder: `shared` owns `shared/` and `node` owns `core/`, including the config surface for as long as it lives there. This issue changes documentation and agent files only.

## Context

- The design lives in [docs/agents/specs/shared-lib.md](../../specs/shared-lib.md), which has been merged (#818, PR #828). See its Ownership, Import boundary, Migration steps and Performance and security sections.
- `shared/` does not exist yet; it is created in #822. The surface is in `core/lib/utils/{config,file}/` today, moves to `core/lib/shared/` in #820, and to `shared/lib/` in #824.
- No change to the surface is planned during the move. Path references in agent files keep the current paths, each with a "moves to `shared/lib/` in #824" note; #820 and #824 update them as they move the files.

## Steps

- [01 — Write the shared agent file](plan/01-write-shared-agent.md)
- [02 — Update the other agent files](plan/02-update-agent-files.md)
- [03 — Update the roster docs](plan/03-update-roster-docs.md)
- [04 — Fix the spec's repointing note](plan/04-fix-spec-note.md)

## Notes

- Every file is owned by `architect`: the agent files, `AGENTS.md`, the roster doc, `folder-structure.md` and the spec. No specialist dispatch is needed.
- No CI job checks these files. There is no Markdown lint in `.circleci/`, so verify the links by reading them.
- Match the style of the existing agent files (`node.md`, `client.md`): headings `Your scope`, `Stack`, `Conventions`, `How to coordinate with the architect`.
- Do not rewrite the suspended `arcanum-cli` spec sections or the architecture docs (`lock-system.md`, `docker-engine.md`, `shared-state-and-configuration.md`); #826 does that.
