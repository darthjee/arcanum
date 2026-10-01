# Start or Resume a Draft

This step replaces `enhance-issue`'s fetch step: there is no existing GitHub issue, so nothing is fetched. A single script call checks that GitHub is reachable, then creates a fresh local draft or resumes an existing one under `.claude/state/create-issue/`. It never touches git.

```bash
../scripts/start.sh "$REPO_PATH"
```

> Resolve `../scripts/start.sh` relative to this file's directory (i.e. the `steps/` folder inside this skill). When drafts already exist and `/dev/tty` is available, the script asks the resume-or-new question itself on the TTY; otherwise it exits `4` (see below).

Every exit of this step that ends the skill prints exactly one closing report, following the rules in [publish.md](publish.md#closing-report).

## Interpret the output

### exit 0 (`STATUS=new` or `STATUS=resumed`)

Remember `FILE` (the draft path) and carry it through the rest of the run. Then continue with [Fresh draft](#fresh-draft-statusnew) or [Resumed draft](#resumed-draft-statusresumed) below.

### exit 1 (`STATUS=error`)

`gh` is not authenticated, or `origin` is not a GitHub remote. No draft was created. Tell the user `<ERROR>`, then print the `failed` report and relay it verbatim:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status failed \
  --summary "start.sh failed: <ERROR>."
```

> Resolve `../../arcanum/_lib/finish_report.sh` relative to this file's directory.

End — no next-step offer.

### exit 2 (invalid input)

This only happens after a rerun with `--resume <path>` where the path came from a free-text "Other" answer to prompt 1: tell the user that `<path>` is not a known draft, then ask [prompt 1](#exit-4-fallbackchat) again from the `DRAFT=` lines already received.

If it happens in any other situation, surface the script's error to the user, print the `failed` report as in [exit 1](#exit-1-statuserror) (with the script's error as `<ERROR>`), and end.

### exit 4 (`FALLBACK=chat`)

Drafts exist but no `/dev/tty` is available. The output has one `DRAFT=<path>\t<timestamp>\t<title or first line>` line per draft, most recent first. Ask **prompt 1** once with `AskUserQuestion`:

- Question: `Unfinished issue drafts were found. Resume one or start a new issue?`
- Header: `Draft`
- Options, one per draft, then the last one:
  - `Resume: <title or first line>` — description `<timestamp> (<age> ago), <path>`. Rerun with `--resume <path>`.
  - `Start a new issue` — description `Leave the existing drafts in place and start a fresh one.` Rerun with `--new`.

Rules:

- `AskUserQuestion` takes at most four options: list at most the three most recent drafts (the first three `DRAFT=` lines), then `Start a new issue`. There is no paging option.
- Compute `<age>` from the draft's timestamp and the current time (e.g. `2 days`, `3 hours`).
- A free-text "Other" answer that is a draft path → rerun with `--resume <that path>`. Older drafts (beyond the three listed) are reachable only this way.
- A dismissed or rejected question → print the `declined` report, relay it verbatim, and end — no next-step offer:

  ```bash
  ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status declined \
    --summary "Issue creation abandoned before starting; no draft was created or changed."
  ```

Rerun the script with the chosen flag and interpret its fresh output from the top of this section:

```bash
../scripts/start.sh "$REPO_PATH" --resume <path>
../scripts/start.sh "$REPO_PATH" --new
```

## Fresh draft (`STATUS=new`)

Ask the user, in open chat, for their initial idea (prompt 2 — free text, not a choice). Wait for the answer.

Write it into `FILE`:

- A first level-1 heading `# <Title>`, proposed from the idea. This heading is the issue title; the user can change it later in the dialogue.
- The idea as the body, below the heading.

Always write in English, translating if the conversation was in another language.

## Resumed draft (`STATUS=resumed`)

Read `FILE` and briefly summarize to the user where the draft stands (title and what is already covered). Do not ask for an initial idea.

## Next

Proceed to [explore.md](explore.md) using `FILE` as the starting material.
