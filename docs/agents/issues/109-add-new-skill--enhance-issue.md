# Issue: Add new skill: enhance issue

## Description
Add a new skill, `enhance-issue`, that lets a human iteratively flesh out a freshly drafted, still-vague GitHub issue through open-ended dialogue with the AI — proposing alternative solutions, breaking the ask into parts, and letting the user pick which concern to dig into next — before the issue is mature enough to enter the `discuss-issue` → `plan-issue`/`auto-plan-issue` → `auto-fix-issue` pipeline.

It targets a different stage than `discuss-issue`: `discuss-issue` assumes the user has already done a lot of the heavy lifting (endpoints, permission rules, implementation ideas already sketched out) and focuses on code-context clarification plus kicking off a plan. `enhance-issue` targets the opposite end — an issue that starts as a one-liner like "Add photo list page", with little more than the idea itself — and helps turn it into something concrete enough to be worth planning.

## Problem
Today, the only skill that engages a human in dialogue about a GitHub issue is `discuss-issue`, and it's built around issues that are already reasonably fleshed out (already `Created`). There's no skill support for the much earlier stage — a bare idea (tagged `Idea`/`Writting`) — where the user would benefit from the AI proposing alternatives, breaking the idea into parts, or surfacing concerns (scope, edge cases, non-functional requirements, etc.) the user hasn't considered yet, before the issue is published as `Created` and formally enters the pipeline.

## Expected Behavior
- Fetch the issue content from GitHub (works on any issue, not just `Created` ones).
- Save the fetched issue locally under `docs/agents/issues/<id>-...md`, but do not commit it — the file is transient working material for this skill only; committing an issue file is `discuss-issue`'s responsibility, and this file is deleted again at the end of the flow.
- Do a lightweight read of the code and the issue content for general understanding (no deep specialist-agent dispatch by default, unlike `discuss-issue`).
- Read `docs/agents/issue-enhancement.md` for the project's list of "usual concerns" to check the issue against.
- Present the user a list of candidate concerns/topics (derived from the issue plus `issue-enhancement.md`), marking which ones have already been discussed.
- Let the user pick any item — including one already discussed, to revisit it — or raise a topic outside the list entirely.
- For the chosen topic, hold an open dialogue with the user: propose alternatives, dig deep until both are satisfied, append the outcome to the local issue draft, then return to the topic list.
- Repeat until the user says they're satisfied with the issue overall.
- Update the live GitHub issue body (via script) and swap tags: add `Created`, remove `Writting` and `Idea`.
- Delete the local issue file from `docs/agents/issues` — nothing from this skill is committed; only the GitHub issue body changes.

## Solution
1. New skill folder `enhance-issue/` (`SKILL.md` + `steps/` + `scripts/`), following the same layout and script-extraction conventions as `discuss-issue`.
2. New doc `docs/agents/issue-enhancement.md` — a seeded default list of "usual concerns" (e.g. scope boundaries, alternative solutions, edge cases, backward compatibility, testing strategy, performance/security considerations) that a project can customize. Arcanum's own `docs/agents/issue-enhancement.md` is created as part of this same issue (dogfooding).
3. A new dedicated tag-mutation subcommand (e.g. `mark-created` in `_lib/github_issue.sh`) for the `+Created`/`-Writting`/`-Idea` transition — kept separate from `mark-refined`, which also adds `Refined` and isn't wanted here, per `docs/agents/architecture.md`'s guidance that new tag transitions get their own thin wrapper.
4. `init-claude` gets a new step that helps the target project populate/customize `docs/agents/issue-enhancement.md`, seeded with the default list from point 2, through the same suggest/ask/repeat dialogue pattern the other `setup_*.md` steps already use.

## Benefits
- Issues reach the `Created` stage already vetted for scope, alternatives, and edge cases, reducing back-and-forth later in `discuss-issue`/planning.
- Gives the human a structured, checklist-driven way to brainstorm with the AI while an idea is still a one-liner, rather than only after it's already detailed.
- Keeps the "still just an idea" (`Idea`/`Writting`) and "ready for the pipeline" (`Created`) stages clearly separated, each with tooling suited to its level of maturity.
