import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Dispatcher from '../../../lib/core/dispatcher.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import ClaudeContext from '../../../lib/context/ClaudeContext.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

describe('Dispatcher (context routing)', () => {
  describe('context: \'none\' path (auto-fix-all-config-get)', () => {
    let repoPath;
    let dispatcher;

    beforeEach(async () => {
      repoPath = await createTempDir('arcanum-core-dispatcher-spec-none-');
      await mkdir(path.join(repoPath, '.claude', 'configuration'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'),
        JSON.stringify({ 'auto-fix-all': { auto_merge: true } })
      );
      dispatcher = new Dispatcher('auto-fix-all-config-get', [repoPath, 'auto_merge']);
    });

    afterEach(async () => {
      await removeTempDir(repoPath);
    });

    it('constructs the module with no RepoContext argument', async () => {
      const instance = await dispatcher.commandInstance();

      expect(instance.constructor.name).toEqual('AutoFixAllConfig');
    });

    it('returns args unchanged from commandArgs()', () => {
      expect(dispatcher.commandArgs()).toEqual([repoPath, 'auto_merge']);
    });

    it('returns the command method result from dispatch()', async () => {
      expect(await dispatcher.dispatch()).toEqual('true\n');
    });

    it('never constructs a RepoContext', async () => {
      await dispatcher.dispatch();

      expect(dispatcher._repoContext).toBeUndefined();
    });
  });

  describe('context: \'repo\' path (spawn-issue)', () => {
    let dispatcher;

    beforeEach(() => {
      dispatcher = new Dispatcher('spawn-issue', ['/fake/repo', 'a', 'b']);
    });

    it('constructs the module with a RepoContext built from args[0]', async () => {
      const instance = await dispatcher.commandInstance();

      expect(instance.constructor.name).toEqual('SpawnIssue');
      expect(dispatcher.repoContext).toBeInstanceOf(RepoContext);
      expect(dispatcher.repoContext.repoPath).toEqual('/fake/repo');
    });

    it('strips the leading repoPath arg from commandArgs()', () => {
      expect(dispatcher.commandArgs()).toEqual(['a', 'b']);
    });
  });

  describe('context: \'claude\' path (permission-grant-add)', () => {
    let dispatcher;

    beforeEach(() => {
      dispatcher = new Dispatcher('permission-grant-add', [
        '/fake/anchor',
        '/tmp/x.json',
        'Bash(x)'
      ]);
    });

    it('constructs the module with a ClaudeContext built from args[0]', async () => {
      const instance = await dispatcher.commandInstance();

      expect(instance.constructor.name).toEqual('PermissionGrant');
      expect(instance._claudeContext).toBeInstanceOf(ClaudeContext);
      expect(instance._claudeContext.repoPath).toEqual('/fake/anchor');
    });

    it('strips the leading anchor arg from commandArgs()', () => {
      expect(dispatcher.commandArgs()).toEqual(['/tmp/x.json', 'Bash(x)']);
    });
  });
});
