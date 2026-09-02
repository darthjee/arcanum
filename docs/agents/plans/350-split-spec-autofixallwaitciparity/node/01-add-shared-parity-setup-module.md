# Add the shared parity-setup module

Create `core/spec/support/factories/autoFixAllWaitCiParitySetup.js`, following the shape of
the sibling `githubParitySetup.js`/`queueParitySetup.js` modules in the same directory. It
exports:

- `SHELL_SCRIPT` — `path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_shell.sh')`,
  reusing `REPO_ROOT` imported from `../utils/runCommand.js` (not redefined locally).
- `seedGithubLikeRepo(repo)` — moved verbatim from the current monolith's local helper
  (`autoFixAllWaitCiParity_spec.js` lines ~86-88), rewriting `repo.repoPath`'s `origin` remote
  to a github.com-shaped URL via `seedOriginUrl` (imported from `../utils/runCommand.js`, same
  as `githubParitySetup.js`'s own `seedGithubLikeRepo` does). Keep the module-local
  `FAKE_GITHUB_URL` constant private (not exported) — mirrors `githubParitySetup.js`. It can
  reuse the same fixture URL scheme as the existing modules (e.g.
  `https://github.com/darthjee/arcanum-wait-ci-fixture.git`, the monolith's current value).
- `seedIgnoredCheckPatterns(repo, patterns)` — moved verbatim from the monolith (lines
  ~97-105): writes `repo.repoPath`'s `.claude/configuration/arcanum-repo-config.json` with
  `{ 'auto-fix-all': { ignored_check_patterns: patterns } }`.

Do **not** add `runCommand`, `REPO_ROOT`, `NATIVE_BIN`, or `FAKE_FETCH_PRELOAD` to this module —
those are imported directly from `core/spec/support/utils/runCommand.js` by whichever spec
files need them (steps 02-04). Do **not** add `seedEngineMode` or `SHIM_SCRIPT` here — they
stay local to `engine_dispatch_spec.js` (step 04).

At the end of this step, the module exists but nothing imports from it yet — the monolith
`autoFixAllWaitCiParity_spec.js` is untouched and still passes on its own.

## Files to Change

- `core/spec/support/factories/autoFixAllWaitCiParitySetup.js` — new file, as described above.
