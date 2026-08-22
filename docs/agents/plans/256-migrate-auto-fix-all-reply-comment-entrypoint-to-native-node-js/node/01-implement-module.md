# Implement AutoFixAllReplyComment.js and register it

Create `core/lib/AutoFixAllReplyComment.js`, the native equivalent of `auto-fix-all/scripts/reply_comment_shell.sh`. Model the class shape on `core/lib/AutoFixAllCleanupArtifacts.js` (closest precedent: same skill, injectable collaborators via a constructor `deps` object, `execFile`/`spawn` for every shell-out).

Constructor collaborators to inject (mirroring `GithubIssue.js`'s pattern):
- `origin = new Origin()`
- `githubToken = new GithubToken()`
- `execFileAsync` (promisified `execFile`, default `promisify(execFile)`) — for `git branch --show-current`, `git push`, and shelling out to `resolve_pr_number.sh`.
- `fetchFn = fetch`
- `timeoutMs` (default 30000, overridable for tests), matching `GithubIssue.js`'s REST-call timeout convention.
- `readFile` (default `node:fs/promises` `readFile`) — for reading `auto-fix-all/templates/reply.tmpl.md`.

`run(args)` behavior, replicating `reply_comment_shell.sh` exactly:

1. Parse and validate the 6 required positional args (`repoPath`, `id`, `agent`, `modelName`, `modelEmail`, `replyBody`); strip a leading `#` from `id`; throw a plain `Error` with the shell script's usage message on any missing/invalid arg (surfaces as `arcanum: <message>` on stderr, exit 1 — see the output/exit-code contract in `docs/agents/architecture/script-engine.md`).
2. Resolve the PR number by shelling out to `auto-monitor-issue-pr/scripts/resolve_pr_number.sh <repoPath> <id>` via `execFileAsync` (this dependency is explicitly out-of-batch per the issue — do not port its logic natively).
3. Resolve `{ domain, repo }` via `this._origin.resolve(repoPath)` and the token via `this._githubToken.get(repoPath)`.
4. Read `auto-fix-all/templates/reply.tmpl.md` (path relative to the repo — resolve via `path.join(repoPath, 'auto-fix-all/templates/reply.tmpl.md')`) and do plain string substitution of `%%BODY%%`, `%%AGENT%%`, `%%MODEL_NAME%%`, `%%MODEL_EMAIL%%` — first-occurrence replace, matching bash's `${var/pattern/repl}` (single substitution per placeholder, exactly as the shell script does; no templating library, per the zero-runtime-deps rule).
5. POST the rendered content as a PR comment via the GitHub REST API — `POST https://api.github.com/repos/${repo}/issues/${prNumber}/comments` (PR comments live under the `issues` endpoint), `Authorization: Bearer ${token}`, `Content-Type: application/json`, body `{ body: content }` — mirroring `GithubIssue.js#create`'s fetch-call shape (error handling, `AbortSignal.timeout`, `response.ok` check). On failure, throw an `Error` (no automatic retry — the shell script doesn't retry either).
6. Push the current branch: resolve `git branch --show-current` (`execFileAsync('git', ['-C', repoPath, 'branch', '--show-current'])`), then `execFileAsync('git', ['-C', repoPath, 'push', '-u', 'origin', `${branch}:${branch}`])` — re-deriving `push_current_branch` from `arcanum/_lib/push.sh` natively rather than shelling out to the bash helper (per the issue's explicit instruction).
7. Return an empty string on success (the shell script prints nothing of its own to stdout).

Register the command in `core/bin/arcanum`'s `COMMANDS` map (alphabetically among the existing entries):

```js
'auto-fix-all-reply-comment': { module: 'AutoFixAllReplyComment.js', method: 'run' }
```

## Files to Change

- `core/lib/AutoFixAllReplyComment.js` — new file, the native module described above.
- `core/bin/arcanum` — one new `COMMANDS` entry.
