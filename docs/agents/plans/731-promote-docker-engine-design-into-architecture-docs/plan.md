# Plan: Promote docker engine design into architecture docs

Issue: [731-promote-docker-engine-design-into-architecture-docs.md](../../issues/731-promote-docker-engine-design-into-architecture-docs.md)

## Overview

Move the lasting docker engine design out of the temporary spec (`docs/agents/specs/docker.md` plus `docs/agents/specs/docker/*.md`) into one new architecture doc, `docs/agents/architecture/docker-engine.md`. Then repoint every reference to `docs/agents/specs/docker*` outside `docs/agents/{specs,issues,plans}/` at it, and remove the temporary checklist drift rule from the scripter and skill-reviewer agents. The architect writes the doc first, because the other agents' edits point at its section anchors. The spec files themselves stay; #732 deletes them.

Gate: start only once every dispatched and native-only row of `docs/agents/specs/docker/checklist.md` is ✅ or `n/a` (batches #745–#749). Whether #733's not-dispatched rows are part of the gate is decided in #751.

## Agents involved

- [architect](architect.md): the new architecture doc, the other architecture docs, `specs.md`, `AGENTS.md`, `.claude/agents/scripter.md` and `.claude/agents/skill-reviewer.md`.
- [scripter](scripter.md): comments in `arcanum/_lib/` and skill shims, `scripts/generate_entrypoint_migration_status.sh` and `scripts/docker_benchmark.sh`.
- [infra](infra.md): `core/docker-runtime-*.sh` comments and `.claude/agents/infra.md`.
- [node](node.md): comments in `core/bin/arcanum` and `core/spec/**`.

## Shared contracts

### Target doc and anchor mapping

The only new file is `docs/agents/architecture/docker-engine.md`. Its top-level sections are exactly `## Image`, `## Mounts`, `## Environment`, `## Dispatch` and `## Testing`. Each spec part's lasting `##` headings become `###` subsections under the matching section, **with the same heading text**, so the GitHub anchors keep their slugs. Every reference therefore maps mechanically:

| Old reference | New reference |
| --- | --- |
| `docs/agents/specs/docker.md` | `docs/agents/architecture/docker-engine.md` |
| `docs/agents/specs/docker/image.md` | `docs/agents/architecture/docker-engine.md#image` |
| `docs/agents/specs/docker/mounts.md` | `docs/agents/architecture/docker-engine.md#mounts` |
| `docs/agents/specs/docker/environment.md` | `docs/agents/architecture/docker-engine.md#environment` |
| `docs/agents/specs/docker/dispatch.md` | `docs/agents/architecture/docker-engine.md#dispatch` |
| `docs/agents/specs/docker/testing.md` | `docs/agents/architecture/docker-engine.md#testing` |
| `docs/agents/specs/docker/<part>.md#<anchor>` | `docs/agents/architecture/docker-engine.md#<anchor>` (same anchor) |
| `docs/agents/specs/docker/checklist.md` | no replacement: remove the reference, or point at `docs/agents/architecture/entrypoint-migration-status.md` where the text is about which commands are docker-ready |

Anchors that must exist (the ones referenced today): `runtime-user-and-entrypoint`, `docker-readiness-source-of-truth`, `resolution-order`, `native-only-commands`, `per-command-declarations`, `per-call-docker-run-and-when-to-revisit-it`, `docker-availability-check`, `exit-codes-and-streams`, `git-remote-access`, `fixed-env`, `container-infrastructure-env`, `parity-specs-local-only`, `tty`, `concurrency`. If the architect must rename one, they update this table before the other agents start.

### Done check

After all agents finish, this prints nothing:

```bash
grep -rn "specs/docker" . --exclude-dir=.git --exclude-dir=node_modules \
  | grep -v "^./docs/agents/\(specs\|issues\|plans\)/"
```

The batch PRs land before this issue and may add new references, so each agent re-runs the grep over its own scope at implementation time rather than trusting the file lists below.
