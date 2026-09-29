# Autonomously Create a New Issue File

You are the **architect**. Your job is to autonomously create a new issue file in `docs/agents/issues/` — no questions to the user, no confirmation loop. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues`. Your invocation prompt also carries `REPO_PATH` (the target project's root, resolved once by whichever coordinator or nested caller spawned/invoked you) — thread it explicitly as the leading argument to every script call below that resolves the GitHub repo or performs a git operation (including Step 4's `commit_issue.sh` call in [commit_and_sync.md](commit_and_sync.md)).

The invocation prompt may also carry `NESTED=true`, set by a nested caller such as `auto-fix-all`. Its absence means this is a top-level run. When present, pass `NESTED=true` on to any run this skill nests in turn (currently none). It changes how every exit ends: see [Closing report](commit_and_sync.md#closing-report) in `commit_and_sync.md`, which defines the report for every exit path, including the ones below.

## Step 1 — Define the issue ID and filename

Run the resolve script, passing the issues folder and the raw skill arguments:

```bash
scripts/resolve_id_and_file.sh "$REPO_PATH" docs/agents/issues "<skill_args>"
```

> Resolve `scripts/resolve_id_and_file.sh` relative to the `auto-new-issue` skill folder.

If it exits non-zero, **fail with** `resolve_id_and_file.sh` (see [Failed exits](commit_and_sync.md#failed-exits)). Pass `--issue <ID>` only if a numeric id was given in the skill arguments; otherwise omit it.

Otherwise, parse the key=value output to obtain `SCENARIO`, `ID`, `TITLE`, `FILE`, `STATUS`, and optionally `NEEDS_FETCH`.

- **STATUS=existing** — the file already exists. This skill never overwrites an existing issue file, so write and commit nothing, and end with the `success` report (see [Closing report](commit_and_sync.md#closing-report)):

  ```bash
  ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-new-issue --status success --issue <ID> \
    --summary "Issue file for #<ID> already exists; nothing was written." --next "/auto-plan-issue <ID>"
  ```

  > Resolve `../arcanum/_lib/finish_report.sh` relative to the `auto-new-issue` skill folder. With `NESTED=true`, drop `--next` and add `--nested`, then relay the `FINISH_*` block to your caller.
- **STATUS=missing_id** — no numeric GitHub issue ID is known yet (and there is no local-only id convention to fall back on). This skill never asks the user. If no title is known either, use `TODO: untitled issue` as the title. Proceed to Step 3 to draft the content — since there's no `FILE` path yet, Step 3 writes to a temporary file instead. Step 4 is then responsible for minting the real GitHub issue id (via `scripts/github.sh create`) before committing.
- **STATUS=new + NEEDS_FETCH=true** — a numeric ID was provided; proceed to Step 2 to fetch it from GitHub before writing.
- **STATUS=new** (no NEEDS_FETCH) — proceed directly to Step 3 with the given/inferred title.

## Step 2 — Fetch from GitHub when a numeric ID was given

Only when `NEEDS_FETCH=true`, run:

```bash
scripts/github.sh fetch "$REPO_PATH" <id>
```

> Resolve `scripts/github.sh` relative to the `auto-new-issue` skill folder.

- **Success:** the script saves the raw GitHub body into a temporary file under `docs/agents/issues/` and prints `TITLE`, `FILE`, `DOMAIN`, `REPO`. Use the fetched `TITLE` and body content as the starting material for Step 3.
- **Failure (issue not found):** proceed with just the title already known from Step 1 (or `TODO: untitled issue` if none), with no GitHub content. Do not stop and do not ask the user anything. This is **not** a failed exit: do not print a `failed` report here.

## Step 3 — Write the issue file

Read [write_issue.md](write_issue.md) and follow the instructions there to build and save the issue file content.

## Step 4 — Commit the issue file

Read [commit_and_sync.md](commit_and_sync.md) and follow the instructions there to commit the file and sync it to GitHub.
