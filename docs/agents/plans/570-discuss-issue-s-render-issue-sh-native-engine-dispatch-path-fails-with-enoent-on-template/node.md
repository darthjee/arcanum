# Node Plan: discuss-issue's render_issue.sh (native engine_dispatch path) fails with ENOENT on template

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Resolve the template against the arcanum install root, not `repoPath`

In `core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js`, replace:

```js
const templatePath = path.join(this._repoContext.repoPath, 'discuss-issue', 'templates', 'issue.tmpl.md');
```

with a call to `resolveInstallPath` (`core/lib/utils/file/InstallRoot.js`), the same helper `AutoFixAllReplyComment.js` already uses for its own template (`resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md')`):

```js
const templatePath = resolveInstallPath('discuss-issue', 'templates', 'issue.tmpl.md');
```

Remove the now-unused `import path from 'node:path';` if nothing else in the file references `path`.

Follow `AutoFixAllReplyComment.js`'s constructor-injection convention for the filesystem call so the fix is actually testable without either touching the real production template or re-faking a template at a `repoPath`-relative path (the exact thing that hid this bug — see Step 2): accept an optional `readFile` dependency in the constructor, defaulting to the real `node:fs/promises` `readFile`, and use it instead of the directly-imported one:

```js
import { readFile as defaultReadFile, writeFile } from 'node:fs/promises';
// ...
constructor(repoContext, { readFile = defaultReadFile } = {}) {
  this._repoContext = repoContext;
  this._readFile = readFile;
}
// ...
const template = await this._readFile(templatePath, 'utf8');
```

`writeFile` stays a direct import — only the template read needs to be mockable for Step 2's spec changes.

### Step 2 — Stop masking the bug in the unit and parity specs

Both specs currently hide this bug by writing a fixture template into `<repoPath>/discuss-issue/templates/issue.tmpl.md` — exactly the buggy, `repoPath`-relative location — so they pass regardless of whether the code resolves against `repoPath` or the real install root.

**`core/spec/lib/commands/discuss-issue/DiscussIssueRenderIssue_spec.js`**: drop the `beforeEach`'s `mkdir(path.join(repoPath, 'discuss-issue', 'templates'), ...)` / `writeFile(path.join(repoPath, 'discuss-issue', 'templates', 'issue.tmpl.md'), TEMPLATE)` calls entirely. Instead, mirror `core/spec/support/factories/autoFixAllReplyComment.js`'s `fakeReadFile`/`TEMPLATE_PATH` pattern:

- Compute `TEMPLATE_PATH = resolveInstallPath('discuss-issue', 'templates', 'issue.tmpl.md')` (import `resolveInstallPath` from `../../../../lib/utils/file/InstallRoot.js`).
- Build a `readFile` stub (inline in this spec, or a small local helper following `fakeReadFile`'s shape) that returns the existing local `TEMPLATE` constant when called with `TEMPLATE_PATH`, and throws for any other path — this is what actually proves resolution is install-root-relative, since `repoPath` (the temp dir) no longer has any `discuss-issue/` folder at all.
- Pass it as `new DiscussIssueRenderIssue(new RepoContext({ repoPath }), { readFile })` in every test in this file (all 9 `it` blocks currently construct `DiscussIssueRenderIssue` inline).
- `repoPath` can keep being a bare temp dir (`createTempDir()`) with nothing written into it — `outputFile` still lives under it for the `writeFile` side, but no `discuss-issue/` subfolder is created there anymore.

**`core/spec/bin/discussIssueRenderIssueParity_spec.js`**: this one runs the real `core/bin/arcanum` binary (not the class directly), so it can't inject a fake `readFile` — instead, delete the `beforeEach`'s `mkdir(path.join(repoPath, 'discuss-issue', 'templates'), ...)` / `writeFile(path.join(repoPath, 'discuss-issue', 'templates', 'issue.tmpl.md'), templateContent)` calls (the `templateContent = await readFile(REAL_TEMPLATE, ...)` read can go too, since nothing consumes it once the write is gone). The native process will now read the template straight from its own true install location (`REAL_TEMPLATE`, already defined in this file and used to seed the old fixture) via `resolveInstallPath` inside `core/bin/arcanum`'s own process — the temp `repoPath` passed as the leading positional no longer needs a `discuss-issue/` folder at all, which is exactly what proves the fix: the shell and native paths now agree even though `repoPath` has nothing shell-shaped inside it.

## Files to Change

- `core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js` — resolve the template via `resolveInstallPath` instead of `this._repoContext.repoPath`; inject `readFile` as a constructor dependency; drop the unused `path` import.
- `core/spec/lib/commands/discuss-issue/DiscussIssueRenderIssue_spec.js` — stop writing a fixture template into `repoPath`; inject a `readFile` stub keyed on `resolveInstallPath('discuss-issue', 'templates', 'issue.tmpl.md')` instead.
- `core/spec/bin/discussIssueRenderIssueParity_spec.js` — stop writing a fixture template into `repoPath`; let both the shell and native invocations read their own real, installed template.

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- Precedent for this exact bug class and its fix: #319 (`acbe686`, `arcanum-split-issue`'s finish step), which is what `resolveInstallPath`/`INSTALL_ROOT` (`core/lib/utils/file/InstallRoot.js`) exists for — its own docstring: "never the target `repoPath` — this is the distinction #319 got wrong."
- Precedent for the constructor-injected, mocked-`readFile` testing style: `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js` + `core/spec/support/factories/autoFixAllReplyComment.js` (`TEMPLATE_PATH`, `fakeReadFile`).
- Audited every other native command reading `path.join(this._repoContext.repoPath, ...)` (`ArcanumSplitIssueCreateSubIssueFile.js`, `ArcanumSplitIssuePushSubIssues.js`, `AutoMonitorPrMonitorPr.js`) — all three are legitimately `repoPath`-relative (target repo's own `docs/agents/issues/` folder, `.claude/state/`), not skill assets, so none of them share this bug. No broader audit needed beyond `DiscussIssueRenderIssue.js`.
