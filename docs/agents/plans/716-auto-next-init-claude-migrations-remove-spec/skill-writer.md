# Skill Writer Plan: Auto-next: init-claude, migrations, remove spec

Main plan: [plan.md](plan.md)

## Shared contracts

- **Keys**: `next_step.auto.enhance-issue`, `next_step.auto.discuss-issue` and `next_step.auto.auto-plan-issue`, booleans that default to `false`, written to **repo config** (`.claude/configuration/arcanum-repo-config.json`, committed).
- **Writer**: `init-claude/scripts/set_next_step_auto.sh "$REPO_PATH" <skill> true|false`, a native-only shim. Success prints `NEXT_STEP_AUTO=<skill>=<value>` and exits `0`. A usage error exits `1`.

## Implementation Steps

### Step 1 — New `init-claude/setup_auto_next.md`

Write a review-and-confirm step modeled on `init-claude/setup_auto_fix_all_settings.md`:

1. **Read current values** from repo config, e.g. `jq -r '.next_step.auto["enhance-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null`. A missing file, a missing key or any non-`true` value counts as `false`.
2. **Render one table** with three rows (key, tier `repo (committed)`, current value, description of the offer it skips):
   - `enhance-issue` skips `/discuss-issue <id>`, never for an Epic;
   - `discuss-issue` skips `/auto-plan-issue <id>`;
   - `auto-plan-issue` skips `/loop /auto-resolve-issue <id>` once a plan exists.

   Mention that a `true` key turns that offer into an automatic chained run. Also mention that a user can still override a key per clone (local state) or for every repo (global config), and point to `/arcanum-migrate`'s auto-next migrations and `/arcanum-check-config next_step.auto.<skill>`.
3. **Confirm as a whole**, looping on the rows the user names, with the same rules as `setup_auto_fix_all_settings.md` Step 3.
4. **Apply** only the rows edited in this pass: `scripts/set_next_step_auto.sh "$REPO_PATH" <skill> true|false` (resolved relative to the `init-claude` skill folder). If a call exits non-zero, report it and continue with the other rows.
5. **Report** what was written, row by row, or that nothing changed.

### Step 2 — Wire it into `init-claude/SKILL.md`

Insert the new step right after Step 9 (`setup_auto_fix_all_settings.md`) as "Step 10 — Setup auto-next", and renumber the following steps (labels → 11, permissions → 12, issue enhancement → 13, arcanum-split-issue → 14, version stamp → 15). Update each "After the … are set up" sentence so the chain still reads correctly. Add the new step to the `REPO_PATH` threading sentence at the top of `SKILL.md`, and fix any other step-number references in `init-claude/` (grep for `Step 1[0-4]`).

## Files to Change

- `init-claude/setup_auto_next.md`: new step.
- `init-claude/SKILL.md`: new Step 10, renumbering, and `REPO_PATH` threading.

## Notes

- Keep the logic in the shim, not as inline bash. The `jq` reads mirror the existing settings step's pre-populate pattern. The skill-reviewer may flag them, so keep them one line per key.
