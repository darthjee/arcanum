# Scaffold and write the deprecation migration

Run `arcanum/migrations/generate_next.sh --type instructions` from the repo root. With `next/migrations.json` currently `[]`, it creates id `001`, appends the manifest entry, and creates `001.md` and `001.instructions.md` skeletons.

Then:

1. **Manifest:** edit the new entry in `arcanum/migrations/repos/next/migrations.json` to `"applies_to": "global"` (the scaffold default is `"local"`) and keep `"skippable": true`.

2. **`001.md`**, the human-facing summary shown at the `[R]un/[S]kip/[C]hat` prompt. Match the shape of `arcanum/migrations/repos/0.13.0/002.md`, with a title line and a short paragraph that says:
   - the `shell` engine is deprecated and will be removed in a future arcanum release;
   - switch to `native` (requires Node.js) or, once it is implemented, `docker`;
   - with no action, arcanum will pick an engine automatically when shell is removed (native if Node is available, else docker, else a hard error). Link to `docs/agents/specs/shell-engine-removal.md` for details;
   - this prompt is shown once per machine.

3. **`001.instructions.md`**, the AI-facing content, in the numbered-steps shape of `0.13.0/002.instructions.md`:
   1. Resolve the current `engine.mode` per tier: local `.claude/state/arcanum-config.json`, repo `.claude/configuration/arcanum-repo-config.json`, and global `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` (read `.engine.mode` with `jq`). Report the effective value and which tier it comes from.
   2. If the effective value is already `native` or `docker`, say nothing is needed and finish without changes.
   3. Check `command -v node` and `command -v docker`. Docker is for information only.
   4. Offer three choices:
      - **native** (recommended when Node is available; warn if it isn't);
      - **docker** (note that today it still falls back to shell, per `arcanum/_lib/engine_dispatch.sh`);
      - **decide later**.
   5. For native or docker, write the value to the global tier only via `global_config_write`: `bash -c 'source <arcanum>/_lib/global_config.sh && global_config_write "$REPO_PATH" engine mode "\"native\""'`, resolving the arcanum install path as other instructions do. Never edit the JSON by hand. Then, if a local or repo tier explicitly sets `engine.mode` (step 1), tell the user that tier still overrides the global value and name the file to change. Don't edit repo or local tiers yourself.
   6. For "decide later", change nothing and restate the future automatic detection rule.
   7. State that this migration is shown only once per machine: the global pointer advances whichever choice is made.

## Files to Change

- `arcanum/migrations/repos/next/migrations.json`: new entry `001` (`type: instructions`, `applies_to: global`, `skippable: true`).
- `arcanum/migrations/repos/next/001.md`: new human-facing summary.
- `arcanum/migrations/repos/next/001.instructions.md`: new AI-facing instructions.
