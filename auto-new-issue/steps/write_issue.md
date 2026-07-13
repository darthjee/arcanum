# Write the Issue File

Write the issue file directly to `FILE` (the path resolved in Step 1) — never ask the user for a description, and never wait for confirmation. This skill is fully autonomous.

When Step 1's `STATUS` was `missing_id`, there is no `FILE` yet — write the content to a temporary file instead (e.g. via `mktemp`), and pass that path forward to [commit_and_sync.md](commit_and_sync.md), which mints the real GitHub issue id from it.

**Always write the file content in English**, regardless of the language of the title or of any fetched GitHub content. Translate if needed.

## Template

Use this structure (adapted from the Context/What/Acceptance-criteria shape used by Majora's autonomous issue flow, kept consistent with this repo's emphasis on concrete, actionable issue files):

```markdown
# <Title>

## Context

<Why this issue exists — the problem or opportunity that motivates it.>

## What needs to be done

<Concrete description of the work. Break it down by layer or component when it makes sense
(e.g. Backend: ..., Frontend: ..., Docs: ...).>

## Acceptance criteria

- [ ] <Measurable condition 1>
- [ ] <Measurable condition 2>
```

## Filling the template

- **When GitHub content is available** (Step 2 succeeded): adapt the fetched `body` into the structure above — do not paste it verbatim. Infer "Context" and "What needs to be done" from the body's content, and extract or infer acceptance criteria from it. If the body already contains a checklist, reuse it under "Acceptance criteria".
- **When no GitHub content is available**: infer the best possible description from the title alone. Write a plausible "Context" and "What needs to be done" based on what the title implies. Leave "Acceptance criteria" as:
  ```markdown
  - [ ] TODO
  ```

Save the result at `FILE`, overwriting only if the file did not already exist (per `STATUS=new` from Step 1 — this step is never reached when `STATUS=existing`).
