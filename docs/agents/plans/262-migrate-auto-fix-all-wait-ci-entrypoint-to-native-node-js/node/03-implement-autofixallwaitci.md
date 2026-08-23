# Implement AutoFixAllWaitCi.js

Create `core/lib/AutoFixAllWaitCi.js`, byte-identical in stdout/exit code to `wait_ci_shell.sh`. Constructor takes injectable collaborators (`origin = new Origin()`, `githubToken = new GithubToken()`, `repoConfig = new RepoConfig()`, `execFileAsync`, `fetchFn = fetch`, `timeoutMs`, and a `sleepFn`/`sleepMs`-style hook for the poll interval — see [node.md](../node.md)'s Notes for the exact precedent to follow).

`run(repoPath)` behavior, mirroring the shell script's contract:

1. Resolve `{ repo }` via `Origin#resolve(repoPath)` and the current branch via `git branch --show-current` (`execFileAsync('git', ['-C', repoPath, 'branch', '--show-current'])`).
2. Resolve the PR number for that branch via the GitHub REST API (list pulls filtered by `head=<owner>:<branch>`), replacing the shell version's `gh pr view --json number`. Missing PR → same `Error: no pull request found for the current branch on <repo>` message/exit-1 contract as the shell script.
3. Read `ignored_check_patterns` once via `RepoConfig#getIgnoredCheckPatterns(repoPath)` (Step 02).
4. Poll loop: on each iteration, fetch the PR's head commit SHA (`GET /repos/{repo}/pulls/{number}`) and its check-runs (`GET /repos/{repo}/commits/{sha}/check-runs?per_page=100`), filter out any check-run whose name case-insensitively matches an ignored pattern (case-insensitive regex test, same as the shell's `jq ... test($p; "i")`), then apply the shell script's exact passed/failed/pending decision tree (zero total → keep waiting; any completed failure/cancelled/timed_out → print `failed` + failed names, exit 0; all completed success → print `passed`, exit 0; otherwise keep waiting). Transient fetch/API errors are swallowed and retried, matching the shell script's `|| { sleep 5; continue; }` pattures.
5. Never print the GitHub token; every GitHub call goes through `fetch` with `Authorization: Bearer <token>` (from `GithubToken#get`) and `AbortSignal.timeout(this._timeoutMs)`, matching `AutoFixAllReplyComment.js`'s established error-handling shape.

Do not carry `GH_INSECURE_SKIP_VERIFY` into this module — see [node.md](../node.md)'s Notes.

## Files to Change

- `core/lib/AutoFixAllWaitCi.js` — new file.
