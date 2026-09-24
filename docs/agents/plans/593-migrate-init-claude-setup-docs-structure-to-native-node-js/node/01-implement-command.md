# Implement InitClaudeSetupDocsStructure

Create `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js`, following the shape of `InitClaudeSetupTemplates.js`: a class whose constructor takes `(repoContext, deps = {})` and has an `async run()` that returns the stdout string.

- Keep a frozen ordered list of `{ path, content }` entries (relative POSIX paths, exactly as printed) for the six files, with the placeholder contents copied verbatim from `setup_docs_structure_shell.sh`. `.gitkeep` content is `''`.
- For each entry, resolve `path.join(repoPath, relPath)`. If anything exists there (use `lstat`/`stat` and treat ENOENT as missing, matching `[[ -e ]]`; note that `-e` follows symlinks, so a dangling symlink counts as missing), push it to `skipped`. Otherwise `mkdir(dirname, { recursive: true })`, write `content + '\n'`, and push it to `created`.
- AGENTS.md: `stat` it. If it is a regular file, read it and test `/^## Documentation/m`. If there is no match, `appendFile` the verbatim section constant (starting with `\n## Documentation`, ending with the `plans/12_add-auth/plan.md` line + `\n`) and mark it updated. If it is not a regular file, write `Warning: AGENTS.md not found — skipping Documentation section append.\n` to stderr. Use an injectable `deps.stderr` (default `process.stderr`) so the unit spec can capture it.
- Build stdout per the contract: a `Created:` block, then an `Already existed (skipped):` block (each line `  <relPath>`), then the `AGENTS.md:` line (only when AGENTS.md is a regular file).
- Add JSDoc matching the sibling commands' style, naming `setup_docs_structure_shell.sh` as the byte-identical counterpart.

## Files to Change
- `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js` — new native command.
