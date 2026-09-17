# Issue: Codacy: AGENTS.md absolute rules without escape hatches (Agentlinter, 7 findings)

## Description

Codacy's Agentlinter tool flags 7 "absolute rule without escape hatch" findings in `AGENTS.md` — bullets phrased as hard "Never ..." rules with no stated exception path, which can leave an agent stuck when a legitimate edge case doesn't fit the rule.

**Source:** Codacy quality issues, category BestPractice, severity **Warning**, tool Agentlinter (`Agentlinter_clarity_escape-hatch-missing`).

## Problem

| Line | Rule text |
|------|-----------|
| 14 | When an absolute path is required (e.g. inside a script), it must be extracted into a variable instead of repeated inline, with no exceptions. |
| 35 | Never hand-edit an auto-generated file. |
| 36 | Never embed deterministic logic in skill markdown. |
| 37 | Never touch another specialist agent's owned scope directly. |
| 38 | Never run a bare git-mutating command trusting ambient cwd. |
| 39 | Never mutate shared JSON state without the lock sequence. |
| 40 | Never preapprove broad or ad hoc destructive commands. |

## Expected Behavior

- Each rule either keeps its absolute phrasing intentionally (documented as deliberate, with a short "no exceptions because ..." justification) or gets an explicit escape hatch describing what to do when the rule doesn't apply.
- Re-running Agentlinter/Codacy on `AGENTS.md` shows zero `escape-hatch-missing` findings among these 7 locations, or the remaining absolute ones are a deliberate, documented decision.

## Solution

Per-rule resolution, decided during issue discussion by cross-checking each rule against its supporting architecture doc:

| Line | Rule | Resolution |
|------|------|------------|
| 14 | Absolute path → must be a variable, no exceptions | **Stays absolute.** Add justification: an inlined absolute path breaks silently once a script or its caller moves, with nothing to catch it. |
| 35 | Never hand-edit an auto-generated file | **Stays absolute**, but reword into explicit "if it needs to change, do Y instead" form, reusing the existing "regenerate via `scripts/generate_*.sh`" text as the escape hatch's action. |
| 36 | Never embed deterministic logic in skill markdown | **Gets a real carve-out**: per [Script Preference](docs/agents/architecture/script-preference.md)'s own guideline ("could this step produce a wrong result due to AI misinterpretation?"), logic trivial enough that misinterpretation risk is negligible may stay inline. |
| 37 | Never touch another specialist agent's owned scope directly | **Stays absolute.** Add justification: bypassing the owning specialist causes scope drift and uncoordinated edits; route through `architect` instead (see [Agent Roster and Architect Delegation](docs/agents/architecture/agent-roster-and-delegation.md)). |
| 38 | Never run a bare git-mutating command trusting ambient cwd | **Stays absolute** (safety-critical per [Repo Path Threading](docs/agents/architecture/repo-path-threading.md)). Add justification: a `cd` anywhere downstream (including inside a spawned subagent) could silently redirect mutations to the wrong repo. |
| 39 | Never mutate shared JSON state without the lock sequence | **Stays absolute** (safety-critical per [Lock System](docs/agents/architecture/lock-system.md)). Add justification: prevents concurrent-writer corruption of shared state. |
| 40 | Never preapprove broad or ad hoc destructive commands | **Gets an explicit escape hatch**: ad hoc/agent-specific commands rely on the `OUTCOME=blocked` escalation path instead of a broad grant, per [Dispatch Permissions](docs/agents/architecture/dispatch-permissions.md) — already the doc's stated intent elsewhere, just not phrased as a hatch on this bullet. |

Net effect: 4 of the 7 rules stay absolute with a short justification clause; 2 (lines 35 and 40) are reworded into explicit "unless X, do Y" escape-hatch phrasing without changing their underlying meaning; 1 (line 36) gains a genuine new exception for trivial, low-misinterpretation-risk logic.
