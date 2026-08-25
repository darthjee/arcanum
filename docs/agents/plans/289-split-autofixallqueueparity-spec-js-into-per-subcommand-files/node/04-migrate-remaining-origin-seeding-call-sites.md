# Migrate the remaining 6 origin-seeding call sites to seedOriginUrl

Beyond `githubParitySetup.js` (step 02) and the queue spec itself (step 06), 6 more files each define their own copy of the `git remote set-url origin <url>` rewrite. Import `seedOriginUrl` from `../support/utils/runCommand.js` in each (all 6 live directly under `core/spec/bin/`, so that's the correct relative path) and replace only the origin-rewrite line — every other line in these helpers (extra config, extra fixtures) stays exactly as-is.

- **`autoFixAllWaitCiAndMergeParity_spec.js`** and **`autoFixAllWaitCiParity_spec.js`** — both have the exact same shape:
  ```js
  async function seedGithubLikeRepo(repo) {
    await git(['remote', 'set-url', 'origin', FAKE_GITHUB_URL], repo.repoPath);
  }
  ```
  becomes:
  ```js
  async function seedGithubLikeRepo(repo) {
    await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
  }
  ```
  Each file's own local `git`/`execFileAsync` helper stays untouched — both use it elsewhere for other git operations, not just here.

- **`autoFixAllReplyCommentParity_spec.js`** — its `seedGithubLikeRepo` does more than the origin rewrite (a `pushInsteadOf` transport rewrite, plus seeding a template file). Only the first line changes:
  ```js
  async function seedGithubLikeRepo(repo) {
    const fakeUrl = 'https://github.com/darthjee/arcanum-reply-comment-fixture.git';

    await seedOriginUrl(repo.repoPath, fakeUrl);
    await git(['config', `url.${repo.remotePath}.pushInsteadOf`, fakeUrl], repo.repoPath);
    // ...unchanged: read REAL_TEMPLATE_PATH, write reply.tmpl.md
  }
  ```

- **`githubIssueInfoParity_spec.js`** — its local `setOrigin(repoPath, url)` helper does nothing but the rewrite (via raw `execFileAsync`, not even the local `git` pattern the others use), so it's not wrapped — it's deleted outright, and its two call sites call `seedOriginUrl` directly:
  ```diff
  -async function setOrigin(repoPath, url) {
  -  await execFileAsync('git', ['-C', repoPath, 'remote', 'set-url', 'origin', url]);
  -}
  ```
  ```diff
  -        await setOrigin(repo.repoPath, 'https://github.com/darthjee/arcanum.git');
  +        await seedOriginUrl(repo.repoPath, 'https://github.com/darthjee/arcanum.git');
  ```
  (and the second call site, `'git@git.example.com:acme/widgets.git'`, the same way). Note `seedOriginUrl` uses `-C`-less `git(args, cwd)` semantics (cwd passed as the second positional, not a `-C` flag) — that's already how `runCommand.js`'s `git` works, so no behavior change beyond dropping the now-redundant local wrapper.

- **`arcanumSplitIssueCreateSubIssueParity_spec.js`** and **`arcanumSplitIssuePushSubIssuesParity_spec.js`** — both have the same shape, `seedZeroRetryRepo(repoPath)` bundling the origin rewrite with a `max-retry-count: 0` config write:
  ```js
  async function seedZeroRetryRepo(repoPath) {
    await execFileAsync('git', ['remote', 'set-url', 'origin', '<fixture-url>'], { cwd: repoPath });

    const stateDir = path.join(repoPath, '.claude', 'state');

    await mkdir(stateDir, { recursive: true });
    await writeFile(
      path.join(stateDir, 'arcanum-config.json'),
      JSON.stringify({ 'plan-issues': { 'max-retry-count': 0 } })
    );
  }
  ```
  becomes:
  ```js
  async function seedZeroRetryRepo(repoPath) {
    await seedOriginUrl(repoPath, '<fixture-url>');

    const stateDir = path.join(repoPath, '.claude', 'state');

    await mkdir(stateDir, { recursive: true });
    await writeFile(
      path.join(stateDir, 'arcanum-config.json'),
      JSON.stringify({ 'plan-issues': { 'max-retry-count': 0 } })
    );
  }
  ```
  (`<fixture-url>` is each file's own existing URL constant — `arcanum-cs-fixture.git`/`arcanum-pssi-fixture.git` respectively — unchanged.)

## Files to Change

- `core/spec/bin/autoFixAllWaitCiAndMergeParity_spec.js` — `seedGithubLikeRepo` body calls `seedOriginUrl`; add the import.
- `core/spec/bin/autoFixAllWaitCiParity_spec.js` — `seedGithubLikeRepo` body calls `seedOriginUrl`; add the import.
- `core/spec/bin/autoFixAllReplyCommentParity_spec.js` — `seedGithubLikeRepo`'s origin-rewrite line calls `seedOriginUrl`; add the import.
- `core/spec/bin/githubIssueInfoParity_spec.js` — delete `setOrigin`; both call sites call `seedOriginUrl` directly; add the import (and drop the now-unused `execFileAsync`/`promisify`/`execFile` imports if nothing else in the file uses them — verify before removing).
- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js` — `seedZeroRetryRepo`'s origin-rewrite line calls `seedOriginUrl`; add the import.
- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity_spec.js` — `seedZeroRetryRepo`'s origin-rewrite line calls `seedOriginUrl`; add the import.
