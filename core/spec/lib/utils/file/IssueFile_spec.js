import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import IssueFile from '../../../../lib/utils/file/IssueFile.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('IssueFile', () => {
  let repoPath;
  const issuesFolder = 'docs/agents/issues';

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('.findExisting', () => {
    it('returns null when the issues folder does not exist', async () => {
      const result = await IssueFile.findExisting(repoPath, issuesFolder, '1');

      expect(result).toBeNull();
    });

    it('returns null when no file matches the id prefix', async () => {
      await mkdir(path.join(repoPath, issuesFolder), { recursive: true });
      await writeFile(path.join(repoPath, issuesFolder, '2_other.md'), 'content\n');

      const result = await IssueFile.findExisting(repoPath, issuesFolder, '1');

      expect(result).toBeNull();
    });

    it('matches an underscore-separated filename', async () => {
      await mkdir(path.join(repoPath, issuesFolder), { recursive: true });
      await writeFile(path.join(repoPath, issuesFolder, '42_my_cool_issue.md'), 'content\n');

      const result = await IssueFile.findExisting(repoPath, issuesFolder, '42');

      expect(result).toEqual('docs/agents/issues/42_my_cool_issue.md');
    });

    it('matches a dash-separated filename', async () => {
      await mkdir(path.join(repoPath, issuesFolder), { recursive: true });
      await writeFile(path.join(repoPath, issuesFolder, '7-some-title.md'), 'content\n');

      const result = await IssueFile.findExisting(repoPath, issuesFolder, '7');

      expect(result).toEqual('docs/agents/issues/7-some-title.md');
    });

    it('does not match a different id sharing the same prefix digits', async () => {
      await mkdir(path.join(repoPath, issuesFolder), { recursive: true });
      await writeFile(path.join(repoPath, issuesFolder, '123_title.md'), 'content\n');

      const result = await IssueFile.findExisting(repoPath, issuesFolder, '12');

      expect(result).toBeNull();
    });

    it('does not match files nested in subdirectories', async () => {
      await mkdir(path.join(repoPath, issuesFolder, 'nested'), { recursive: true });
      await writeFile(path.join(repoPath, issuesFolder, 'nested', '1_nested.md'), 'content\n');

      const result = await IssueFile.findExisting(repoPath, issuesFolder, '1');

      expect(result).toBeNull();
    });
  });

  describe('.titleFromFilename', () => {
    it('derives a Title-Cased title from an underscore-separated filename', () => {
      const title = IssueFile.titleFromFilename('docs/agents/issues/42_my_cool_issue.md');

      expect(title).toEqual('My Cool Issue');
    });

    it('derives a Title-Cased title from a dash-separated filename', () => {
      const title = IssueFile.titleFromFilename('docs/agents/issues/7-some-title-here.md');

      expect(title).toEqual('Some Title Here');
    });

    it('falls back to the whole basename when there is no separator at all', () => {
      const title = IssueFile.titleFromFilename('docs/agents/issues/999.md');

      expect(title).toEqual('999');
    });
  });
});
