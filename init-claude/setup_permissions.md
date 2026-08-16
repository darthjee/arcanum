# Setup the `shipit`-Merge Permission Exemption

Optionally seed the `shipit`-preapproved merge permission exemption into this freshly onboarded repo's shared, committed `.claude/settings.json`, so `auto-fix-all` can go fully end-to-end on `shipit`-labeled issues from day one, instead of waiting for the `arcanum/migrations/repos/next/002.sh` migration to run separately (see issue #170).

## Step 1 — Ask the user

```
Would you like to grant auto-fix-all/scripts/wait_ci_and_merge.sh permission to run without confirmation, for shipit-preapproved issues, in this repo's shared .claude/settings.json (committed, visible to all contributors)? [y/n]
```

If the user says no, skip silently — do not write anything.

## Step 2 — Explain

If the user has not already seen the rationale (e.g. via the `arcanum/migrations/repos/next/002.md` prompt), explain in plain language:

- The `shipit` label pre-approves an issue's whole PR lifecycle in `auto-fix-all`, including the final merge — but Claude Code's own permission classifier still confirms the merge call unless this exemption is granted.
- The exemption is scoped to exactly one script, `auto-fix-all/scripts/wait_ci_and_merge.sh`, used only on the `shipit`-preapproved path. It does not exempt `gh`/git write operations broadly, and the normal human-review-approved merge path (a separate `scripts/github.sh pr-merge` call) is untouched and still confirmed.
- This value gets committed to `.claude/settings.json` and is visible to every contributor.

## Step 3 — Write the exemption

On yes, run:

```bash
../arcanum/_lib/permission_grant.sh add .claude/settings.json "Bash(auto-fix-all/scripts/wait_ci_and_merge.sh *)"
```

> Resolve `../arcanum/_lib/permission_grant.sh` relative to the `init-claude` skill folder.

This appends the pattern to `.permissions.allow` in the target repo's `.claude/settings.json`, deduped, without disturbing any other content already in that file.
