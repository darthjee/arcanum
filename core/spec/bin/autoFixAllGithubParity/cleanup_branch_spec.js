import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import {
  expectInvalidRepoPathParity, git, NATIVE_BIN, runCommand, SHELL_SCRIPT
} from '../../support/utils/runCommand.js';

const execFileAsync = promisify(execFile);

// Parity test for the "auto-fix-all-github cleanup-branch" migrated
// entrypoint (issue #265) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js/node.md.
// Unlike every sibling file in this directory, `cleanup-branch` never
// resolves `origin` via `Origin.js`/`origin.sh` (it only pushes/resets
// against it), so its fixture repos keep their real local bare-repo
// remote instead of a github.com-shaped one, and it doesn't need a fake
// `gh`/`fetch` — hence no `setupParityTest`.
describe('auto-fix-all-github parity (shell vs. native) — cleanup-branch', () => {
  // Neither `git reset --hard`'s nor `git branch -D`'s own stdout is
  // redirected by `cmd_cleanup_branch` — both leak straight through
  // (see AutoFixAllGithub.js#cleanupBranch's doc comment) and embed a
  // commit sha, which necessarily differs between the two independent
  // fixture repos this test builds (different repo, different commit
  // timestamps -> different shas), even though their tree content is
  // identical. So rather than asserting shell.stdout === native.stdout
  // directly, this predicts each side's own expected stdout from its
  // own repo's actual shas, and asserts each side matches its own
  // prediction — proving the underlying git-stdout-forwarding logic is
  // correct on both sides equally, which is what "parity" means here.
  it('matches shell/native predicted stdout (from each repo\'s own shas) and exit code, leaving both on main with the issue branch gone', async () => {
    const shellRepo = await createGitFixtureRepo();
    const nativeRepo = await createGitFixtureRepo();

    try {
      const shas = {};

      for (const [key, repo] of [['shell', shellRepo], ['native', nativeRepo]]) {
        await git(['checkout', '-b', 'issue-9'], repo.repoPath);
        await writeFile(path.join(repo.repoPath, 'change.txt'), 'x');
        await git(['add', 'change.txt'], repo.repoPath);
        await git(['commit', '--quiet', '-m', 'change'], repo.repoPath);
        await git(['push', '--quiet', 'origin', 'issue-9'], repo.repoPath);

        const { stdout: mainSha } = await execFileAsync(
          'git', ['rev-parse', '--short', 'origin/main'], { cwd: repo.repoPath }
        );
        const { stdout: issueSha } = await execFileAsync(
          'git', ['rev-parse', '--short', 'issue-9'], { cwd: repo.repoPath }
        );

        shas[key] = { mainSha: mainSha.trim(), issueSha: issueSha.trim() };
      }

      const shell = await runCommand([SHELL_SCRIPT, 'cleanup-branch', shellRepo.repoPath, '9'], shellRepo.repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'auto-fix-all-github-cleanup-branch', nativeRepo.repoPath, '9'],
        nativeRepo.repoPath
      );

      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual(
        `Your branch is up to date with 'origin/main'.\nHEAD is now at ${shas.shell.mainSha} seed\nDeleted branch issue-9 (was ${shas.shell.issueSha}).\n`
      );
      expect(native.stdout).toEqual(
        `Your branch is up to date with 'origin/main'.\nHEAD is now at ${shas.native.mainSha} seed\nDeleted branch issue-9 (was ${shas.native.issueSha}).\n`
      );

      for (const repo of [shellRepo, nativeRepo]) {
        const { stdout: branch } = await execFileAsync('git', ['branch', '--show-current'], { cwd: repo.repoPath });
        const { stdout: branches } = await execFileAsync('git', ['branch', '--list', 'issue-9'], { cwd: repo.repoPath });

        expect(branch.trim()).toEqual('main');
        expect(branches.trim()).toEqual('');
      }
    } finally {
      await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
    }
  });

  it('matches shell for a non-directory / non-git repo_path (repo_path_enter parity)', async () => {
    await expectInvalidRepoPathParity('cleanup-branch', 'auto-fix-all-github-cleanup-branch', ['9']);
  });
});
