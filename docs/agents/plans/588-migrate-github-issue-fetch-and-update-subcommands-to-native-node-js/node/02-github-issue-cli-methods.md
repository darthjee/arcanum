# Add the fetch and update CLI methods to GithubIssue

In `core/lib/commands/shared/GithubIssue.js`:

- **CLI fetch.** Add a new method (e.g. `fetchIssue(id)`; the name must differ from `fetch`, see the Notes in node.md) used only by the `github-issue-fetch` entrypoint. It reads `repoPath` from `this._repoContext.repoPath`, delegates to the existing `this.fetch(repoPath, id)`, and returns `TITLE=${title}\nFILE=${file}\nDOMAIN=${domain}\nREPO=${repo}\n`. Leave `fetch` itself unchanged. Repo-path validation comes from the Dispatcher's default `RepoContext#validate()`.
- **update.** Add `async update(id, title, file)` mirroring `cmd_update`, in the contract's order: (1) `readFile(file, 'utf8')`, resolved against the process cwd and never joined with `repoPath`; on failure throw `Error: file not found: ${file}`. (2) Strip all trailing newlines (`/\n+$/`). (3) Resolve origin via `this._origin.resolve(repoPath)` for `repo`. (4) Call `this._githubIssueService.issueClient(repoPath).updateIssue(id, { title, body })`. (5) Return `Updated issue #${id} on ${repo}\n`. If the file-read + trailing-newline trimming duplicates `GithubIssueService#create`, extract a small shared helper (e.g. a `readBody(file)` method on `GithubIssueService`) and use it from both.
- Update the class-level and constructor JSDoc to mention the new `github-issue-fetch` / `github-issue-update` entrypoints.

Specs (mirroring `core/lib/` one-to-one; follow the split of `GithubIssueFetch_spec.js` / `GithubIssueCreate_spec.js` / `GithubIssueInfo_spec.js`):

- CLI fetch: the output string, delegation to `fetch`, and propagation of `getIssue`'s error.
- `update`: success output, PATCH payload (including trailing-newline stripping), relative `file` resolved against the cwd rather than `repoPath`, the file-not-found message, the origin failure, the PATCH failure message, and that origin is not resolved after a missing-file error (check order).

## Files to Change
- `core/lib/commands/shared/GithubIssue.js` — the new CLI fetch method and `update`.
- `core/lib/services/GithubIssueService.js` — optional shared `readBody` helper, if extracted.
- `core/spec/lib/commands/shared/GithubIssueFetch_spec.js` (or a new `GithubIssueFetchCli_spec.js`) — CLI fetch specs.
- `core/spec/lib/commands/shared/GithubIssueUpdate_spec.js` — new.
