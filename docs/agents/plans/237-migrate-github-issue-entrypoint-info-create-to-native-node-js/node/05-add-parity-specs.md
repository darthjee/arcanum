# Add shell/native parity specs

Add `core/spec/bin/githubIssueInfoParity_spec.js` and `core/spec/bin/githubIssueCreateParity_spec.js`, following `listAgentsParity_spec.js`/`resolveAndFetchParity_spec.js`'s exact shape: run `arcanum/_lib/github_issue_shell.sh` **directly** (not through the new `arcanum/_lib/github_issue.sh` shim — keeps the test non-circular, same convention as the existing parity specs) side-by-side with `core/bin/arcanum`, asserting byte-identical stdout and exit code.

```js
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'github_issue_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

// info: `bash github_issue_shell.sh info <repo_path>` vs
//       `node core/bin/arcanum github-issue-info <repo_path>`
// create: `bash github_issue_shell.sh create <repo_path> <title> <file>` vs
//       `node core/bin/arcanum github-issue-create <repo_path> <title> <file>`
```

## `githubIssueInfoParity_spec.js` cases (fully offline — `info` never touches the network)

- A fixture git repo (`createGitFixtureRepo`, same helper `listAgentsParity_spec.js` uses) with a GitHub-shaped `origin` remote → identical `DOMAIN=`/`REPO=` stdout, exit 0.
- An `origin` on a non-`github.com` domain → identical output (no GitHub-specific branching on either side).
- A missing `repo_path` → identical non-zero exit, empty stdout, matching stderr message.
- A `repo_path` that's a directory but not a git repo → identical exit/stdout/stderr (the "no origin remote" message from `_load_origin`/`Origin#resolve`).

## `githubIssueCreateParity_spec.js` cases

Per `resolveAndFetchParity_spec.js`'s precedent: this repo's specs never make real network calls, and `create` hits the real GitHub REST API past the file-exists check — so only the **offline-reachable failure paths** (before any HTTP call) are covered here; the success path and post-network failures are already covered by node/04's mocked-`fetchFn` unit tests.

- A missing `repo_path` → identical non-zero exit, empty stdout, matching stderr (`repo_path_enter`/`RepoPath#validate`'s message) — reached before the file-exists check.
- A present, valid `repo_path` but a missing `<file>` argument → identical non-zero exit, empty stdout, matching stderr (`Error: file not found: <file>`) — reached before any origin/token/network call on either side.

## Files to Change

- `core/spec/bin/githubIssueInfoParity_spec.js` — new.
- `core/spec/bin/githubIssueCreateParity_spec.js` — new.
