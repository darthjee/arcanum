# Setup CI Monitoring Options

Configure which CI check-runs should never block a PR from being merged when `auto-fix-all` monitors it.

## Step 1 — Ask the user

```
Are there any CI check-runs that should never block a PR from being merged (e.g. informational bots, code-quality dashboards that don't report a clean pass/fail)? List any name patterns to ignore, or say none.
```

Wait for the response. Patterns are matched case-insensitively as regular expressions against each check-run's name (e.g. `Codacy` matches "Codacy Static Code Analysis").

## Step 2 — Write the configuration

- If the user listed one or more patterns, run:
  ```bash
  scripts/set_ci_ignored_patterns.sh "<pattern-1>" "<pattern-2>"
  ```
  > Resolve `scripts/set_ci_ignored_patterns.sh` relative to the `init-claude` skill folder. This writes `ignored_check_patterns` into `.claude/configuration/arcanum-repo-config.json`'s `auto-fix-all` namespace (creating the file, and `.claude/configuration/`, if needed) — see `docs/guides/arcanum-repo-config.md` for the config-file layout. It never touches the legacy `.claude/configuration/auto-fix-all.json` file.
- If the user said none: do not run the script at all — the absence of `ignored_check_patterns` already means no patterns are ignored, so there's nothing to record.

## Step 3 — Confirm

If the script was run, tell the user:

```
.claude/configuration/arcanum-repo-config.json written, ignoring CI check-runs matching: <pattern-1>, <pattern-2>
```

If the script was not run, no message is needed — silently proceed.
