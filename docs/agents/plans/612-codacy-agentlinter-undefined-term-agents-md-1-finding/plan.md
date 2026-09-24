# Plan: Codacy: Agentlinter undefined-term — AGENTS.md (1 finding)

Issue: [612-codacy-agentlinter-undefined-term-agents-md-1-finding.md](../../issues/612-codacy-agentlinter-undefined-term-agents-md-1-finding.md)

## Overview

Rewrite one bullet in `AGENTS.md` so it no longer quotes the all-caps generated-file marker, which Agentlinter reads as an undefined acronym "AUTO". This is a doc-only change. The generator scripts, the files they generate and `.codacy.yml` stay unchanged.

## Context

`AGENTS.md:41` currently says the two generated docs "are marked with the literal header text `AUTO-GENERATED, DO NOT EDIT BY HAND`". The marker is already in a code span, yet Agentlinter (`Agentlinter_clarity_undefined-term`) still flags it, so a code span does not suppress the finding. The marker itself is written as an HTML comment by `scripts/generate_tags_table.sh` and `scripts/generate_entrypoint_migration_status.sh`. It must not change (option (a) agreed during issue refinement). We also rejected defining "AUTO" in a glossary (it is not an acronym) and adding a Codacy exclusion (`AGENTS.md` should stay linted).

## Implementation Steps

### Step 1 — Rephrase the auto-generated-file bullet in `AGENTS.md`

Replace the sentence at `AGENTS.md:41` with one that describes the header instead of quoting it. Keep the bold rule, the two file paths and the regeneration pointer. Suggested wording:

```markdown
- **Never hand-edit an auto-generated file — if it needs to change, regenerate it instead.** `docs/agents/tag-mutations.md` and `docs/agents/architecture/entrypoint-migration-status.md` start with an HTML comment header marking them as auto-generated and naming the script that refreshes them; regenerate them via their `scripts/generate_*.sh` instead.
```

Afterwards, run `grep -n "AUTO" AGENTS.md` and check that no other all-caps `AUTO…` token remains.

## Files to Change

- `AGENTS.md` — rephrase the auto-generated-file bullet (currently line 41) so it no longer spells out the all-caps marker.

## Notes

- This file is not covered by any CI job (`.circleci/config.yml` only lints `core/`). The fix can only be confirmed by Codacy's re-analysis on the PR, which should report zero `Agentlinter_clarity_undefined-term` findings in `AGENTS.md`.
- Keep the wording as simple as the surrounding bullets. Recent Codacy fixes to `AGENTS.md` (#605, #606) targeted sentence-complexity and compound-instruction patterns, and a longer sentence could introduce a new finding.
