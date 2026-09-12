## Description

Sub-issue of #446 (batch overview). Part of the `discuss-issue` family — migrating `discuss-issue/scripts/render_issue.sh` (42 lines) to a native Node.js implementation, per the [Script Engine migration](docs/agents/architecture/script-engine.md).

### Source script

`discuss-issue/scripts/render_issue.sh` — renders the issue template (`discuss-issue/templates/issue.tmpl.md`) into an output file. Usage: `render_issue.sh <output_file> <title> [description] [problem] [expected_behavior] [solution] [benefits]`.

- Each section argument is the full block including its own `## Heading` line (e.g. `"## Description\nSome text"`); an empty string (`""`) omits that section entirely.
- Reads the template, replaces `%%TITLE%%`, `%%DESCRIPTION%%`, `%%PROBLEM%%`, `%%EXPECTED_BEHAVIOR%%`, `%%SOLUTION%%`, `%%BENEFITS%%` placeholders with the corresponding argument (empty string when omitted).
- Collapses the blank-line runs left behind by omitted sections down to a single blank line (`perl -0777 -pe 's/\A\n+//; s/\n+\z/\n/; s/\n{3,}/\n\n/g'`), trims leading/trailing blank lines, and writes the result to `<output_file>`.
- Exits 1 with a `Usage:` message on stderr if `<output_file>` or `<title>` is missing/empty.

## Solution

Follow `docs/agents/architecture/script-engine.md`:

1. Read `discuss-issue/scripts/render_issue.sh` and `discuss-issue/templates/issue.tmpl.md` in full — the template's exact placeholder names and the blank-line collapsing behavior are the parts most likely to diverge if re-derived from memory instead of read directly.
2. Create `core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js` (zero runtime deps, built-in Node APIs only). The template file is read from disk at `<skill>/templates/issue.tmpl.md`, resolved relative to the repo root the same way the shell script resolves it relative to its own script location — not hardcoded.
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'discuss-issue-render-issue': { module: 'commands/discuss-issue/DiscussIssueRenderIssue.js', method: 'run', context: 'repo' }` (needs `repoPath` to locate the template and write the output file).
4. Add `"discuss-issue-render-issue": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/lib/commands/discuss-issue/DiscussIssueRenderIssue_spec.js`, covering: all sections present, each section individually omitted, multiple consecutive omissions (verifying the blank-line collapse), and the missing-argument usage-error path.
6. Write a parity test at `core/spec/bin/discussIssueRenderIssueParity_spec.js` (shell vs. native, identical output-file content and exit code).
7. Extract the current logic to `discuss-issue/scripts/render_issue_shell.sh`, replace `discuss-issue/scripts/render_issue.sh` with a thin `engine_dispatch.sh` shim, and verify it routes correctly for `engine.mode=native` and `engine.mode=shell`.

### External dependencies

- Reads `discuss-issue/templates/issue.tmpl.md` (a static file shipped with the skill, not user data).
- Writes to `<output_file>` — no other filesystem or network access.

### Dependencies on other sub-issues

None in this batch — fully independent.
