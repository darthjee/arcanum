# Cleanup stale references and verify

Sweep for leftover flat-path references the moves above wouldn't have caught, then verify the whole suite.

- Several `core/lib/*.js` files have JSDoc comments citing sibling files by their old flat path (e.g. `` `core/lib/Lock.js` ``) — known examples from the issue's investigation: `AutoFixAllReplyComment.js`, `AutoFixAllQueue.js`, `ConfigChain.js`, `AutoFixAllConfig.js`, `PermissionGrant.js`, `AutoFixAllGithub.js`. Grep `core/lib/` and `core/spec/lib/` for any remaining ``core/lib/<Name>.js`` or bare ``<Name>.js`` mentions in comments/docstrings that no longer match a file's new path, and update them to the new path.
- Confirm no other file in the repo shells out to `node core/lib/X.js` or `node core/lib/<OldPath>.js` directly (the issue's investigation found none outside `core/`, but re-check after the move in case anything was missed, including `core/package.json` scripts).
- Run `yarn lint` and `yarn test` in `core/` (this repo's two CI checks for `core/`) and fix any fallout — missed import path, wrong relative depth, etc.

## Files to Change

- Any `core/lib/**/*.js` file with a stale flat-path JSDoc reference — update the path in the comment
- Any other file surfaced by the grep/lint/test sweep above

## CI Checks

- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn test` (CI job: `test`)
