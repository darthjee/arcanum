# Skill-writer Plan: Migrate permission-grant to a constructor-injected ClaudeContext

Main plan: [plan.md](plan.md)

## Shared contracts

### `permission_grant.sh` CLI signature (this agent consumes it)

New form: `permission_grant.sh <anchor> add <file> <pattern>`. `<anchor>` is the
onboarded repo root. `init-claude` already resolves that path once at the top of
its run as `REPO_PATH` per
`docs/agents/architecture/repo-path-threading.md` — pass `"$REPO_PATH"`.

## Implementation Steps

### Step 1 — Add the leading anchor to `init-claude/setup_permissions.md`

Four `permission_grant.sh` invocations exist in this file (one in the first
`## Step 3 — Write the exemption`, three in the second). Change each from:

```bash
../arcanum/_lib/permission_grant.sh add .claude/settings.json "<pattern>"
```

to:

```bash
../arcanum/_lib/permission_grant.sh "$REPO_PATH" add .claude/settings.json "<pattern>"
```

Keep `.claude/settings.json` as the `<file>` argument (still the committed,
repo-relative project settings file — `ClaudeContext`/the shell path resolve it
against `<anchor>`/cwd respectively, both equal to the repo root here). Update
the surrounding prose only where it spells out the command shape, and confirm
the `> Resolve … relative to the init-claude skill folder` note still reads
correctly. If `REPO_PATH` is not already an established variable in this skill's
step files, use the same literal the rest of `init-claude` uses for the repo
root — check `init-claude/SKILL.md` / sibling steps and match their convention
rather than introducing a new name.

## Files to Change

- `init-claude/setup_permissions.md` — prepend `"$REPO_PATH"` (or the skill's
  existing repo-root reference) to all four `permission_grant.sh` invocations;
  adjust the explanatory prose to match.

## Notes

- No other CLI caller of `permission_grant.sh` exists — the
  `arcanum/migrations/repos/*/*.sh` scripts `source` the lib and call the
  `permission_grant_add` function directly, which is unchanged.
- No CI gate covers this markdown file; the skill-reviewer check applies if
  deterministic logic were being added (it is not — this is a one-token call-site
  edit).
