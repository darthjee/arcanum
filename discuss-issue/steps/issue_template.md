# Issue File Template

The literal template lives at [../templates/issue.tmpl.md](../templates/issue.tmpl.md). Render it with:

```bash
../scripts/render_issue.sh <output_file> "<title>" "<description_section>" "<problem_section>" "<expected_behavior_section>" "<solution_section>" "<benefits_section>"
```

> Resolve `../scripts/render_issue.sh` relative to this file's directory.

Each `<..._section>` argument is the **full block** including its own `## Heading` line (e.g. `"## Description\nSome text."`). Pass `""` for any section that isn't relevant — the script drops it and collapses the resulting blank lines, so the output never has empty headings.

There is no "See issue for details" link in the rendered output — unlike `new-issue`, discuss-issue always starts from an existing GitHub issue, so a self-referential link back to that same issue is redundant.

Issue status (e.g. pre-approval, pipeline stage) is tracked via real GitHub labels on the live issue — see [../../docs/agents/architecture.md](../../docs/agents/architecture.md)'s "Issue Tags" section — not via anything embedded in this file's content.
