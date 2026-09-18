# Plan: Codacy: AGENTS.md clarity issues — complex sentences, undefined acronyms, compound instructions (8 findings)

Issue: [501-codacy-agents-md-clarity-issues-complex-sentences-undefined-acronyms-compound-instructions-8-findings.md](../issues/501-codacy-agents-md-clarity-issues-complex-sentences-undefined-acronyms-compound-instructions-8-findings.md)

## Overview

Codacy's Agentlinter tool flags 8 clarity findings in `AGENTS.md`: three overly-long sentences, two undefined acronyms, two compound-instruction bullets, and one vague instruction. All 8 are fixed with prose-only edits to `AGENTS.md` — no meaning changes, no other file touched.

## Context

- Lines 7, 13, 40: sentences flagged as overly complex (68, 50, and 41 words respectively) — break each into shorter, single-idea sentences without changing what they say.
- Line 7: "JSCPD" is used without expansion — it refers to `jscpd`, the duplication-detection tool already listed alongside Jasmine/c8 in the `Stack` section's toolchain list.
- Line 35: "AUTO" is flagged as an undefined acronym, picked up from the quoted marker `AUTO-GENERATED, DO NOT EDIT BY HAND`. That marker is a literal string copied verbatim from real generated files (`docs/agents/tag-mutations.md`, `docs/agents/architecture/entrypoint-migration-status.md`) and their generator scripts (`scripts/generate_tags_table.sh`, `scripts/generate_entrypoint_migration_status.sh`) — confirmed by grep, it is not an acronym to define, just prose that reads like one out of context. Fix by rewording the surrounding sentence so it's clear this is a literal marker, not an undefined term. **Do not alter the quoted marker text itself** — it must keep matching the real files/scripts exactly.
- Lines 38–39 (the `Boundaries` list): each bullet currently bundles multiple actions (4 on line 38, 3 on line 39) into one sentence. Split each into one bullet per action, keeping the existing bold lead-in style and cross-reference links.
- Line 49 (the `Documentation` table's Architecture row): "arcanum's internals by topic (source layout, agents, repo path threading, config, migrations, etc.)" ends in a vague "etc." — replace with an explicit, complete topic list (drop "etc." once the list is exhaustive, or name what else it covers).
- No CI job runs Codacy/Agentlinter locally (checked `.circleci/config.yml` — its `Lint` job runs `yarn lint`, scoped to `core/`'s JS, not root markdown), so there is no local command to verify these findings clear; correctness is judged by re-reading the edited bullets against each flagged message.

## Implementation Steps

### Step 1 — Fix sentence complexity and undefined-acronym findings (lines 7, 13, 35, 40)
- Rewrite the line 7 sentence (Stack section) into shorter sentences, and expand "JSCPD" to "jscpd" (matching the existing lowercase tool name already used elsewhere) with a brief parenthetical noting it's the duplication-detection tool.
- Rewrite the line 13 sentence (Conventions — path handling) into shorter sentences, preserving the `REPO_PATH` exception it describes.
- Rewrite the line 35 bullet (Boundaries — auto-generated files) so the surrounding prose doesn't read the quoted `AUTO-GENERATED, DO NOT EDIT BY HAND` marker as an undefined acronym, without changing the marker text itself.
- Rewrite the line 40 bullet (Boundaries — permission preapproval) into shorter sentences, preserving the "unless it's a narrow, fixed, low-risk script" exception.

### Step 2 — Split compound bullets and remove vague instruction (lines 38–39, 49)
- Split the line 38 Boundaries bullet (bare git-mutating commands) into one bullet per action, keeping the bold lead-in convention (`**Never ...**`) and the existing link to `docs/agents/architecture/repo-path-threading.md`.
- Split the line 39 Boundaries bullet (shared JSON state mutation) into one bullet per action, keeping the bold lead-in convention and the existing link to `docs/agents/architecture/lock-system.md`.
- Replace the vague "etc." in the line 49 Documentation table's Architecture row with an explicit, complete list of the topics `docs/agents/architecture/` covers.

## Files to Change
- `AGENTS.md` — apply all 8 clarity fixes described above (sentence splits, acronym clarifications, bullet splits, vague-term removal); no behavioral/policy content changes, wording only.

## Notes
- Preserve every existing markdown link and backtick-quoted literal (file paths, script names, the `AUTO-GENERATED, DO NOT EDIT BY HAND` marker) exactly — only the surrounding prose changes.
- After editing, no other file in the repo references `AGENTS.md` by line number or anchor (confirmed via repo-wide grep), so bullet splitting is safe and needs no follow-up updates elsewhere.
- Verification is manual: re-read each edited location against its corresponding Codacy finding (see the issue's Findings table) to confirm the specific complaint (word count, undefined term, action count, vagueness) no longer applies.
