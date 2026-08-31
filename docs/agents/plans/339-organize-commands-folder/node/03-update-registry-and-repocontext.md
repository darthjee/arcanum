# Update the command registry and RepoContext

`core/lib/core/commands.js` is the single source of truth mapping each CLI command name to its implementing module, so every `module:` path must be updated to the new subfolder location from Step 1 — command names themselves (the object keys) do not change. Its own header JSDoc also gives a stale example path that needs updating. Separately, `core/lib/context/RepoContext.js` has the one static import elsewhere in the codebase that hardcodes a `commands/` path outside the registry.

## Files to Change

- `core/lib/core/commands.js` — update every `module:` value to include the new subfolder prefix, e.g. `module: 'commands/SpawnIssue.js'` → `module: 'commands/shared/SpawnIssue.js'`, `module: 'commands/ArcanumSplitIssueFinish.js'` → `module: 'commands/arcanum-split-issue/ArcanumSplitIssueFinish.js'`, and so on for all 23 entries per Step 1's mapping; also update the header JSDoc's example path (`commands/SpawnIssue.js`) to `commands/shared/SpawnIssue.js`
- `core/lib/context/RepoContext.js` — change `import GithubIssue from '../commands/GithubIssue.js';` to `import GithubIssue from '../commands/shared/GithubIssue.js';`
