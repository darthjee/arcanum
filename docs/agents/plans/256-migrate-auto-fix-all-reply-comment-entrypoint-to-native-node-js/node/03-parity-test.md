# Parity test

Write `core/spec/bin/autoFixAllReplyCommentParity_spec.js`, mirroring `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js`'s shape: run both `auto-fix-all/scripts/reply_comment_shell.sh` and `core/bin/arcanum auto-fix-all-reply-comment` with the same inputs (mocked `gh`/`git`/network as needed — reuse whatever fixture/stub approach the cleanup-artifacts parity spec uses for isolating `gh`/`git` calls) and assert identical stdout and exit code for:

- The happy path.
- A missing-PR-for-branch failure.
- A REST-call failure.
- A usage error (missing argument).

This is what actually enforces the output/exit-code contract from `docs/agents/architecture/script-engine.md`, not just the unit spec.

## Files to Change

- `core/spec/bin/autoFixAllReplyCommentParity_spec.js` — new file.
