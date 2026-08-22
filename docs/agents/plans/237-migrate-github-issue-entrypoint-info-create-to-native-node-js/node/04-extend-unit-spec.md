# Extend GithubIssue_spec.js with info/create unit tests

Add `describe('#info', ...)` and `describe('#create', ...)` blocks to `core/spec/lib/GithubIssue_spec.js`, following the existing `#fetch` block's style (`stubDeps()`, `createTempDir`/`removeTempDir`, fixture loading via `loadFixture`).

## `#info` cases

- Happy path: `origin.resolve` stub returns `{ domain: 'github.com', repo: 'darthjee/arcanum' }` → `info(repoPath)` resolves to `'DOMAIN=github.com\nREPO=darthjee/arcanum\n'`.
- A non-GitHub domain (e.g. `git.example.com`) round-trips into the same `DOMAIN=`/`REPO=` shape — no GitHub-specific branching.
- Propagates `origin.resolve`'s rejection message unchanged when it throws (no repo-path pre-check to short-circuit it).

## `#create` cases

- Add a new fixture, `core/spec/support/fixtures/github_issue_create_success.json`, shaped like a GitHub "create issue" REST response (`{ "number": 42, "title": "...", "body": "...", ... }`) — reuse `github_issue_success.json`'s style.
- Happy path: stub `repoPath.validate` to resolve, `fetchFn` to resolve `{ ok: true, json: async () => fixture }`; write a real body file into the temp repo dir first. Assert:
  - The returned string is exactly `` `ID=${number}\nTITLE=${title}\nFILE=docs/agents/issues/${number}-${slug}.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n` ``.
  - The file was written to that path with trailing-newline-normalized body content (`${body}\n`, not the raw file content) — cover a fixture file whose content has 0, 1, and 2+ trailing newlines to nail down the `$(cat "$file")`-equivalent stripping behavior from node/02.
  - `fetchFn` was called with `POST`, the right URL (`.../repos/<repo>/issues`), `Authorization: Bearer <token>`, and a JSON body `{ title, body }` matching the normalized (not raw) body.
  - `issueState.write` (from `stubDeps()`) was **not** called — the explicit non-call this sub-issue's parity contract hinges on.
- `repoPath.validate` rejecting (e.g. `Error: not a directory: <path>`) propagates unchanged, and no network call is attempted (assert `fetchFn` not called).
- Missing body file: rejects with exactly `Error: file not found: <file>`, before any origin/token/network call (assert `origin.resolve`/`fetchFn` not called).
- Non-2xx response and a network-level throw from `fetchFn`: both reject with exactly `` `Error: could not create issue on ${repo}` `` — same pattern as the two existing `#fetch` failure tests.
- Auth failure (`githubToken.get` throws): propagates the exact `Error: could not obtain GitHub token via gh auth token` message, same pattern as `#fetch`'s existing auth-failure test.

## Files to Change

- `core/spec/lib/GithubIssue_spec.js` — add the two `describe` blocks.
- `core/spec/support/fixtures/github_issue_create_success.json` — new fixture.
