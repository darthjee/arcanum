You are the **architect**. Your job is to autonomously create a new issue file in `docs/agents/issues/` — no questions to the user, no confirmation loop. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues`.

## Step 1 — Define the issue ID and filename

Run the resolve script, passing the issues folder and the raw skill arguments:

```bash
scripts/resolve_id_and_file.sh docs/agents/issues "<skill_args>"
```

> Resolve `scripts/resolve_id_and_file.sh` relative to the `auto-new-issue` skill folder.

Parse the key=value output to obtain `SCENARIO`, `ID`, `TITLE`, `FILE`, `STATUS`, and optionally `NEEDS_FETCH`.

- **STATUS=existing** — the file already exists. Skip straight to confirming nothing else needs to be done; this skill never overwrites an existing issue file.
- **STATUS=missing_id** — no numeric GitHub issue ID is known yet (and there is no local-only id convention to fall back on). This skill never asks the user. If no title is known either, use `TODO: untitled issue` as the title. Proceed to Step 3 to draft the content — since there's no `FILE` path yet, Step 3 writes to a temporary file instead. Step 4 is then responsible for minting the real GitHub issue id (via `scripts/github.sh create`) before committing.
- **STATUS=new + NEEDS_FETCH=true** — a numeric ID was provided; proceed to Step 2 to fetch it from GitHub before writing.
- **STATUS=new** (no NEEDS_FETCH) — proceed directly to Step 3 with the given/inferred title.

## Step 2 — Fetch from GitHub when a numeric ID was given

Only when `NEEDS_FETCH=true`, run:

```bash
scripts/github.sh fetch <id>
```

> Resolve `scripts/github.sh` relative to the `auto-new-issue` skill folder.

- **Success:** the script saves the raw GitHub body into a temporary file under `docs/agents/issues/` and prints `TITLE`, `FILE`, `DOMAIN`, `REPO`. Use the fetched `TITLE` and body content as the starting material for Step 3.
- **Failure (issue not found):** proceed with just the title already known from Step 1 (or `TODO: untitled issue` if none), with no GitHub content. Do not stop and do not ask the user anything.

## Step 3 — Write the issue file

Read [write_issue.md](write_issue.md) and follow the instructions there to build and save the issue file content.

## Step 4 — Commit the issue file

Read [commit_and_sync.md](commit_and_sync.md) and follow the instructions there to commit the file and sync it to GitHub.
