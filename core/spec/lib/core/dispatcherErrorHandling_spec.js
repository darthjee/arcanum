import Dispatcher from '../../../lib/core/dispatcher.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const noopInvocationLog = { record: async () => {} };

/**
 * Build a fake `InvocationLog` whose `record` appends ordering markers to
 * `events` and resolves on a later tick, so tests can assert the record
 * completes before the command module is imported.
 * @param {string[]} events - shared ordering log.
 * @returns {{ record: Function }} the fake logger.
 */
function fakeInvocationLog(events) {
  return {
    record: async (command) => {
      events.push(`record-start:${command}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      events.push(`record-end:${command}`);
    }
  };
}

describe('Dispatcher (error & repoPath validation)', () => {
  describe('unknown command', () => {
    it('rejects with an Error naming the command', async () => {
      const dispatcher = new Dispatcher('not-a-real-command', []);

      await expectAsync(dispatcher.dispatch()).toBeRejectedWithError(/not-a-real-command/);
    });
  });

  describe('context: \'repo\' repoPath validation', () => {
    it('rejects with "not a directory" for a present-but-non-directory leading arg, before importing the module', async () => {
      const missingPath = '/no/such/dispatcher/spec/path';
      const dispatcher = new Dispatcher('spawn-issue', [missingPath, 'a', 'b'], {
        invocationLog: noopInvocationLog
      });
      const commandInstanceSpy = spyOn(dispatcher, 'commandInstance').and.callThrough();

      await expectAsync(dispatcher.dispatch()).toBeRejectedWithError(
        `Error: not a directory: ${missingPath}`
      );
      expect(commandInstanceSpy).not.toHaveBeenCalled();
    });

    it('rejects with "not a git repository" for a directory-but-not-git leading arg', async () => {
      const dir = await createTempDir('arcanum-core-dispatcher-spec-');

      try {
        const dispatcher = new Dispatcher('spawn-issue', [dir, 'a', 'b'], {
          invocationLog: noopInvocationLog
        });
        const commandInstanceSpy = spyOn(dispatcher, 'commandInstance').and.callThrough();

        await expectAsync(dispatcher.dispatch()).toBeRejectedWithError(
          `Error: not a git repository: ${dir}`
        );
        expect(commandInstanceSpy).not.toHaveBeenCalled();
      } finally {
        await removeTempDir(dir);
      }
    });

    it('runs record() before validate(), and validate() before the module import', async () => {
      const events = [];
      const dispatcher = new Dispatcher('spawn-issue', ['/fake/repo', 'a', 'b'], {
        invocationLog: fakeInvocationLog(events)
      });

      spyOn(dispatcher.repoContext, 'validate').and.callFake(async () => {
        events.push('validate');
      });
      spyOn(dispatcher, 'commandInstance').and.callFake(async () => {
        events.push('command-instance');
        return { run: async () => { throw new Error('stop'); } };
      });

      await expectAsync(dispatcher.dispatch()).toBeRejectedWithError('stop');

      expect(events).toEqual([
        'record-start:spawn-issue',
        'record-end:spawn-issue',
        'validate',
        'command-instance'
      ]);
    });

    it('validates an absent leading arg — rejects with "repo_path is required" before importing the module (see #333)', async () => {
      const dispatcher = new Dispatcher('spawn-issue', [], { invocationLog: noopInvocationLog });
      const commandInstanceSpy = spyOn(dispatcher, 'commandInstance').and.callThrough();

      await expectAsync(dispatcher.dispatch()).toBeRejectedWithError(
        'Error: repo_path is required'
      );
      expect(commandInstanceSpy).not.toHaveBeenCalled();
    });

    it('skips validation for a validateRepoPath: false entry (github-issue-info)', async () => {
      const dispatcher = new Dispatcher('github-issue-info', ['/no/such/path'], {
        invocationLog: noopInvocationLog
      });

      spyOn(dispatcher, 'commandInstance').and.resolveTo({ info: async () => 'REACHED' });

      await expectAsync(dispatcher.dispatch()).toBeResolvedTo('REACHED');
    });

    it('never validates a context: \'claude\' entry', async () => {
      const dispatcher = new Dispatcher('permission-grant-add', ['/no/such/path', '/tmp/x.json', 'Bash(x)'], {
        invocationLog: noopInvocationLog
      });

      spyOn(dispatcher, 'commandInstance').and.resolveTo({ add: async () => 'ok' });

      await expectAsync(dispatcher.dispatch()).toBeResolvedTo('ok');
    });
  });
});
