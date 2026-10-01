# Create the Issue on GitHub

Once the user is satisfied with the issue overall (the end of the [dialogue.md](dialogue.md) loop), create the GitHub issue from the draft with its labels, and end with the standard finish. Nothing from this skill is committed to the repo and git is never touched: only the new GitHub issue appears, and `publish.sh` deletes the local draft once the issue exists.

## Closing report

Every exit of this skill — success here, the declined exits in [start.md](start.md#exit-4-fallbackchat) and [dialogue.md](dialogue.md#abandoning-the-run-declined), and the failed exits in [start.md](start.md#exit-1-statuserror) and below — ends with exactly one report printed by the shared script:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status success|declined|failed \
  --summary "<one line>" [--issue <ID>]
```

> Resolve `../../arcanum/_lib/finish_report.sh` relative to this file's directory. `arcanum-create-issue` is interactive and never run nested by another skill, so `--nested` and `--next` are never passed.

- Relay its stdout **verbatim** as the last thing you print before any next-step offer. Never hand-format, extend, or paraphrase it.
- Pass `--issue <ID>` only on success, once the issue exists.
- Never pass `--label-change`: it only accepts canonical pipeline tags. The labels applied to the new issue go in the **summary text** instead.
- `declined` and `failed` reports are never followed by a next-step offer.
- If the script itself exits non-zero (usage error), tell the user in one line that the closing report could not be rendered, and end.

## 1. Create the issue

Use `<title>` (the draft's `# <Title>` heading) and `<labels...>` (the draft choices from [dialogue.md](dialogue.md#epic-and-labels)). Pass no labels at all if the user removed every label. The first call never passes a confirmation flag:

```bash
../scripts/publish.sh "$REPO_PATH" <FILE> "<title>" <label>...
```

> Resolve `../scripts/publish.sh` relative to this file's directory. When `/dev/tty` is available, the script asks the final confirmation (and, when `shipit` is among the labels, the `shipit` confirmation) itself on the TTY; otherwise it exits `4` (see below). Every rerun below keeps the same `<FILE>`, `"<title>"` and labels unless stated otherwise.

Interpret the output:

### exit 4 (`FALLBACK=chat`) without `--confirmed` — prompt 5

Count the body lines: the draft's line count minus the `# <Title>` line.

```bash
wc -l < <FILE>
```

Ask **prompt 5** once with `AskUserQuestion`:

- Question: `Create this issue on GitHub? Title: "<title>". Labels: <labels, or "none">. Epic: <yes|no>. Body: <N> lines.`
- Header: `Create issue`
- Options:
  - `Yes, create it` — description `Create the issue with these labels and delete the local draft.` Rerun with `--confirmed`.
  - `No, keep editing` — description `Go back to the checklist and keep refining the draft.` Back to the dialogue; nothing is created.
  - `Chat` — description `Return to the conversation without creating anything.` Nothing is created.

Follow the answer:

- **Yes** → rerun with `--confirmed` and interpret its fresh output from the top of this section:

  ```bash
  ../scripts/publish.sh "$REPO_PATH" <FILE> "<title>" --confirmed <label>...
  ```

- **No** → go back to [dialogue.md](dialogue.md) step 2; nothing was created.
- **Chat**, a free-text "Other" answer, or a dismissed or rejected question → see [Chat keeps the run open](#chat-keeps-the-run-open).

### exit 4 (`FALLBACK=chat`) with `--confirmed`, without `--shipit-confirmed` — prompt 6

This only happens when `shipit` is among the labels. Ask **prompt 6** once with `AskUserQuestion`:

- Question: `Apply shipit? It pre-approves the whole PR lifecycle for this issue: auto-fix-all will merge the PR as soon as CI passes, with no review.`
- Header: `shipit`
- Options, in this order, so the safe choice comes first:
  - `No, create without shipit (Recommended)` — description `The issue is created without the shipit label.` Rerun with `--confirmed` and without `shipit` among the labels.
  - `Yes, apply shipit` — description `The issue is created pre-approved for merge.` Rerun with `--confirmed --shipit-confirmed`.

Follow the answer, then interpret the rerun's fresh output from the top of this section:

- **No**, a free-text "Other" answer, or a dismissed or rejected question → remember that `shipit` was dropped, and rerun without it:

  ```bash
  ../scripts/publish.sh "$REPO_PATH" <FILE> "<title>" --confirmed <labels without shipit>...
  ```

- **Yes** →

  ```bash
  ../scripts/publish.sh "$REPO_PATH" <FILE> "<title>" --confirmed --shipit-confirmed <label>...
  ```

### exit 0, `STATUS=declined`

The user answered prompt 5 on the TTY; nothing was created and the draft is kept.

- `CHOICE=no` → go back to [dialogue.md](dialogue.md) step 2.
- `CHOICE=chat` → see [Chat keeps the run open](#chat-keeps-the-run-open).

### exit 2 (invalid input)

The title or the body is empty, or a label is malformed (empty, with a comma, or with a newline). Nothing was created. Tell the user what to fix, then go back to [dialogue.md](dialogue.md) step 2.

### exit 1 (`STATUS=failed`)

The create failed; the draft is kept. Tell the user `<ERROR>` — it says to check GitHub before running again, since the issue may have been created despite the error. Then print the `failed` report, relay it verbatim, and end — no next-step offer:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status failed \
  --summary "publish.sh failed: <ERROR>; draft kept at <FILE>."
```

### exit 0, `STATUS=ok`

The issue was created and the draft deleted. Remember `ID`, `URL`, `LABELS`, `EPIC` and every `WARNING=` line, and go to [step 2](#2-success-report).

`shipit` was also dropped when it was passed to the script but is absent from `LABELS` (the user declined prompt 6 on the TTY): treat it the same as a prompt 6 **No**.

### Chat keeps the run open

Return to the conversation. Nothing was created, the draft `FILE` is kept, and **the run stays open**: print no closing report yet. The user can keep refining the draft (back to [dialogue.md](dialogue.md)) and come back to this step later in the same run, or abandon it through the dialogue's [declined path](dialogue.md#abandoning-the-run-declined).

## 2. Success report

Surface every `WARNING=` line to the user (e.g. `created label <name>`, or a draft that could not be deleted). Do not delete the draft yourself — `publish.sh` already did.

Print the `success` report and relay it verbatim (see [Closing report](#closing-report)). Name the applied labels from `LABELS` (or `none`) in the summary, and, when `shipit` was asked for but dropped, add `Created without shipit (not confirmed).`:

```bash
../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status success --issue <ID> \
  --summary "Issue #<ID> created with labels: <LABELS, or none>.[ Created without shipit (not confirmed).]"
```

## 3. Next step

The next command depends on `EPIC`: `<cmd>` is `/arcanum-split-issue <ID>` when `EPIC=true`, otherwise `/discuss-issue <ID>`.

Offer it through the shared `/dev/tty` prompt, falling back to a structured `AskUserQuestion` when no TTY is available (TTY-first with `AskUserQuestion` fallback) — never a free-text chat yes/no:

```bash
../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "<cmd>"
```

> Resolve `../../arcanum/_lib/next_step_prompt.sh` relative to this file's directory. It prints `CHOICE=yes` / `CHOICE=no` (exit 0), `CHOICE=chat` + `CHAT_CONTEXT=next_step` (exit 3), `FALLBACK=chat` + one `COMMAND=<cmd>` line per `--command`, in order (exit 4, no TTY available), or nothing with an error on stderr (exit 1, prompt failed). The full contract lives in [Next-step offer](../../docs/agents/architecture/skill-finish.md#next-step-offer-interactive-skills).

- **`CHOICE=yes`**: invoke `<cmd>` inline, in the same session, as a **chained** top-level run — no `NESTED=true`. It prints its own report and next step.
- **`CHOICE=no`**: end.
- **`CHOICE=chat`** (exit 3): return to the conversation. Do not run `<cmd>` unless the user asks for it in chat.
- **exit 1**: say in one line that the next-step prompt failed: <stderr>, then end.
- **exit 4** (`FALLBACK=chat`, no TTY): ask once with `AskUserQuestion` — the question names the exact command from the `COMMAND=` line(s), with options **Yes** (run it now), **No**, **Chat** — then follow the matching branch above: Yes → `CHOICE=yes`, No → `CHOICE=no`, Chat → `CHOICE=chat`. A free-text "Other" answer → `CHOICE=chat`, with the text as context; a dismissed or rejected question → `CHOICE=no`. If `AskUserQuestion` is unavailable (headless, tool denied), print "Next step: `<cmd>` (run it manually)" and end.

Ask at most once: never re-ask after the user has answered (on the TTY or through `AskUserQuestion`), never ask with a free-text chat yes/no, and never change the command that was shown.
