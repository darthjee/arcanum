# Open PR for Issue

## Announce the intent

Tell the user:

```
A PR will be opened to fix issue #<id> — <title>.
```

## Present a summary

Present a concise summary (3–5 sentences) covering:
- What the issue is about
- What the plan proposes to implement or fix
- Any notable implementation steps or design decisions

## Open the PR

Write the PR body to a temporary file, then run:

```bash
~/.claude-darthjee/skills/fix-issue/scripts/github.sh pr-create "Fix #<id> — <title>" /tmp/pr_body_<id>.md
```

The script resolves the GitHub domain and repository from `git remote get-url origin`, so no manual `-R` argument is needed.

The PR body file should follow this structure:

```markdown
## Issue
<brief issue description>

## Plan
<main implementation steps>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

After the PR is created, return the PR URL to the user.
