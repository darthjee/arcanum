# Unit tests

Write `core/spec/lib/AutoFixAllReplyComment_spec.js`, mirroring the structure of `core/spec/lib/AutoFixAllCleanupArtifacts_spec.js` and `core/spec/lib/GithubIssue_spec.js` (Jasmine, injected fakes for every collaborator — no real network calls, no real `execFile`).

Cover at least:
- Usage/validation errors for each missing required argument, and for a non-numeric `id` (with and without a leading `#`).
- Happy path: asserts the exact `resolve_pr_number.sh` invocation (repo path + id), the exact REST call (`issues/{prNumber}/comments`, `Authorization: Bearer <token>`, JSON body `{ body: <rendered content> }`), the exact template substitution (`%%BODY%%`/`%%AGENT%%`/`%%MODEL_NAME%%`/`%%MODEL_EMAIL%%`, first-occurrence only if the fixture template repeats a token), and the exact `git push -u origin <branch>:<branch>` call using the branch from `git branch --show-current`.
- REST call failure (`response.ok` false, and a rejected `fetchFn`) surfaces as a thrown `Error`, no push attempted.
- `resolve_pr_number.sh` failure (non-zero exit) surfaces as a thrown `Error`, no REST call attempted.
- `git push` failure surfaces as a thrown `Error` after the comment was already posted (matches the shell script's ordering: comment first, push second, no rollback).
- Successful run resolves to an empty string (nothing printed to stdout).

Use `core/spec/support/fixtures/` for any canned REST response bodies, consistent with the "no real network calls in CI" rule in `docs/agents/architecture/script-engine.md`.

## Files to Change

- `core/spec/lib/AutoFixAllReplyComment_spec.js` — new file.
