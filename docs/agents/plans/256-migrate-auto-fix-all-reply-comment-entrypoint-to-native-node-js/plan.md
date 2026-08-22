# Plan: Migrate auto-fix-all-reply-comment entrypoint to native Node.js

Issue: [256-migrate-auto-fix-all-reply-comment-entrypoint-to-native-node-js.md](../../issues/256-migrate-auto-fix-all-reply-comment-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-fix-all/scripts/reply_comment.sh` (posts an attributed reply comment on the current branch's PR, then pushes the branch) to a native Node.js implementation, following the `engine_dispatch` shim pattern established by the prior migrations in this batch (`#236`, `#237`, `#238`, `#239`, `#254`). The `scripter` agent splits the existing shell script into a thin `engine_dispatch` shim plus an unchanged `_shell.sh` sibling; the `node` agent implements the native equivalent in `core/`, registers it, and covers it with unit and parity tests.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command name**: `auto-fix-all-reply-comment` — the string used as the `engine_dispatch` command argument, the `arcanum/_lib/migration-status.json` key, and the `core/bin/arcanum` `COMMANDS` map key.
- **CLI contract** (unchanged from today, byte-identical across shell/native): `reply_comment.sh <repo_path> <id> <agent> <model_name> <model_email> <reply_body>`. `id` accepts a leading `#` (stripped). All six arguments are required; missing any of them is a usage error, exit 1, message to stderr. On success: posts the rendered template as a PR comment, pushes the current branch, exits 0. On failure (no PR found for the branch, PR-comment API call fails, push fails): non-zero exit, error on stderr, nothing extra on stdout.
- **Env-var allowlist**: the shim forwards `HOME` to the native path (needed for `gh auth token`/`gh auth switch` under native's `env -i PATH="$PATH"`), matching every prior shim in this batch.
- **Native module**: `core/lib/AutoFixAllReplyComment.js`, exported default class with a `run(args)` (or equivalent) method registered in `core/bin/arcanum`'s `COMMANDS` map as `'auto-fix-all-reply-comment': { module: 'AutoFixAllReplyComment.js', method: 'run' }`. The module reuses `core/lib/Origin.js` and `core/lib/GithubToken.js` rather than re-deriving origin/auth resolution — same pattern `GithubIssue.js` already follows for its REST calls.
- **Migration-status flag**: `arcanum/_lib/migration-status.json`'s `"auto-fix-all-reply-comment"` key flips from `false` to `true` once both sides land together in the same PR — the scripter's shim assumes a native implementation exists as soon as the flag is `true`, so both must merge atomically.

## Files touched (cross-cutting summary — see each agent's plan for the authoritative per-file list)

- `auto-fix-all/scripts/reply_comment.sh` (scripter)
- `auto-fix-all/scripts/reply_comment_shell.sh` (scripter, new)
- `arcanum/_lib/migration-status.json` (scripter)
- `core/bin/arcanum` (node)
- `core/lib/AutoFixAllReplyComment.js` (node, new)
- `core/spec/lib/AutoFixAllReplyComment_spec.js` (node, new)
- `core/spec/bin/autoFixAllReplyCommentParity_spec.js` (node, new)
