# Migrate the two sibling-script call sites

Pure refactor — no behavior change. Replace the inline `path.join(MODULE_DIR, '..', '..', '..', …)` derivations in the two command modules with `resolveInstallPath(...)`.

`core/lib/commands/ArcanumSplitIssueFinish.js`:

- Import `resolveInstallPath` from `../utils/file/InstallRoot.js`.
- Replace `GITHUB_SCRIPT` with `resolveInstallPath('arcanum-split-issue', 'scripts', 'github.sh')`.
- Drop the now-unused `MODULE_DIR` const and the `fileURLToPath`/`import.meta.url` import **if nothing else in the file uses them** (grep first — `MODULE_DIR` was added solely by #319 here).
- Update the block comment that currently explains the "three levels up from `core/lib/commands/`" walk to instead say the path is resolved via `resolveInstallPath`, still pointing at the arcanum install and not `repoPath`. Also update the matching prose in the `#finish` (or equivalent) method's JSDoc that repeats "three levels up from `core/lib/commands/`".

`core/lib/commands/AutoFixAllReplyComment.js`:

- Import `resolveInstallPath` from `../utils/file/InstallRoot.js`.
- Replace `RESOLVE_PR_NUMBER_SCRIPT` with `resolveInstallPath('auto-monitor-issue-pr', 'scripts', 'resolve_pr_number.sh')`.
- Leave `MODULE_DIR` / `fileURLToPath` in place for now if the template code (Step 04) still needs them — otherwise remove in Step 04. Update the `RESOLVE_PR_NUMBER_SCRIPT` comment to drop the "three levels up from `core/lib/commands/`" wording.

Specs:

- `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` — the existing test "resolves github.sh from the skill install root, not repoPath, and that path exists on disk" (asserts `scriptPath` equals `path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'github.sh')`, `.startsWith(repoPath)` is false, and the file exists) still passes unchanged because `resolveInstallPath` produces the same absolute path. Keep it. Optionally tighten it to assert equality with `resolveInstallPath('arcanum-split-issue', 'scripts', 'github.sh')` imported from the helper.
- `core/spec/lib/commands/AutoFixAllReplyComment_spec.js` — the `resolve_pr_number.sh` assertion uses `jasmine.stringMatching(/resolve_pr_number\.sh$/)`, so it stays green. No change needed beyond confirming.
- Parity specs `arcanumSplitIssueFinishParity_spec.js` and `autoFixAllReplyCommentParity_spec.js` — unaffected by this step (same resolved paths); do not touch here (the parity spec's template workaround is Step 04).

## Files to Change

- `core/lib/commands/ArcanumSplitIssueFinish.js` — `GITHUB_SCRIPT` → `resolveInstallPath(...)`; drop unused `MODULE_DIR`/`fileURLToPath`; refresh comments/JSDoc.
- `core/lib/commands/AutoFixAllReplyComment.js` — `RESOLVE_PR_NUMBER_SCRIPT` → `resolveInstallPath(...)`; refresh comment.
- `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` — optionally assert against the helper's output; otherwise verify still green.
