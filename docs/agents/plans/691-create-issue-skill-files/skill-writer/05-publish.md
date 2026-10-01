# steps/publish.md

New `arcanum-create-issue/steps/publish.md` — creates the issue (instead of updating one) and ends the run.

## 1. Publish

Run `../scripts/publish.sh "$REPO_PATH" <FILE> "<title>" <labels...>` (no confirmation flags on the first call; pass no labels at all if the user removed every label). Interpret:

- **exit 4, no `--confirmed` passed** → **prompt 5** via `AskUserQuestion`, verbatim from the spec: question `Create this issue on GitHub? Title: "<title>". Labels: <labels, or "none">. Epic: <yes|no>. Body: <N> lines.` (N = draft line count excluding the `# Title` line; a single `wc -l < <FILE>` is fine), header `Create issue`, options `Yes, create it` / `No, keep editing` / `Chat` with the spec's descriptions.
  - Yes → rerun with `--confirmed` (same labels).
  - No → back to [dialogue.md](dialogue.md); nothing created.
  - Chat → return to the conversation with the draft kept and **the run still open**: no closing report yet. The user can keep refining (back to the dialogue) and publish later in the same run.
  - Dismissed/rejected → same as Chat.
- **exit 4 with `--confirmed`, no `--shipit-confirmed`, `shipit` among the labels** → **prompt 6** via `AskUserQuestion`, verbatim: question `Apply shipit? It pre-approves the whole PR lifecycle for this issue: auto-fix-all will merge the PR as soon as CI passes, with no review.`, header `shipit`, options in this order: `No, create without shipit (Recommended)` (rerun with `--confirmed` and `shipit` removed from the labels; remember that shipit was dropped), `Yes, apply shipit` (rerun with `--confirmed --shipit-confirmed`). Dismissed/rejected → treat as No.
- **exit 0, `STATUS=declined`** (TTY prompt 5 answered there): `CHOICE=no` → back to the dialogue; `CHOICE=chat` → same as Chat above (run stays open).
- **exit 2** (empty title/body, malformed label) → tell the user what to fix and go back to [dialogue.md](dialogue.md).
- **exit 1, `STATUS=failed`** → print the `failed` report (`--summary "publish.sh failed: <ERROR>; draft kept at <FILE>."`, no `--issue`), relay it verbatim, end; the draft is kept and the user should check GitHub before rerunning (the error says so).
- **exit 0, `STATUS=ok`** → go to step 2 with `ID`, `URL`, `LABELS`, `EPIC` and any `WARNING=` lines.

Also detect the TTY path's own shipit decline: if `shipit` was passed but is absent from `LABELS`, the issue was created without it.

## 2. Success report

Surface every `WARNING=` line to the user (e.g. a created label, a draft that could not be deleted), then print the `success` report:

`../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status success --issue <ID> --summary "Issue #<ID> created with labels: <LABELS or none>.[ Created without shipit (not confirmed).]"`

Relay it verbatim. Do not delete the draft yourself — `publish.sh` already did.

## 3. Next step

`../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "<cmd>"` with `<cmd>` = `/arcanum-split-issue <ID>` when `EPIC=true`, otherwise `/discuss-issue <ID>`. Handle `CHOICE=yes` (invoke `<cmd>` inline as a chained top-level run, no `NESTED=true`), `CHOICE=no`, `CHOICE=chat` (exit 3), exit 1 and exit 4 (`AskUserQuestion` Yes/No/Chat naming the exact command, headless fallback "Next step: `<cmd>` (run it manually)") exactly like `enhance-issue/steps/publish.md` step 5. Ask at most once.

## Files to Change

- `arcanum-create-issue/steps/publish.md` — new
