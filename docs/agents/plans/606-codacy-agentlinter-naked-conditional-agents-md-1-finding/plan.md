# Plan: Codacy: Agentlinter naked-conditional — AGENTS.md (1 finding)

Issue: [606-codacy-agentlinter-naked-conditional-agents-md-1-finding.md](../../issues/606-codacy-agentlinter-naked-conditional-agents-md-1-finding.md)

## Overview

Replace the vague "trivial enough" exception in `AGENTS.md`'s Boundaries section, and the "whenever possible" wording in its Conventions section, with a concrete inline-vs-extract threshold. Define that threshold once in `docs/agents/architecture/script-preference.md` and point `.claude/agents/skill-reviewer.md` at it instead of keeping its own copy.

## Context

Codacy's Agentlinter (`Agentlinter_clarity_naked-conditional`, Warning) flags `AGENTS.md`'s Boundaries bullet "Never embed deterministic logic in skill markdown, unless it is trivial enough that AI misinterpretation risk is negligible." Today the only concrete criteria live in `.claude/agents/skill-reviewer.md`'s "Examples of complex logic" / "Do not flag" lists. `script-preference.md` only offers the question "could this step produce a wrong result due to AI misinterpretation?".

All touched files are documentation or root-level, owned by `architect`.

## Steps

- [01 — Define the threshold in Script Preference](plan/01-script-preference-threshold.md)
- [02 — Rewrite the AGENTS.md bullets](plan/02-agents-md-bullets.md)
- [03 — Point skill-reviewer at the shared criteria](plan/03-skill-reviewer-link.md)

## Notes

- Avoid introducing any new `unless` / `whenever possible` / `if appropriate` phrasing in the edited text: Agentlinter would flag it again.
- Keep the criteria wording in step 01 faithful to the current `skill-reviewer` lists, so review behavior doesn't change. The only addition is `arcanum/_lib/` scripts in the "calls to existing scripts" bullet.
- `.markdownlint.json` applies to these files. Keep list and heading style consistent with the surrounding docs.
