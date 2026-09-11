# Create the native command

Add `AutoFixIssueCreateBranch`, the native equivalent of `create_branch_shell.sh`, under `commands/` with `context: 'repo'` (constructor receives a `RepoContext` bound to `repoPath`, per `docs/agents/architecture/script-engine.md`'s "core/ package layout").

- `run(planDir, id)`: resolve `planFile = path.join(repoContext.repoPath, planDir, 'plan.md')`.
- Read `planFile` if it exists (guard with `fs.access`/try-catch around `fs.readFile`, no throw on missing file).
- Re-derive the shell's `grep -A2 '^## Branch' | tail -1 | tr -d '`[:space:]'` natively: find the `## Branch` line, take the next non-empty line, strip backticks and whitespace.
- Branch name is `issue-<id>` whenever the plan file doesn't exist, has no `## Branch` section, or the extracted name is empty — same fallback rules as the shell script.
- Decide checkout vs. create: run `git show-ref --verify --quiet refs/heads/<branch>` via `execFile`/`spawn` with an argument array (never string-interpolated `exec()`); on success (exit 0) run `git checkout <branch>`, otherwise `git checkout -b <branch>`, both via the same array-argument `execFile`/`spawn`.
- Return the branch name as a plain string — `core/bin/arcanum`'s `dispatch()` prints it to stdout with exit code 0. Let any `git` failure propagate as a thrown `Error` (no `DispatchFailure` needed — the shell script has no "print partial stdout but still fail" case here).
- Accept an injectable `execFileAsync`-shaped dependency (and any other collaborator needed for testing), matching `AutoFixIssueCommitChange.js`'s constructor-injection pattern.

## Files to Change
- `core/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch.js` — new file, per the above.
