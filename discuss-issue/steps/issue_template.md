# Issue File Template

The literal template lives at [../templates/issue.tmpl.md](../templates/issue.tmpl.md). Render it with:

```bash
../scripts/render_issue.sh "$REPO_PATH/$FILE" "<title>" "<description_section>" "<problem_section>" "<expected_behavior_section>" "<solution_section>" "<benefits_section>"
```

> Resolve `../scripts/render_issue.sh` relative to this file's directory. `<output_file>` must be passed as `"$REPO_PATH/$FILE"` (absolute) — `render_issue.sh` has no `cd`/ambient-cwd dependency of its own, but `$FILE` (as returned by `resolve_and_fetch.sh`) is a path relative to `REPO_PATH`, not to whatever the Bash tool's ambient cwd happens to be. Never pass the bare relative `$FILE`.

Each `<..._section>` argument is the **full block** including its own `## Heading` line (e.g. `"## Description\nSome text."`). Pass `""` for any section that isn't relevant — the script drops it and collapses the resulting blank lines, so the output never has empty headings.

There is no "See issue for details" link in the rendered output — unlike `new-issue`, discuss-issue always starts from an existing GitHub issue, so a self-referential link back to that same issue is redundant.

Issue status (e.g. pre-approval, pipeline stage) is tracked via real GitHub labels on the live issue — see [Issue Tags](../../docs/agents/architecture/issue-tags.md) — not via anything embedded in this file's content.
