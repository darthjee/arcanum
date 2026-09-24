# Implement and register the native commands

`core/lib/commands/init-claude/InitClaudeWriteLabelConfig.js`:
- Its constructor takes a `RepoContext`, with an injectable `LabelConfig`.
- `replace(configPath, ...pairs)` and `add(configPath, ...pairs)` validate every pair first. On the first failure, write the message plus `\n` to stderr and throw `DispatchFailure('', 2)`.
- `remove(configPath, ...names)` rejects any name containing `:` the same way.
- On success, all three return `''`.

`core/lib/commands/init-claude/InitClaudeSyncLabels.js`:
- Injectable `LabelConfig`, stdin line reader, stdout writer, and a `GitHubClient` factory built lazily from the context.
- `run(configPath)`:
  - `ensureDefaults`, then `readPairs`, then validate each pair. On an invalid pair, write the stderr message plus the two usage lines, then throw `DispatchFailure('', 2)`.
  - Write the table, then prompt and loop.
  - EOF: write the stderr error, then throw `DispatchFailure('', 2)`. No: throw `DispatchFailure('STATUS=discuss\n', 1)`.
  - Yes: list the existing names, write `STATUS=synced\n`, then for each label find a case-insensitive match. On a match, `updateLabel(match, name, color)` and write `UPDATED=`; otherwise `createLabel` and write `CREATED=`.
  - Write each line as it happens, so a mid-sync failure leaves the same partial stdout as the shell side. Return `''`.

Register all four entries in `core/lib/core/commands.js`. Extend the `init-claude-*` family list in the `context: 'repo'` doc comment to include write-label-config-replace/-remove/-add and sync-labels, and update `core/spec/lib/core/commands_spec.js`.

## Files to Change
- `core/lib/commands/init-claude/InitClaudeWriteLabelConfig.js` — new
- `core/lib/commands/init-claude/InitClaudeSyncLabels.js` — new
- `core/lib/core/commands.js` — four entries + doc comment
- `core/spec/lib/core/commands_spec.js` — registry expectations
