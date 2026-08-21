import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoPath from '../../lib/RepoPath.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

describe('RepoPath', () => {
  describe('#validate', () => {
    it('throws when repo_path is missing', async () => {
      const repoPath = new RepoPath();

      await expectAsync(repoPath.validate('')).toBeRejectedWithError('Error: repo_path is required');
    });

    it('throws when the path does not exist', async () => {
      const repoPath = new RepoPath();
      const missingPath = '/no/such/path/for/repo-path-spec';

      await expectAsync(repoPath.validate(missingPath)).toBeRejectedWithError(
        `Error: not a directory: ${missingPath}`
      );
    });

    it('throws when the path is a file, not a directory', async () => {
      let dir;

      try {
        dir = await createTempDir('arcanum-core-repo-path-spec-');

        const filePath = path.join(dir, 'a-file');

        await writeFile(filePath, 'content\n');

        const repoPath = new RepoPath();

        await expectAsync(repoPath.validate(filePath)).toBeRejectedWithError(`Error: not a directory: ${filePath}`);
      } finally {
        if (dir) {
          await removeTempDir(dir);
        }
      }
    });

    it('throws when the directory is not a git repository', async () => {
      let dir;

      try {
        dir = await createTempDir('arcanum-core-repo-path-spec-');
        await mkdir(path.join(dir, 'not-a-repo'), { recursive: true });

        const repoPath = new RepoPath();
        const notARepo = path.join(dir, 'not-a-repo');

        await expectAsync(repoPath.validate(notARepo)).toBeRejectedWithError(
          `Error: not a git repository: ${notARepo}`
        );
      } finally {
        if (dir) {
          await removeTempDir(dir);
        }
      }
    });

    it('resolves silently for a valid git repository', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const repoPath = new RepoPath();

        await expectAsync(repoPath.validate(repo.repoPath)).toBeResolved();
      } finally {
        await repo.cleanup();
      }
    });
  });
});
