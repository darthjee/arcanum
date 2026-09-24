# Issue: Codacy: Agentlinter undefined-term — AGENTS.md (1 finding)

## Description

Codacy's Agentlinter (pattern `Agentlinter_clarity_undefined-term`, category Comprehensibility, severity **Info**) reports one finding in `AGENTS.md`: it reads the literal generated-file marker `AUTO-GENERATED, DO NOT EDIT BY HAND` as an undefined acronym "AUTO".

The flagged bullet is now at `AGENTS.md:41` (it was line 35 in the Codacy snapshot, taken at commit `dc6576c`):

```markdown
- **Never hand-edit an auto-generated file — if it needs to change, regenerate it instead.** `docs/agents/tag-mutations.md` and `docs/agents/architecture/entrypoint-migration-status.md` are marked with the literal header text `AUTO-GENERATED, DO NOT EDIT BY HAND`; regenerate them via their `scripts/generate_*.sh` instead.
```

## Problem

The marker is **already wrapped in a code span**, so Agentlinter does not skip inline code when it looks for undefined acronyms. Wrapping the text in a code span, the fix the original issue suggested first, would change nothing. The only uppercase token here is the marker itself, which `scripts/generate_tags_table.sh` and `scripts/generate_entrypoint_migration_status.sh` write as an HTML comment (`<!-- AUTO-GENERATED, DO NOT EDIT BY HAND. Run scripts/generate_*.sh to refresh. -->`) at the top of each generated file.

## Expected Behavior

- Codacy reports zero `Agentlinter_clarity_undefined-term` findings in `AGENTS.md`.
- Agents can still tell which files are generated and must not be hand-edited, and they still know how to regenerate them.
- The generator scripts and the marker they emit are unchanged. This is a doc-only change to `AGENTS.md`.

## Solution

Rephrase the `AGENTS.md:41` bullet so the all-caps marker is not spelled out. For example, say the two files "start with an HTML comment header marking them as auto-generated and naming the script that refreshes them", and keep the pointer to their `scripts/generate_*.sh`. Agents can still recognise the header by opening either file.

Do not use a glossary entry that defines "AUTO" as an acronym, because it is not one. Do not use a Codacy exclusion either, because `AGENTS.md` is the main agent-instruction file and should stay linted.
