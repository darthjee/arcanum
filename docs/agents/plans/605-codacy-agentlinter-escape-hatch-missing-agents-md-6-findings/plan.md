# Plan: Codacy: Agentlinter escape-hatch, sentence-complexity & compound-instruction — AGENTS.md (12 findings)

Issue: [605-codacy-agentlinter-escape-hatch-missing-agents-md-6-findings.md](../../issues/605-codacy-agentlinter-escape-hatch-missing-agents-md-6-findings.md)

## Overview

Reword `AGENTS.md` so it clears three Agentlinter rule sets in one pass. The first is escape-hatch-missing (#605: lines 14 and 37–41, plus 42–44 as a precaution). The second is sentence-complexity (#610: lines 7, 13, 14, 36 and 45). The third is compound-instruction (#611: line 38). The meaning of every rule stays the same. This is a documentation-only change to a root-level file, owned by `architect`. No specialist agent has work.

## Context

- #497 / PR #518 added "because …" justifications to the Boundaries rules. Agentlinter doesn't treat a justification as an escape hatch.
- Agentlinter accepts conditional or exception phrasing as an escape hatch. Line 35 ("if it needs to change, regenerate it instead"), line 36 ("unless …") and line 45 ("The one exception is …") are not flagged. Use the same pattern.
- The escalation path the user agreed on: stop and escalate to the `architect` agent, which escalates to the user if needed. Never work around the rule.
- Agentlinter checks each bullet on its own, so every absolute bullet needs its own hatch. A shared lead-in sentence isn't enough.
- Sentence-complexity flagged sentences of 41 words and up. Target **≤ 30 words per sentence**, including the added hatch clauses, to leave a margin.
- Compound-instruction counts actions inside a bullet. Line 38's inline list of `git add`/`commit`/`checkout`/… was read as 3 actions.

## Implementation Steps

### Step 1 — Restructure the Boundaries section (lines 37–44)

- **Line 37 (scope ownership):** keep the bold rule and add a hatch. Example: "If the owning specialist can't take the work, escalate to `architect` (who asks the user if needed) rather than editing its scope yourself." Keep the scope-drift justification and the roster link, split into short sentences.
- **Lines 38–41 (git safety):** merge the four bullets into fewer, single-action bullets, for example:
  - "**Scope every git-mutating command explicitly to the resolved `REPO_PATH` (e.g. `git -C "$REPO_PATH" …`).** If you can't, stop and escalate to `architect` instead of relying on the ambient cwd."
  - "**Resolve `REPO_PATH` once, at the start of a run.** Never re-derive it from `pwd` later. A `cd` downstream, even inside a spawned subagent, can silently redirect mutations to the wrong repo. If the path looks wrong, escalate to `architect`."
  - Don't list the individual subcommands inline. Say "any git-mutating command" and, if needed, give the list as a separate sentence that isn't an instruction. Keep the [Repo Path Threading](docs/agents/architecture/repo-path-threading.md) link.
- **Lines 42–44 (shared JSON state / lock):** merge them into a single-action bullet with a hatch, for example "**Mutate shared JSON state (e.g. the `auto-fix-all` queue) only through the write/mutate/release lock sequence.** It prevents concurrent-writer corruption. If a lock can't be acquired or the sequence can't be followed, stop and escalate to `architect`." Keep the [Lock System](docs/agents/architecture/lock-system.md) link.
- Lines 35, 36 and 45 already have hatches. Only change them in Step 2, for sentence length.

### Step 2 — Shorten the long sentences (lines 7, 13, 14, 36, 45)

- **Line 7 (Stack):** split the paragraph into short sentences or a short bullet list: markdown-driven skills with no build step; the `core/` Node.js package and its tooling; the per-entrypoint bash→native migration with the [Script Engine](docs/agents/architecture/script-engine.md) link; the `engine.mode` default with the migration-status link. Keep all the facts.
- **Line 13 (relative paths):** first sentence is the rule. Then a separate short sentence for the `REPO_PATH` exception, and one more for its reason plus the link.
- **Line 14 (absolute path in scripts):** drop "with no exceptions". Say the absolute path must be extracted into a variable, give the reason in its own short sentence, and add the hatch "If a variable isn't possible, escalate to `architect`."
- **Line 36 (deterministic logic):** keep the bold rule with its "unless" clause. Split the follow-up into short sentences: extract to `<skill>/scripts/*.sh` or `arcanum/_lib/`, then point to [Script Preference](docs/agents/architecture/script-preference.md) for judging the risk.
- **Line 45 (preapproval):** keep "The one exception is …", which is the hatch. Split the rest into sentences of 30 words or fewer: exception, allowlist candidates, and the blocked-dispatch escalation path with its link.

## Files to Change

- `AGENTS.md` — the Stack paragraph, Conventions bullets 13–14, and the Boundaries section (lines 36–45) as described above.

## CI Checks

No CI job lints markdown (`.circleci/config.yml` only runs `yarn lint` inside `core/`). Optionally check locally that the repo's `.markdownlint.json` rules still pass: `npx markdownlint-cli2 AGENTS.md`.

## Notes

- Agentlinter only runs on Codacy, so it can't be run locally. The Codacy analysis on the PR is the real check. It should show the 12 findings resolved and no new ones.
- Don't introduce new Agentlinter findings from the sibling issues: #606 (naked-conditional, where each "if" needs a stated consequence) and #612 (undefined-term). Every added "if …" clause must name an explicit action.
- The PR description should close #605, #610 and #611.
- Don't touch `CLAUDE.md` / `.github/copilot-instructions.md`. They are excluded from Codacy and just redirect to `AGENTS.md`.
