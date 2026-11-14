# Setup Commit Attribution Policy

Make sure the repo's `AGENTS.md` carries the commit co-author policy line, so arcanum's resolved co-author config overrides Claude Code's own attribution reminder. This step is silent/best-effort — it never blocks the rest of `init-claude`.

## Step 1 — Ensure the policy line

Run:

```bash
scripts/ensure_coauthor_policy.sh "$REPO_PATH"
```

> Resolve `scripts/ensure_coauthor_policy.sh` relative to the `init-claude` skill folder. `REPO_PATH` is the value resolved at the top of `SKILL.md`.

The script prints one of:

- `COAUTHOR_POLICY=added` — tell the user one line: the commit-attribution line was added to `AGENTS.md`.
- `COAUTHOR_POLICY=present` or `COAUTHOR_POLICY=no-agents-md` — say nothing.

If the script exits non-zero, say one line that the commit-attribution policy could not be set up, and continue.

## Step 2 — No confirmation needed

This step never asks the user anything — just continue to the next step regardless of the outcome.
