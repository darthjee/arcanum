# skill-writer Plan: Migrate auto-fix-all-config entrypoint (get, is-enabled, set, toggle) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See `plan.md`'s "Shared contracts", "New CLI signature". `scripter`'s new `config.sh` shim requires `repo_path` as its 2nd positional argument: `config.sh <get|is-enabled|set|toggle> <repo_path> <key> [<value>]`. This agent updates the 3 existing call sites (found by grepping every `.md` caller of `auto-fix-all/scripts/config.sh`, excluding `monitor-issues/scripts/config.sh` which is a different, out-of-scope script) to pass it. Every one of these call sites already has `$REPO_PATH` resolved in its own scope — none need a new resolution step, just threading it into the existing call.

## Implementation Steps

### Step 1 — auto-fix-all/SKILL.md (2 call sites)

`REPO_PATH` is already resolved at Step 0 and threaded through every script call in this file. Update both:

- Line ~49: `scripts/config.sh is-enabled finish_on_empty_queue` → `scripts/config.sh is-enabled "$REPO_PATH" finish_on_empty_queue`
- Line ~58: `scripts/config.sh is-enabled clear_context` → `scripts/config.sh is-enabled "$REPO_PATH" clear_context`

### Step 2 — init-claude/setup_auto_fix_all_settings.md

Called from `init-claude/SKILL.md`, which resolves `REPO_PATH` at its own top (Step 1) but currently only threads it explicitly into Step 10 (`setup_labels.md`) — `init-claude/SKILL.md`'s own note listing which steps need `$REPO_PATH` threaded must be updated to also include the step that reads this file, since it now needs it too.

In `init-claude/setup_auto_fix_all_settings.md`'s Step 4, update both calls:

```bash
../auto-fix-all/scripts/config.sh set "$REPO_PATH" clear_context true|false
../auto-fix-all/scripts/config.sh set "$REPO_PATH" finish_on_empty_queue true|false
```

### Step 3 — toggle-clear-context/SKILL.md

This skill runs entirely inline as the architect (no subagent spawn) and currently never resolves `REPO_PATH` at all — it's the one call site that needs a new resolution step, not just new threading, per `repo-path-threading.md`'s convention ("resolved exactly once, at the very top of a skill's run ... for a skill that runs entirely inline as the architect ... that's the first step of its own SKILL.md"). Add a new first step:

```markdown
## Step 1 — Resolve REPO_PATH

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd.

## Step 2 — Toggle the setting

Run:

\`\`\`bash
../auto-fix-all/scripts/config.sh toggle "$REPO_PATH" clear_context
\`\`\`
```

Renumber the existing "Step 2 — Report" to "Step 3 — Report".

## Files to Change

- `auto-fix-all/SKILL.md` — thread `"$REPO_PATH"` into both `config.sh is-enabled` calls.
- `init-claude/setup_auto_fix_all_settings.md` — thread `"$REPO_PATH"` into both `config.sh set` calls.
- `init-claude/SKILL.md` — update the Step-1 note listing which steps `$REPO_PATH` is threaded into, to include the step reading `setup_auto_fix_all_settings.md`.
- `toggle-clear-context/SKILL.md` — add a new `REPO_PATH="$(pwd)"` resolution step (this skill had no prior use for it), thread it into the `config.sh toggle` call, renumber the following step.

## Notes

- No other `.md` file in the repo calls `auto-fix-all/scripts/config.sh` (confirmed by grep across all `.md` files during planning) — `monitor-issues/scripts/config.sh` and its 2 call sites (`monitor-issues/SKILL.md`, `toggle-monitor-clear-context/SKILL.md`) are a separate script, untouched by this issue.
