# Issue File Template

```markdown
# Issue: <Title>

## Description
<Clear explanation of the issue>

## Problem
- <bullet points describing what is broken or missing>

## Expected Behavior
- <what should happen>

## Solution
- <suggested implementation steps, if applicable>

## Benefits
- <why this matters>
```

There is no "See issue for details" link in this template — unlike `new-issue`, discuss-issue always starts from an existing GitHub issue, so a self-referential link back to that same issue is redundant.

## Tags line

If a prior `fetch` (in [extract_id_and_name.md](extract_id_and_name.md)) printed a `TAGS_BEGIN`/`TAGS_END` block, append it verbatim at the very end of the file, separated from the body above by a blank line:

```markdown
---

Tags: <list of tags>
```

Tags are free-form `:word:` tokens (e.g. `:shipit:`) read by other skills — see the general explanation in [../../docs/agents/architecture.md](../../docs/agents/architecture.md)'s "Issue Tags" section. Never invent this line; only carry it over verbatim when the fetch produced one.
