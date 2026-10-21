# Add RepoPath#toplevel

Add `toplevel(repoPath)` to `core/lib/utils/file/RepoPath.js`: runs `git -C <repoPath> rev-parse --show-toplevel` through the already-imported `execFile` (promisified, argument array, never a shell string) and returns the trimmed path. On failure throw an `Error` reusing the existing `Error: not a git repository: <path>` message. Keep the `node:`-only imports and the injectable collaborators pattern already used by `RepoPath` for specs.

## Files to Change
- `core/lib/utils/file/RepoPath.js` — add `toplevel`.
- `core/spec/lib/utils/file/RepoPath_spec.js` — repo root, subdirectory → root, non-repo → error.
