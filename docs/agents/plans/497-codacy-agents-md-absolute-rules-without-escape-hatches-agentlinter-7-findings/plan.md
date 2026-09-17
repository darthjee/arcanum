# Plan: Codacy: AGENTS.md absolute rules without escape hatches (Agentlinter, 7 findings)

Issue: [497-codacy-agents-md-absolute-rules-without-escape-hatches-agentlinter-7-findings.md](../issues/497-codacy-agents-md-absolute-rules-without-escape-hatches-agentlinter-7-findings.md)

## Overview

Codacy's Agentlinter flags 7 bullets in `AGENTS.md` (line 14 and lines 35–40) as absolute "Never..." rules with no escape hatch. The issue's Solution section already records a per-rule resolution, decided during discussion by cross-checking each rule against its supporting architecture doc. This plan turns that resolution into concrete edits to `AGENTS.md`.

## Context

- Line 14 (Conventions section): absolute-path-must-be-a-variable rule.
- Lines 35–40 (Boundaries section): 6 "Never ..." bullets.
- Root-level file, no specialist agent's scope applies (not a script, not a skill file, not `core/`, not Docker/Makefile) — `architect` owns this directly per its own documented scope ("Project documentation, root-level files").

## Steps

- [01 — Add justification clauses to the 4 rules staying absolute](plan/01-add-justification-clauses.md)
- [02 — Reword lines 35 and 40 into explicit escape-hatch phrasing](plan/02-reword-explicit-escape-hatches.md)
- [03 — Add a genuine carve-out to line 36](plan/03-add-carve-out-line-36.md)

## Notes

- All 7 edits land in the same file (`AGENTS.md`); keep them as one coherent commit/PR rather than splitting further — the step split above is for plan organization only.
- After editing, re-running Codacy/Agentlinter on `AGENTS.md` should show zero `escape-hatch-missing` findings among these 7 locations (per the issue's Expected Behavior). This is an external Codacy re-scan, not a local CI job — no `## CI Checks` section applies here (`.circleci/config.yml`'s `test`/`checks` jobs only run `core/`'s Node.js suite and don't touch root markdown).
- Wording in each step file is a starting point, not verbatim required text — preserve the intent (justification vs. explicit hatch vs. carve-out) captured in the issue's Solution table.
- Apply edits top-to-bottom in a single pass to avoid re-resolving line-number offsets as earlier edits shift later lines.
