# Plan: Create-issue: spec

Issue: [688-create-issue-spec.md](../../issues/688-create-issue-spec.md)

## Overview

Write `docs/agents/specs/arcanum-create-issue.md`. It records every decision agreed for epic #687, and sub-issues #689–#692 are implemented from it. This change is documentation only: no code, skill, script or migration changes. The spec is removed later, in #693.

## Context

The issue file's **Solution** section already holds all decisions, made during `/enhance-issue` and `/discuss-issue`. The spec turns them into a durable design document, following the shape of the existing `docs/agents/specs/shell-engine-removal.md` (`# Spec: <Topic>`, then `## Status`, `## Goal`, and topic sections).

The work is in the `architect`'s scope (project documentation under `docs/agents/`). No specialist agent (`scripter`, `skill-writer`, `node`, `infra`) has work here.

## Implementation Steps

### Step 1 — Write the spec

Create `docs/agents/specs/arcanum-create-issue.md` with these sections, in this order:

1. `# Spec: arcanum-create-issue and the Epic label`
2. `## Status`: proposed and not implemented. Links epic #687 and states the removal in #693.
3. `## Goal`: the four goals from #687 (Epic label, migration, the `/arcanum-create-issue` skill, automation skips Epics), plus the Epic/split-issue fix.
4. `## Scope`: what is in scope and what is out, from the issue's "Scope boundaries".
5. One section per decision, each opening with an `Implemented in: #NNN` line:
   - `## Draft file` (#690, #691)
   - `## Skill flow and reuse of enhance-issue` (#691). Includes the step table and "no spawning; suggest Epic".
   - `## Native commands` (#690). `arcanum-create-issue-start` and `arcanum-create-issue-publish`: arguments, flags (`--new`, `--resume`, `--confirmed`, `--shipit-confirmed`), output keys (`STATUS`, `FILE`, `DRAFT`, `ID`, `URL`, `LABELS`, `EPIC`, `WARNING`, `ERROR`, `FALLBACK`) and exit codes (0/1/2/4). Registration in `core/lib/core/commands.js` with `context: 'repo'`; shims under `arcanum-create-issue/scripts/` using `engine_dispatch --native-only`; `IssueClient.createIssue` gains a labels argument.
   - `## Label rules` (#690, #691). Covers the `shipit` rewording in `docs/agents/architecture/issue-tags.md` and in the generator script behind `docs/agents/tag-mutations.md`, which is auto-generated and must never be hand-edited.
   - `## Epic as a pipeline tag and split-issue` (#689). Covers `Tags.js` / `tags.sh`, the effect on `LabelApplicator.js` / `spawn_issue_shell.sh`, and the parent keeping `Epic` (or getting it added) at the split's finish.
   - `## Automation skips Epics` (#692). The three-check table, and `has-label` with `has-shipit-label` kept as an alias.
   - `## Migration` (#689). Two entries in `arcanum/migrations/repos/next/` (`001` repo, `002` local), modeled on `0.17.2/001`.
   - `## Prompts` (#690, #691). The eight-row table, plus the **exact `AskUserQuestion` wording** for prompts 1 (resume or new), 5 (final confirmation) and 6 (`shipit`), each with its options and the flag the skill reruns with.
   - `## Edge cases` (#690). The ten-row table.
   - `## Testing` (#689–#692). The per-sub-issue table and the gates.
6. `## Open points`: anything still unresolved. For example: the exact neutral default color for labels created automatically; whether a draft's title or first line is shown in the resume list; and where the `has-label` alias lives in the native registry.

Write in English, in the style of `shell-engine-removal.md`: short sections, tables where the issue uses them, and relative links to the files it names.

### Step 2 — Cross-check and lint

- Check that every decision in the issue's Solution section appears in the spec, and that each section names its sub-issue.
- Check that every relative link resolves: architecture docs, `0.17.2/001.sh`, `Tags.js`, `LabelApplicator.js` and the others.
- Run markdownlint with the repo's `.markdownlint.json` (e.g. `npx markdownlint-cli docs/agents/specs/arcanum-create-issue.md`) and fix any findings.
- No index update is needed: `AGENTS.md` and `docs/agents/folder-structure.md` point to the `docs/agents/specs/` folder rather than listing individual specs.

## Files to Change

- `docs/agents/specs/arcanum-create-issue.md`: new spec (the only file created).

## Notes

- Do not edit `docs/agents/tag-mutations.md` or any other auto-generated file. The spec only describes the change to the generator, which happens in #689 or #691.
- Do not touch code, skills or migrations. That work belongs to #689–#692.
- The spec is temporary: #693 removes it and moves the rules that still apply into `docs/agents/architecture/`.
