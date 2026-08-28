# Issue: Extract a shared arcanum-install-root helper for native modules that shell out to sibling skill scripts

## Description
Several native modules under `core/lib/` need to reference files that live in the **arcanum install root** (the skill repo itself), not in the target repo being operated on: sibling skill scripts, skill templates, and shared `arcanum/_lib/` scripts. Today each call site hand-rolls the path back to that root from its own module location:

```js
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOME_SCRIPT = path.join(MODULE_DIR, '..', '..', '..', '<skill>', 'scripts', '<x>.sh');
```

Call sites of this pattern (all four are in scope for this issue):
- `core/lib/commands/AutoFixAllReplyComment.js` — `RESOLVE_PR_NUMBER_SCRIPT` (`auto-monitor-issue-pr/scripts/resolve_pr_number.sh`), inline `'..', '..', '..'`.
- `core/lib/commands/ArcanumSplitIssueFinish.js` — `GITHUB_SCRIPT` (`arcanum-split-issue/scripts/github.sh`), inline `'..', '..', '..'` (added by #319's fix).
- `core/lib/core/dispatcher.js` — `configChainPath` (`arcanum/_lib/config_chain.sh`), inline `'..', '..', '..'` from `core/lib/core/`.
- `core/lib/commands/AutoFixAllReplyComment.js` — `TEMPLATE_RELATIVE_PATH` (`auto-fix-all/templates/reply.tmpl.md`) is currently joined onto `repoContext.repoPath` instead of the install root. This is the same mistake #319 fixed for `github.sh`, still live — migrating it here also fixes that latent bug.

## Problem
The repeated `'..', '..', '..'` is fragile:
- It silently depends on the module living at exactly `core/lib/commands/` (or `core/lib/core/`). Move or nest a module and the path breaks with no compile-time signal.
- Getting the root wrong is precisely the class of bug #319 fixed — it had joined the script path onto `repoPath` (the target repo) instead of the install root. `AutoFixAllReplyComment`'s template lookup still does exactly this today.
- Every future native migration that shells out to a sibling script or reads a skill template re-implements the same relative walk and can repeat the `repoPath` mistake.

## Solution
Extract one well-named helper for "the arcanum install root", computed once from a known-fixed module location, and route every install-root-relative lookup through it.

- Add `core/lib/utils/file/InstallRoot.js` exporting:
  - `resolveInstallPath(...segments)` — a plain function that `path.join`s its segments onto the computed install root.
  - the bare resolved install-root path as a named constant, for callers that just need the root.
  - No injectable-deps class — this is a pure compile-time path computation with nothing to inject (unlike `RepoPath.js`).
  - The root is derived from `import.meta.url` of this module at its fixed location (`core/lib/utils/file/` → four levels up), so the fragile walk exists in exactly one place.
- Migrate all four call sites to use it:
  - `AutoFixAllReplyComment` `RESOLVE_PR_NUMBER_SCRIPT` → `resolveInstallPath('auto-monitor-issue-pr', 'scripts', 'resolve_pr_number.sh')`.
  - `ArcanumSplitIssueFinish` `GITHUB_SCRIPT` → `resolveInstallPath('arcanum-split-issue', 'scripts', 'github.sh')`.
  - `dispatcher.js` `configChainPath` → `resolveInstallPath('arcanum', '_lib', 'config_chain.sh')`.
  - `AutoFixAllReplyComment` template path → `resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md')`, replacing the current `path.join(repoContext.repoPath, TEMPLATE_RELATIVE_PATH)` (behavior-changing: this fixes the latent wrong-root bug).
- Update the affected specs/parity specs to match; no change to any shell script.

Scope:
- In: the `InstallRoot.js` helper + migrating all four call sites above (including the `reply.tmpl.md` root fix).
- Out: #319's regression fix itself (assumed already merged), anything inside the shell scripts.

Context: split off from #319 during issue enhancement, kept separate to keep #319 a tight regression fix.

## Benefits
- One source of truth for the install root; future migrations call `resolveInstallPath(...)` instead of re-deriving `'..', '..', '..'`.
- Removes the `repoPath`-vs-install-root footgun that #319 hit, and fixes the one remaining live instance of it (`reply.tmpl.md`).
- Module files under `core/lib/` can move without silently breaking sibling-script or template resolution — the walk lives in one audited place.
