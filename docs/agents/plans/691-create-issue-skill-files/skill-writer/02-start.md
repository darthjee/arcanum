# steps/start.md

New `arcanum-create-issue/steps/start.md` (replaces `enhance-issue/steps/fetch.md`; nothing is fetched from GitHub).

1. Run `../scripts/start.sh "$REPO_PATH"`.
2. **exit 0** (`STATUS=new` or `STATUS=resumed`): remember `FILE` as the draft path.
3. **exit 1** (`STATUS=error`): tell the user `ERROR`, print the `failed` report (`--summary "start.sh failed: <ERROR>."`, no `--issue`), relay it verbatim and end. No draft was created.
4. **exit 2**: (only after a `--resume <path>` the user typed) say the path is not a known draft and ask prompt 1 again.
5. **exit 4** (`FALLBACK=chat`): ask **prompt 1** with `AskUserQuestion`, wording verbatim from the spec: question `Unfinished issue drafts were found. Resume one or start a new issue?`, header `Draft`; one `Resume: <title or first line>` option per draft (description `<timestamp> (<age> ago), <path>`, age computed from the timestamp), at most the three most recent `DRAFT=` lines (they come most recent first), then `Start a new issue` (description `Leave the existing drafts in place and start a fresh one.`). Rerun with `--resume <path>` or `--new`. A free-text "Other" answer that is a draft path → `--resume <that path>`; older drafts are reachable only this way (no paging). Dismissed or rejected → end with a `declined` report (`--summary "Issue creation abandoned before starting; no draft was created or changed."`).
6. **Fresh draft** (`STATUS=new`): ask the user, in open chat, for the initial idea (prompt 2 — free text, not a choice). Write it into `FILE`: a first `# <Title>` heading (proposed from the idea; the user can change it later in the dialogue) followed by the idea as the body, in English.
7. **Resumed draft** (`STATUS=resumed`): read `FILE` and briefly summarize where it stands; do not ask for an initial idea.
8. Proceed to [explore.md](explore.md).

Define the shared closing-report rules either here or in `publish.md` (and link to them from both), mirroring `enhance-issue/steps/publish.md`'s "Closing report" section: `finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status success|declined|failed --summary "<one line>" [--issue <ID>]`, relay verbatim, no `--label-change`, no `--next`, `declined`/`failed` never followed by a next-step offer, usage-error fallback line.

## Files to Change

- `arcanum-create-issue/steps/start.md` — new
