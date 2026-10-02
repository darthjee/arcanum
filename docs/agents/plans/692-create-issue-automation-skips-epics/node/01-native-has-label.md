# Native `has-label` command

Replace `AutoFixAllGithub#hasShipitLabel(id)` with `hasLabel(id, name)`. Usage error: `Usage: github.sh has-label <repo_path> <id> <name>` when `repoPath`, `id` or `name` is missing. Wrap `IssueTagger#hasLabel(id, name)` in the same way: any failure or a missing label throws `DispatchFailure('', 1)`, and a match returns `''`. Check that `IssueTagger#hasLabel` already compares case-insensitively. If it does not, make it.

In `core/lib/core/commands.js`, replace the `auto-fix-all-github-has-shipit-label` entry with `auto-fix-all-github-has-label` (`method: 'hasLabel'`, `context: 'repo'`) and update the header comment's subcommand list. Update the class and JSDoc comments that mention `hasShipitLabel`.

## Files to Change
- `core/lib/commands/auto-fix-all/AutoFixAllGithub.js` — `hasShipitLabel` → `hasLabel(id, name)`.
- `core/lib/core/commands.js` — registry key swap.
- `core/lib/utils/issue/IssueTagger.js` — only if the case-insensitive match is missing.
