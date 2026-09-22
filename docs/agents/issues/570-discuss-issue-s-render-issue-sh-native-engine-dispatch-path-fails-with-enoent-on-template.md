# Issue: discuss-issue's render_issue.sh (native engine_dispatch path) fails with ENOENT on template

## Description
When `engine.mode=native` is configured, `discuss-issue/scripts/render_issue.sh` dispatches to the native `discuss-issue-render-issue` command (`core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js`) via `core/bin/arcanum`. That command fails with `ENOENT: no such file or directory, open '<repo>/discuss-issue/templates/issue.tmpl.md'` instead of rendering the issue template, leaving the output file untouched.

## Problem
`DiscussIssueRenderIssue.js` resolves the template path as `path.join(this._repoContext.repoPath, 'discuss-issue', 'templates', 'issue.tmpl.md')` — i.e. relative to the *target* repo (`repoPath`, the project discuss-issue is being run against), not relative to the arcanum install itself. The shell counterpart, `render_issue_shell.sh`, resolves the same template relative to its own script directory (`$SCRIPT_DIR/../templates/issue.tmpl.md`), which is always correct regardless of where arcanum is installed (a project-local checkout or a global skills directory such as `~/.claude-darthjee/skills`). This is the same bug class already fixed once for a different command in #319 (`arcanum-split-issue`'s finish step spawning `github.sh` with a `repoPath`-relative path instead of an install-relative one).

The existing unit spec (`DiscussIssueRenderIssue_spec.js`) and parity spec (`discussIssueRenderIssueParity_spec.js`) both mask this bug: they create a fixture template at `<tempRepoPath>/discuss-issue/templates/issue.tmpl.md` — exactly the buggy, repoPath-relative location — so they pass regardless of whether the code resolves against `repoPath` or the real install root.

## Expected Behavior
With `engine.mode=native` configured, `discuss-issue-render-issue` renders `discuss-issue/templates/issue.tmpl.md` from the arcanum install (not the target repo) and writes byte-identical output to the shell implementation, for any `repoPath` — including one that has no `discuss-issue/` folder of its own.

## Solution
Resolve the template path via `resolveInstallPath` from `core/lib/utils/file/InstallRoot.js` — the helper `AutoFixAllReplyComment.js` already uses for its own template (`resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md')`) — instead of `path.join(this._repoContext.repoPath, ...)`:

```js
const templatePath = resolveInstallPath('discuss-issue', 'templates', 'issue.tmpl.md');
```

Drop the now-unused `path` import from `DiscussIssueRenderIssue.js` if nothing else in the file needs it.

Update `DiscussIssueRenderIssue_spec.js` and `discussIssueRenderIssueParity_spec.js` so they stop writing a fixture template into `<repoPath>/discuss-issue/templates/` (the masking setup) and instead exercise resolution against the real install root, the same way the parity spec's `REAL_TEMPLATE` constant already does for the shell side — so a future regression of this same kind fails the suite instead of passing silently.

## Benefits

- `discuss-issue`'s render step works correctly for any repo/user with `engine.mode=native` configured (currently the case in this repo's own global config), instead of failing loud with an ENOENT mid-dialogue.
- Closes the test gap that let this exact bug class ship silently, consistent with the precedent already set for `auto-fix-all` in #319.
