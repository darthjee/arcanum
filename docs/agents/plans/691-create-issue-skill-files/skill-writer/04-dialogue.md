# steps/dialogue.md

New `arcanum-create-issue/steps/dialogue.md`, the same checklist loop as `enhance-issue/steps/dialogue.md` (read `docs/agents/issue-enhancement.md` if present, build/refresh the ✅/☐ checklist, let the user pick any item or an outside topic, dig in, write the outcome into `FILE` in English, repeat), with these differences:

- **Title**: the draft keeps the title as its first `# Title` heading; when the title changes, update that heading.
- **Two fixed checklist items**, always present:
  - **Epic?** — yes/no. When the discussion shows the work has independent parts, suggest marking it `Epic` (to be split later with `/arcanum-split-issue`). Never call `spawn_issue.sh` (there is no parent id yet).
  - **Labels** — the label list for the issue.
  Both are asked through **prompt 4** with `AskUserQuestion` (two questions in one call): Epic yes/no, and a multi-select of labels with `Writting` pre-selected (removable) and the hardcoded suggestions `Documentation`, `Feature`, `Refactor`, `Bug`, `Epic`, `shipit`. The AI may recommend zero or more type labels (`Documentation`/`Feature`/`Refactor`/`Bug`) based on the discussion, but **never recommends `shipit`** — it is listed only so the user can opt in. Any other label can be added through "Other". Keep `Epic` in the label list in sync with the Epic? answer (yes → include `Epic`; no → drop it). Removing every label is allowed. These are draft choices; prompt 5 (in publish) binds them. Remember the resulting `<title>` and `<labels...>` for [publish.md](publish.md).
- **Finish**: when the user is satisfied overall, and both Epic? and Labels have been answered at least once (ask prompt 4 now if not), proceed to [publish.md](publish.md).
- **Abandon** (explicit "stop", "drop it", ...): keep the draft, push nothing, print the `declined` report naming the draft path (`--summary "Issue creation abandoned by the user; draft kept at <FILE>."`), relay it verbatim, end with no next-step offer. No `checkout_safe_branch.sh`.
- No sub-issue tracking (`--sub-issue` is never passed), no label changes on GitHub during the dialogue.

## Files to Change

- `arcanum-create-issue/steps/dialogue.md` — new
