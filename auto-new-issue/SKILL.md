---
name: auto-new-issue
description: Autonomously creates a new issue file in the project's issues folder, without asking the user anything. Parses an optional ID and title, infers a structured description (pre-populating from GitHub when a numeric ID is given), saves the file, commits it, and syncs it to GitHub. Usage: /auto-new-issue #19 - Title or /auto-new-issue Title
---

You are acting as the **architect**. Your job is to autonomously create a new issue file in `docs/agents/issues/` — no questions to the user, no confirmation loop. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues`.

## Step 1 — Define the issue ID and filename

Run the resolve script, passing the issues folder and the raw skill arguments:

```bash
scripts/resolve_id_and_file.sh docs/agents/issues "<skill_args>"
```

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

- **Success:** the script saves the raw GitHub body into a temporary file under `docs/agents/issues/` and prints `TITLE`, `FILE`, `DOMAIN`, `REPO`. If the body ended with a trailing `---`/`tags: ...` block, that block is stripped from the saved body and instead printed between `TAGS_BEGIN`/`TAGS_END` markers — carry it forward to Step 3, which re-appends it verbatim at the end of the final file. Use the fetched `TITLE` and the (now tags-stripped) body content as the starting material for Step 3.
- **Failure (issue not found):** proceed with just the title already known from Step 1 (or `TODO: untitled issue` if none), with no GitHub content. Do not stop and do not ask the user anything.

## Step 3 — Write the issue file

Read [steps/write_issue.md](steps/write_issue.md) and follow the instructions there to build and save the issue file content.

## Step 4 — Commit the issue file

Read [steps/commit_and_sync.md](steps/commit_and_sync.md) and follow the instructions there to commit the file and sync it to GitHub.
