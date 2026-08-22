import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoConfig from '../../lib/RepoConfig.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

describe('RepoConfig', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#getSafeBranch', () => {
    it('defaults to origin/main when the config file is absent', async () => {
      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getSafeBranch(repoPath)).toBeResolvedTo('origin/main');
    });

    it('reads git.safe_branch from .claude/state/arcanum-config.json when present', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
        JSON.stringify({ git: { safe_branch: 'origin/develop' } })
      );

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getSafeBranch(repoPath)).toBeResolvedTo('origin/develop');
    });

    it('defaults to origin/main when the key is absent from the config file', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), JSON.stringify({}));

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getSafeBranch(repoPath)).toBeResolvedTo('origin/main');
    });

    it('defaults to origin/main when the config file is malformed JSON', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), '{not valid json');

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getSafeBranch(repoPath)).toBeResolvedTo('origin/main');
    });
  });

  describe('#getPlanIssuesRetryConfig', () => {
    it('defaults to { maxRetryCount: 5, errorSleepTime: 5 } when the config file is absent', async () => {
      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getPlanIssuesRetryConfig(repoPath)).toBeResolvedTo({
        maxRetryCount: 5,
        errorSleepTime: 5
      });
    });

    it('defaults when the plan-issues section is absent', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), JSON.stringify({}));

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getPlanIssuesRetryConfig(repoPath)).toBeResolvedTo({
        maxRetryCount: 5,
        errorSleepTime: 5
      });
    });

    it('defaults when the keys are absent from the plan-issues section', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
        JSON.stringify({ 'plan-issues': {} })
      );

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getPlanIssuesRetryConfig(repoPath)).toBeResolvedTo({
        maxRetryCount: 5,
        errorSleepTime: 5
      });
    });

    it('reads numeric keys from the plan-issues section when present', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
        JSON.stringify({ 'plan-issues': { 'max-retry-count': 3, 'error-sleep-time': 2 } })
      );

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getPlanIssuesRetryConfig(repoPath)).toBeResolvedTo({
        maxRetryCount: 3,
        errorSleepTime: 2
      });
    });

    it('reads string-encoded numeric keys from the plan-issues section when present', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
        JSON.stringify({ 'plan-issues': { 'max-retry-count': '7', 'error-sleep-time': '1' } })
      );

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getPlanIssuesRetryConfig(repoPath)).toBeResolvedTo({
        maxRetryCount: 7,
        errorSleepTime: 1
      });
    });

    it('defaults to { maxRetryCount: 5, errorSleepTime: 5 } when the config file is malformed JSON', async () => {
      await mkdir(path.join(repoPath, '.claude', 'state'), { recursive: true });
      await writeFile(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), '{not valid json');

      const repoConfig = new RepoConfig();

      await expectAsync(repoConfig.getPlanIssuesRetryConfig(repoPath)).toBeResolvedTo({
        maxRetryCount: 5,
        errorSleepTime: 5
      });
    });
  });
});
