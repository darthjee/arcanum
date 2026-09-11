# Add native AutoFixIssueListPlanAgents command

Add the native equivalent of `list_plan_agents_shell.sh`: a `context: 'repo'` command that takes `<plan_dir>` and returns the specialist-agent names, one per line.

Behavior contract (from the shell script):
- If `<plan_dir>` does not exist, return an empty result (no error) — exit 0, no stdout.
- Otherwise, list all `*.md` files directly inside `<plan_dir>` (non-recursive), excluding `plan.md` itself.
- Sort the matched files by full path (byte/locale order matching the shell's `sort`), then strip directory and `.md` extension to get each agent name.
- Print one agent name per line, in that sorted order; print nothing if no agent files remain after excluding `plan.md`.

Implement with built-in `fs`/`path` APIs only (`fs.readdirSync`/`fs.promises.readdir` + `path.join`/`path.basename`) — zero runtime deps, matching every other native command in this migration batch. `core/bin/arcanum` writes the returned string to stdout as-is (no added newline) — see the trailing-newline fix already needed for `AutoFixIssueCreateBranch` (#429) — so `run()` must join agent names with `\n` and append a final trailing newline itself when there is at least one name, and return an empty string when there are none.

## Files to Change
- `core/lib/commands/auto-fix-issue/AutoFixIssueListPlanAgents.js` — new file, the native command class/module (`context: 'repo'`, `run({ args })` or the equivalent shape used by sibling commands — follow `AutoFixIssueCreateBranch.js`'s exact structure).
