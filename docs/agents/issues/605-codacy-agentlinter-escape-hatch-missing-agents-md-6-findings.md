# Issue: Codacy: Agentlinter escape-hatch, sentence-complexity & compound-instruction — AGENTS.md (12 findings)

## Description

Codacy's Agentlinter flags several wording problems in `AGENTS.md`. This issue covers three of its rule sets, which overlap on the same lines:

- `Agentlinter_clarity_escape-hatch-missing` (this issue, 6 findings): absolute rules ("must … with no exceptions" / "Never …") that don't say what to do when the rule can't be followed.
- `Agentlinter` sentence-complexity (folded in from #610, 5 findings): sentences that are too long.
- `Agentlinter` compound-instruction (folded in from #611, 1 finding): one bullet holding 3 actions.

All three are category BestPractice, severity **Warning**. Fixing them together avoids one fix creating findings for another. For example, adding escape-hatch clauses makes sentences longer, and splitting compound bullets adds more "Never" lines.

This follows up #497 (closed, fixed in PR #518). That fix added *justification* clauses ("because …") to most rules. Agentlinter doesn't count a justification as an escape hatch, so those rules are still flagged. The later split of the git-safety rule into four bullets (lines 38–41) added more flagged lines.

## Problem

Current `AGENTS.md` findings:

| Line | Rule set | Finding |
| --- | --- | --- |
| 7 | sentence-complexity (#610) | Stack paragraph, 86 words |
| 13 | sentence-complexity (#610) | Relative-paths rule plus its `REPO_PATH` exception, 51 words |
| 14 | escape-hatch + sentence-complexity (#610) | Absolute path must be a variable "with no exceptions", 44 words |
| 36 | sentence-complexity (#610) | Deterministic-logic rule, 41 words |
| 37 | escape-hatch | Never touch another specialist's owned scope directly |
| 38 | escape-hatch + compound-instruction (#611) | Never run a bare git-mutating command trusting the ambient cwd (3 actions) |
| 39 | escape-hatch | Never call a git-mutating command without scoping it to `REPO_PATH` |
| 40 | escape-hatch | Never re-derive the repo path from `pwd` partway through a run |
| 41 | escape-hatch | Never assume a `cd` downstream is safe |
| 45 | sentence-complexity (#610) | Preapproval rule, 47 words |

Lines 42–44 (the shared-JSON-state/lock "Never" bullets) have the same shape as 37–41 but weren't flagged in this snapshot. They're likely to be flagged in a later scan.

The rules that are **not** flagged for escape-hatch each already contain a conditional or exception phrase: line 35 ("if it needs to change, regenerate it instead"), line 36 ("unless …") and line 45 ("The one exception is …").

## Expected Behavior

- Codacy reports zero `escape-hatch-missing`, sentence-complexity and compound-instruction findings in `AGENTS.md`.
- Every rule keeps its meaning. Only the wording and bullet structure change.
- The fix adds no new findings from the other Agentlinter issues on the same file (#606 naked-conditional, #612 undefined-term).
- The PR closes #605, #610 and #611.

## Solution

**Escape hatches (lines 14, 37–41, and 42–44 as a precaution).** Give each absolute rule a short inline escape hatch, using the conditional phrasing Agentlinter already accepts on lines 35, 36 and 45. The escalation path is: stop and escalate to the `architect` agent, which escalates to the user if needed. Don't work around the rule. A single shared sentence at the top of Boundaries isn't enough, because Agentlinter checks each bullet on its own.

- Line 14 stays strictly absolute in meaning. Drop "with no exceptions" and add "if a variable isn't possible, escalate to `architect`" instead.

**Sentence complexity (lines 7, 13, 14, 36, 45).** Break each long sentence into shorter ones, or into sub-bullets, so every sentence is under Agentlinter's threshold. The added escape-hatch clauses must also stay short enough not to cross it.

**Compound instruction (line 38).** Restructure the git-safety rules (38–41) so no bullet holds more than one action. They can be merged into fewer, shorter bullets, for example one rule "scope every git-mutating command to `REPO_PATH`" with the `pwd`/`cd` hazards as a short justification, as long as each bullet has one action and its own escape hatch. List the command set (`add`/`commit`/…) separately from the rule, or drop it in favor of "any git-mutating command", so the linter doesn't read it as multiple actions.

Owner: `architect` (`AGENTS.md` is a root-level file).

## Benefits

- Clears 12 Codacy warnings across three Agentlinter rule sets in one consistent pass, instead of three PRs that could each undo another's fix.
- Agents get a clear path forward when a safety rule blocks them, instead of stalling or improvising a workaround.
