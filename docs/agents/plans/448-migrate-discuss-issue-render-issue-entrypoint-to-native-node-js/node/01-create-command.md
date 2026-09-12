# Create the native command

Create `core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js`, the native counterpart of `discuss-issue/scripts/render_issue.sh` (see [plan.md](../plan.md)'s "Shared contracts" for the exact method signature and behavior).

Implementation notes:
- Constructed with a `RepoContext` (from `context: 'repo'`); use it to resolve the repo root and build the template path `<repoRoot>/discuss-issue/templates/issue.tmpl.md`.
- `run(outputFile, title, description = '', problem = '', expectedBehavior = '', solution = '', benefits = '')`:
  1. Throw a plain `Error` with a `Usage: ...`-style message if `outputFile` or `title` is missing/empty (mirrors `render_issue.sh`'s own guard; exact wording doesn't need to match byte-for-byte since stderr isn't part of the parity contract — see `docs/agents/architecture/script-engine.md`).
  2. Read the template file (`node:fs/promises` `readFile`, utf8).
  3. Replace `%%TITLE%%`, `%%DESCRIPTION%%`, `%%PROBLEM%%`, `%%EXPECTED_BEHAVIOR%%`, `%%SOLUTION%%`, `%%BENEFITS%%` (in that order) with the corresponding argument.
  4. Collapse blank-line runs: trim leading/trailing newlines, then collapse 3+ consecutive newlines to exactly 2 (one blank line) — same result as the shell script's `perl -0777 -pe 's/\A\n+//; s/\n+\z/\n/; s/\n{3,}/\n\n/g'`.
  5. Ensure the final content ends with a single trailing newline (the shell script's `printf '%s\n' ... > "$OUTPUT_FILE"` always appends one).
  6. Write the result to `outputFile` (`node:fs/promises` `writeFile`).
  7. Resolve with no return value.
- No `child_process` usage needed — this command is pure filesystem I/O.
- JSDoc on the class and `run` method, per the repo's ESLint config.

## Files to Change

- `core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js` — new native command implementing the render/substitute/collapse/write logic.
