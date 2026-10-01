# Topic-Driven Dialogue

The core loop of this skill: a checklist of concerns the user can pick from, revisited until they're satisfied with the issue overall. It is the same loop as `enhance-issue`'s dialogue, plus two fixed items (**Epic?** and **Labels**), and it never spawns issues.

Nothing is pushed to GitHub during this loop: no issue is created, no label is changed. Everything lives in the local draft `FILE` (from [start.md](start.md)) and in the two draft choices below.

## 1. Read the project's usual concerns

Read `docs/agents/issue-enhancement.md` in the target repo, if it exists. Degrade gracefully if it's missing — proceed with only the fixed items and the idea-derived concerns from step 2 below.

## 2. Build the topic checklist

Build (or, on a repeat pass, update) a checklist combining:

- The two fixed items, always present: **Epic?** and **Labels** (see [Epic? and Labels](#epic-and-labels)).
- Every concern listed in `docs/agents/issue-enhancement.md` (when present).
- Any idea-specific concerns evident from `FILE`'s content or the exploration in [explore.md](explore.md) that aren't already covered above.

Mark each item as already discussed (✅) or not (☐) based on this conversation so far. For a resumed draft, an item already covered in `FILE` counts as discussed, except **Epic?** and **Labels**, which are draft choices of this run and start unchecked.

## 3. Present the list

Show the checklist to the user, together with the current title (the draft's `# <Title>` heading) and, once chosen, the current Epic? answer and labels. Let them pick:

- Any item, checked or not — picking a checked item means revisiting it.
- A topic entirely outside the list.

Wait for their choice.

## 4. Dig into the chosen topic

Hold an open dialogue about the chosen topic: propose alternatives, ask follow-up questions, surface trade-offs — dig in until both you and the user are satisfied with the outcome for that topic.

Append the outcome to `FILE` — add or update a section capturing what was decided, in whatever shape fits the topic (e.g. a `## <Topic>` subsection, or folded into an existing `## Description`/`## Solution` section if that reads better). Always write in English, translating if the conversation was in another language.

The draft's first level-1 heading (`# <Title>`) is the issue title. Whenever the title changes, update that heading; keep it the only level-1 heading in `FILE`.

**No spawning.** Never call `spawn_issue.sh`: there is no parent issue id yet. If the discussion shows the work has independent parts that deserve their own issues, suggest marking this issue `Epic` (through the **Epic?** item) so it can be split later with `/arcanum-split-issue`.

## Epic? and Labels

Picking either fixed item (or reaching the finish in step 5 with either still unanswered) asks **prompt 4**: one `AskUserQuestion` call with three questions. `AskUserQuestion` takes at most four options per question, so the labels are spread over two multi-select questions:

1. **Epic?** — header `Epic`, single choice:
   - `Yes, it is an Epic` — description `The issue is meant to be split with /arcanum-split-issue, not implemented directly.`
   - `No, a single issue` — description `The issue is meant to be implemented as one piece of work.`
2. **Type labels** — header `Type`, multi-select: `Documentation`, `Feature`, `Refactor`, `Bug`. Append ` (Recommended)` to the type labels you recommend from the discussion (zero or more, in any combination).
3. **Other labels** — header `Labels`, multi-select:
   - `Writting` — description `Default label; deselect it to create the issue without it.` It is the default: recommend it unless the user already removed it in this run.
   - `shipit` — description `Pre-approves the whole PR lifecycle, including the merge. Asked again for confirmation before the issue is created.` Never recommend it: it is listed only so the user can opt in.

   Any other label can be added through the free-text "Other" answer of question 2 or 3 (comma-separated for several).

Apply the answers to the draft choices:

- **Labels** = the labels selected in questions 2 and 3, plus any typed through "Other".
- Keep `Epic` in sync with question 1: **Yes** → add `Epic` to the labels; **No** → drop `Epic` from them (including one typed through "Other").
- Removing every label is allowed: the issue is then created with no labels.
- A dismissed or rejected question leaves the previous choices unchanged (or, before the first answer, the defaults: not an Epic, labels `Writting`), and the item stays unchecked.

Tell the user the resulting Epic? answer and labels, then mark both items ✅. These are draft choices only; the final confirmation in [publish.md](publish.md) is what binds them. Remember `<title>` (the `# <Title>` heading) and `<labels...>` for [publish.md](publish.md).

## 5. Repeat or finish

Return to step 2 to refresh the checklist (the item just discussed is now ✅) and present it again.

Keep looping until the user says they're satisfied with the issue overall. Before leaving the loop, make sure **Epic?** and **Labels** have each been answered at least once in this run — if not, ask prompt 4 now. Then proceed to [publish.md](publish.md). If instead the user explicitly abandons the run, follow [Abandoning the run](#abandoning-the-run-declined) below.

## Abandoning the run (declined)

If, at any point in this loop, the user explicitly abandons the run (e.g. "stop", "drop it", "never mind, don't create it"), end the skill here. Only an explicit abandonment counts: a user who is merely not yet satisfied with one topic, or who wants to move on to another topic, has not declined — keep looping.

1. Do not create anything on GitHub.
2. Keep the local draft `FILE` — do not delete it — so a later `/arcanum-create-issue` can resume it.
3. Print the `declined` report naming the draft path, and relay it verbatim (see [publish.md](publish.md#closing-report) for the report rules):

   ```bash
   ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status declined \
     --summary "Issue creation abandoned by the user; draft kept at <FILE>."
   ```

   > Resolve `../../arcanum/_lib/finish_report.sh` relative to this file's directory.

4. End — no next-step offer.
