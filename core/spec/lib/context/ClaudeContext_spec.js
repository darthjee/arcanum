import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ClaudeContext from '../../../lib/context/ClaudeContext.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const REPO_PATH = '/fake/repo';

describe('ClaudeContext', () => {
  const tempDirs = [];

  function newContext(overrides = {}) {
    return new ClaudeContext({
      repoPath: REPO_PATH,
      env: {},
      ...overrides
    });
  }

  async function newTempDir(prefix) {
    const dir = await createTempDir(prefix);

    tempDirs.push(dir);

    return dir;
  }

  afterEach(async () => {
    while (tempDirs.length > 0) {
      await removeTempDir(tempDirs.pop());
    }
  });

  describe('#resolve', () => {
    it('returns an absolute path unchanged', () => {
      const context = newContext();

      expect(context.resolve('/etc/settings.json')).toEqual('/etc/settings.json');
    });

    it('resolves a relative path against repoPath, not process.cwd()', () => {
      const context = newContext();

      expect(context.resolve('.claude/settings.json')).toEqual('/fake/repo/.claude/settings.json');
    });
  });

  describe('#localSettingsPath', () => {
    it('points at .claude/settings.local.json under repoPath', () => {
      const context = newContext();

      expect(context.localSettingsPath()).toEqual('/fake/repo/.claude/settings.local.json');
    });
  });

  describe('#projectSettingsPath', () => {
    it('points at .claude/settings.json under repoPath', () => {
      const context = newContext();

      expect(context.projectSettingsPath()).toEqual('/fake/repo/.claude/settings.json');
    });
  });

  describe('#globalSettingsPath', () => {
    it('uses CLAUDE_CONFIG_DIR when set', () => {
      const context = newContext({ env: { CLAUDE_CONFIG_DIR: '/custom/claude', HOME: '/home/me' } });

      expect(context.globalSettingsPath()).toEqual('/custom/claude/settings.json');
    });

    it('falls back to $HOME/.claude when CLAUDE_CONFIG_DIR is unset', () => {
      const context = newContext({ env: { HOME: '/home/me' } });

      expect(context.globalSettingsPath()).toEqual('/home/me/.claude/settings.json');
    });
  });

  describe('#configDir', () => {
    it('uses CLAUDE_CONFIG_DIR when set', () => {
      const context = newContext({ env: { CLAUDE_CONFIG_DIR: '/custom/claude', HOME: '/home/me' } });

      expect(context.configDir()).toEqual('/custom/claude');
    });

    it('falls back to $HOME/.claude when CLAUDE_CONFIG_DIR is unset', () => {
      const context = newContext({ env: { HOME: '/home/me' } });

      expect(context.configDir()).toEqual('/home/me/.claude');
    });
  });

  describe('#installRoot', () => {
    it('returns repoPath', () => {
      const context = newContext();

      expect(context.installRoot()).toEqual('/fake/repo');
    });
  });

  describe('#bootstrapPath', () => {
    it('points at arcanum/update/bootstrap.sh under repoPath', () => {
      const context = newContext();

      expect(context.bootstrapPath()).toEqual('/fake/repo/arcanum/update/bootstrap.sh');
    });
  });

  describe('#arcanumJsonPath', () => {
    it('points at arcanum.json under repoPath', () => {
      const context = newContext();

      expect(context.arcanumJsonPath()).toEqual('/fake/repo/arcanum.json');
    });
  });

  describe('#gitDirPath', () => {
    it('points at .git under repoPath', () => {
      const context = newContext();

      expect(context.gitDirPath()).toEqual('/fake/repo/.git');
    });
  });

  describe('#validateInstall', () => {
    it('resolves when bootstrap.sh and arcanum.json are present and the install root matches', async () => {
      const tmp = await newTempDir('arcanum-core-claude-context-spec-');
      await mkdir(path.join(tmp, 'arcanum', 'update'), { recursive: true });
      await writeFile(path.join(tmp, 'arcanum', 'update', 'bootstrap.sh'), '');
      await writeFile(path.join(tmp, 'arcanum.json'), '{}');
      const context = newContext({ repoPath: tmp, runtimeInstallRoot: tmp });

      await expectAsync(context.validateInstall()).toBeResolved();
    });

    it('resolves when bootstrap.sh and .git are present (no arcanum.json)', async () => {
      const tmp = await newTempDir('arcanum-core-claude-context-spec-');
      await mkdir(path.join(tmp, 'arcanum', 'update'), { recursive: true });
      await writeFile(path.join(tmp, 'arcanum', 'update', 'bootstrap.sh'), '');
      await mkdir(path.join(tmp, '.git'));
      const context = newContext({ repoPath: tmp, runtimeInstallRoot: tmp });

      await expectAsync(context.validateInstall()).toBeResolved();
    });

    it('rejects with a missing_arcanum DispatchFailure when bootstrap.sh is absent', async () => {
      const tmp = await newTempDir('arcanum-core-claude-context-spec-');
      await writeFile(path.join(tmp, 'arcanum.json'), '{}');
      const context = newContext({ repoPath: tmp, runtimeInstallRoot: tmp });

      let caught;

      try {
        await context.validateInstall();
      } catch (error) {
        caught = error;
      }

      expect(caught.stdout).toEqual('STATUS=missing_arcanum\n');
      expect(caught.exitCode).toEqual(1);
    });

    it('rejects with a missing_arcanum DispatchFailure when neither arcanum.json nor .git is present', async () => {
      const tmp = await newTempDir('arcanum-core-claude-context-spec-');
      await mkdir(path.join(tmp, 'arcanum', 'update'), { recursive: true });
      await writeFile(path.join(tmp, 'arcanum', 'update', 'bootstrap.sh'), '');
      const context = newContext({ repoPath: tmp, runtimeInstallRoot: tmp });

      let caught;

      try {
        await context.validateInstall();
      } catch (error) {
        caught = error;
      }

      expect(caught.stdout).toEqual('STATUS=missing_arcanum\n');
      expect(caught.exitCode).toEqual(1);
    });

    it('rejects with an Error naming both paths when the install root does not match the running install', async () => {
      const tmp = await newTempDir('arcanum-core-claude-context-spec-');
      const other = await newTempDir('arcanum-core-claude-context-spec-other-');
      await mkdir(path.join(tmp, 'arcanum', 'update'), { recursive: true });
      await writeFile(path.join(tmp, 'arcanum', 'update', 'bootstrap.sh'), '');
      await writeFile(path.join(tmp, 'arcanum.json'), '{}');
      const context = newContext({ repoPath: tmp, runtimeInstallRoot: other });

      await expectAsync(context.validateInstall()).toBeRejectedWith(
        jasmine.objectContaining({
          message: jasmine.stringMatching(new RegExp(`${tmp}.*${other}`))
        })
      );
    });

    it('resolves when repoPath is a symlink to the runtime install root', async () => {
      const tmp = await newTempDir('arcanum-core-claude-context-spec-');
      await mkdir(path.join(tmp, 'arcanum', 'update'), { recursive: true });
      await writeFile(path.join(tmp, 'arcanum', 'update', 'bootstrap.sh'), '');
      await writeFile(path.join(tmp, 'arcanum.json'), '{}');

      const linkParent = await newTempDir('arcanum-core-claude-context-spec-link-parent-');
      const link = path.join(linkParent, 'anchor');
      await symlink(tmp, link);

      const context = newContext({ repoPath: link, runtimeInstallRoot: tmp });

      await expectAsync(context.validateInstall()).toBeResolved();
    });
  });

  describe('defaults', () => {
    it('stores repoPath', () => {
      const context = new ClaudeContext({ repoPath: REPO_PATH });

      expect(context.repoPath).toEqual(REPO_PATH);
    });
  });
});
