# Issue: Skill finish: enhance-issue

## Description
Parent: #658. Sub-issue of the skill-finish standardization. The spec (`docs/agents/specs/skill-finish.md`, #659) and the shared scripts (`arcanum/_lib/finish_report.sh`, `arcanum/_lib/next_step_prompt.sh`, delivered with #660) are already merged, so this issue is unblocked.

Change `enhance-issue`'s ending so it follows the standard finish from the spec: a closing report rendered by `finish_report.sh` on every exit path, followed on success by the `/dev/tty` next-step offer for `/discuss-issue <id>`. `discuss-issue` (#660) is the reference implementation to mirror.

## Problem
`enhance-issue/steps/publish.md` §4 ends with a hand-written confirmation line ("the issue has been updated on GitHub and is now tagged Created..."). There is no structured report, no next-step offer, and no defined ending for early exits (fetch failure, user abandoning the dialogue, GitHub update failure).

## Expected Behavior
- **Success** (after `update` + `mark-created`, draft deleted, tree released): relay verbatim
  `finish_report.sh "$REPO_PATH" --skill enhance-issue --status success --issue <id> --summary "..." --label-change <...>`,
  then run `next_step_prompt.sh --repo "$REPO_PATH" --command "/discuss-issue <id>"`:
  - `CHOICE=yes` → invoke `/discuss-issue <id>` inline as a **chained** top-level run (no `NESTED=true`);
  - `CHOICE=no` → end;
  - `CHOICE=chat` (exit 3) → return to the conversation, do not run `discuss-issue` unless asked;
  - exit 1 → one line saying the prompt was unavailable, then end.
- **Declined** (user explicitly abandons the dialogue): no push, `declined` report, no next-step offer.
- **Failed** (`resolve_and_fetch.sh` fails, or `github.sh update` fails): release the tree, `failed` report naming the step, no next-step offer.
- **Label changes** reported are every change the run actually made, each derived from the `Removed tag '<tag>'` output of the `mark-*` call:
  - fetch-time `mark-enhancing` → `idea:enhancing` / `writting:enhancing` / `:enhancing` (when neither was present);
  - publish-time `mark-created` → `enhancing:created` (or `:created` if `Enhancing` wasn't present).
  The fetch-time change is carried through the dialogue and reported on every exit path after it ran (success, declined, and failed).
- On **declined** or **failed**, the `Enhancing` label is left in place (no revert). The local draft file is **kept**, so a later `/enhance-issue <id>` resumes from it. Only the success path deletes the draft.
- The ad-hoc confirmation line in `publish.md` §4 is removed; the report is the last thing printed before the offer.
- `enhance-issue` is never run nested by another skill (`arcanum-split-issue` only *chains* to it), so no `NESTED=true` handling is needed.

## Solution
`skill-writer` edits `enhance-issue/steps/fetch.md`, `dialogue.md` and `publish.md` (and `SKILL.md` if needed), mirroring the structure #660 added to `discuss-issue/steps/discuss_and_save.md` ("Closing report", "Failed exits", "Abandoning ... (declined)", derivation of label changes from `Removed tag '<tag>'` output of the `mark-*` calls). No script changes are expected: no new `github_issue.sh` subcommand is needed, because `Enhancing` is not reverted on decline or failure.

## Benefits
`enhance-issue` ends like every other in-scope issue skill, and the user is offered the natural next pipeline step (`/discuss-issue <id>`) with the exact command shown.

## Acceptance criteria
- [ ] `enhance-issue` ends with the standard closing report on every exit path (success, declined, failed)
- [ ] On success, the next-step offer is `/discuss-issue <id>` via `next_step_prompt.sh`, handled per the spec's skill-side rules
- [ ] No ad-hoc confirmation line or chat-mediated follow-up question remains
