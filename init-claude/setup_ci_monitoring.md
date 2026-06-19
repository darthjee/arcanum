# Setup CI Monitoring Options

Configure which CI check-runs should never block a PR from being merged when `auto-fix-all` monitors it.

## Step 1 — Ask the user

```
Are there any CI check-runs that should never block a PR from being merged (e.g. informational bots, code-quality dashboards that don't report a clean pass/fail)? List any name patterns to ignore, or say none.
```

Wait for the response. Patterns are matched case-insensitively as regular expressions against each check-run's name (e.g. `Codacy` matches "Codacy Static Code Analysis").

## Step 2 — Write the configuration

- If the user listed one or more patterns: write `.claude/configuration/auto-fix-all.json` (creating `.claude/configuration/` if needed):
  ```json
  {
    "ignored_check_patterns": ["<pattern-1>", "<pattern-2>"]
  }
  ```
- If the user said none: do not write the file at all — its absence already means no patterns are ignored, so there's nothing to record.

## Step 3 — Confirm

If the file was written, tell the user:

```
.claude/configuration/auto-fix-all.json written, ignoring CI check-runs matching: <pattern-1>, <pattern-2>
```

If no file was written, no message is needed — silently proceed.
