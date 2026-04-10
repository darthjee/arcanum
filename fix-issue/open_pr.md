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

Use `gh pr create` to open the pull request with:
- **Title:** `Fix #<id> — <issue title>`
- **Body:** a markdown summary including the issue description and the main implementation steps from the plan

Example:

```bash
gh pr create --title "Fix #<id> — <title>" --body "$(cat <<'EOF'
## Issue
<brief issue description>

## Plan
<main implementation steps>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After the PR is created, return the PR URL to the user.
