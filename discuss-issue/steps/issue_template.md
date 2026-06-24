# Issue File Template

The literal template lives at [../templates/issue.tmpl.md](../templates/issue.tmpl.md). Render it with:

```bash
../scripts/render_issue.sh <output_file> "<title>" "<description_section>" "<problem_section>" "<expected_behavior_section>" "<solution_section>" "<benefits_section>" "<tags_block>"
```

> Resolve `../scripts/render_issue.sh` relative to this file's directory.

Each `<..._section>` argument is the **full block** including its own `## Heading` line (e.g. `"## Description\nSome text."`). Pass `""` for any section that isn't relevant — the script drops it and collapses the resulting blank lines, so the output never has empty headings. `<tags_block>` is the raw `Tags: ...` line(s) with no leading `---`; pass `""` when there's nothing to carry over.

There is no "See issue for details" link in the rendered output — unlike `new-issue`, discuss-issue always starts from an existing GitHub issue, so a self-referential link back to that same issue is redundant.

## Tags line

If a prior `fetch` (in [extract_id_and_name.md](extract_id_and_name.md)) printed a `TAGS_BEGIN`/`TAGS_END` block, pass its content verbatim as `<tags_block>` — the script appends it as:

```markdown
---

Tags: <list of tags>
```

Tags are free-form `:word:` tokens (e.g. `:shipit:`) read by other skills — see the general explanation in [../../docs/agents/architecture.md](../../docs/agents/architecture.md)'s "Issue Tags" section. Never invent this block; only carry it over verbatim when the fetch produced one.
