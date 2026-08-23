# Wire into core/bin/arcanum and migration-status.json

Register all 7 subcommands and flip the migration-status flag now that `AutoFixAllGithub.js` (Steps 2–4) and `ConfigChain.js` (Step 1) are complete.

- Add to `core/bin/arcanum`'s `COMMANDS` map (alphabetical, matching the existing table's ordering convention):
  - `'auto-fix-all-github-pr-number': { module: 'AutoFixAllGithub.js', method: 'prNumber' }`
  - `'auto-fix-all-github-pr-state': { module: 'AutoFixAllGithub.js', method: 'prState' }`
  - `'auto-fix-all-github-pr-merge': { module: 'AutoFixAllGithub.js', method: 'prMerge' }`
  - `'auto-fix-all-github-cleanup-branch': { module: 'AutoFixAllGithub.js', method: 'cleanupBranch' }`
  - `'auto-fix-all-github-has-shipit-label': { module: 'AutoFixAllGithub.js', method: 'hasShipitLabel' }`
  - `'auto-fix-all-github-add-tag': { module: 'AutoFixAllGithub.js', method: 'addTag' }`
  - `'auto-fix-all-github-remove-tag': { module: 'AutoFixAllGithub.js', method: 'removeTag' }`
- Set `"auto-fix-all-github": true` in `arcanum/_lib/migration-status.json` (currently `false`).

## Files to Change

- `core/bin/arcanum` — add the 7 `COMMANDS` entries above.
- `arcanum/_lib/migration-status.json` — flip `"auto-fix-all-github"` to `true`.
