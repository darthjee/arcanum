# Docker parity cases

Add a parity spec under `core/spec/docker/` for every batch-1 command. Each spec runs the real shim's `engine_dispatch` arguments natively and in `PARITY_IMAGE` through `runDockerParity`, and asserts identical stdout, exit code and file diff with `expectDockerParity`. Group by shim file, as in step 01, e.g. `autoFixAllConfig_spec.js`, `autoFixAllQueue_spec.js`, `monitorIssues_spec.js`, `initClaude_spec.js`, `sharedLib_spec.js` and `autoFixIssue_spec.js`. Reuse the existing parity factories (`autoFixAllConfigParitySetup.js`, `queueParitySetup.js`, `issueStateParitySetup.js`, ...) for fixtures.

Specific cases:

- **Writers** (`*-config-set`, `*-config-toggle`, `queue-pop`, `rewrite-queue-push/pop`, `issue-state set*`, `init-claude-set-*`, `init-claude-setup-*`): assert the same files change with the same content. On Linux, also assert the created files are owned by the host uid.
- **`auto-fix-all-queue-wait-next`**: seed the queue first so the call returns immediately, then compare.
- **`init-claude-setup-templates`**: the shell side copies from `init-claude/templates`. Native reads the templates baked into the image, so a mismatch here means the image is stale, not a code bug.
- **`dispatch-fixture-crash`**: no shim. Call `engine_dispatch` with the fixture command directly (as the dispatch-level specs do) and assert that the crash's exit code and stderr match native.
- Run at least one command per shim family from a git worktree too, as the pilot does, so the git-common-dir mount is exercised.

## Files to Change

- New `core/spec/docker/*_spec.js` files covering all 29 commands.
- `core/spec/support/utils/dockerParity.js`: only if a small shared helper is missing (e.g. a seeded-queue or writer-ownership check).
