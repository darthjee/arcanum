# Add the shared "create issue" example

Create `core/spec/support/sharedExamples/githubIssueCreateSharedExamples.js`, exporting a function (e.g. `registerGithubIssueCreateSharedExamples(buildInstance)`) that registers, inside whichever `describe` block calls it, the `beforeEach`/`afterEach` temp-dir setup and the 8 scenarios currently duplicated verbatim across `GithubIssueService_spec.js` and `GithubIssueCreate_spec.js`:

1. Creates the issue, writes `docs/agents/issues/<id>-<slug>.md`, and returns the `ID=ok` fields.
2. Strips trailing newlines from the body file (looping over `''`, `'\n'`, `'\n\n\n'`), matching `$(cat "$file")`.
3. Calls fetch with `POST`, the right URL, `Authorization` header, and JSON body.
4. Does not write a per-issue state file.
5. Rejects with the exact file-not-found message before any origin/token/network call.
6. Throws the exact create-failure message on a non-2xx response.
7. Throws the exact create-failure message on a network error.
8. Surfaces the exact auth-failure message when a token cannot be obtained.

`buildInstance` is a factory the caller passes in, e.g. `(deps) => new GithubIssue(undefined, deps)` or `(deps) => new GithubIssueService(deps)`, called by each scenario instead of hardcoding either class — this is what lets one shared example serve both specs despite their different constructors (mirrors how `core/spec/support/sharedExamples/cliParityValidation.js` takes an `invoke` callback).

Both consuming specs need `repoPath`/`writeBodyFile` for their own extra, wrapper-specific tests (see steps 02 and 03), so have the registering function expose them — e.g. return a small context object populated inside the shared `beforeEach` (`{ getRepoPath: () => repoPath, writeBodyFile }`) — rather than keeping them private to the shared example's closure.

Reuse the existing fixture/stub helpers already shared by both specs (`core/spec/support/factories/githubIssue.js`'s `loadFixture`/`stubDeps`, `core/spec/support/utils/tempDir.js`'s `createTempDir`/`removeTempDir`) — do not duplicate them into the new file.

## Files to Change

- `core/spec/support/sharedExamples/githubIssueCreateSharedExamples.js` — new file; the shared "create issue" example.
