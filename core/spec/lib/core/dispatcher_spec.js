import Dispatcher from '../../../lib/core/dispatcher.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import ClaudeContext from '../../../lib/context/ClaudeContext.js';
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

describe('Dispatcher', () => {
  describe('context: \'none\' path (dispatch-fixture)', () => {
    let dispatcher;

    beforeEach(() => {
      dispatcher = new Dispatcher('dispatch-fixture', ['/would/blow/up', 'x']);
    });

    it('constructs the module with no RepoContext argument', async () => {
      const instance = await dispatcher.commandInstance();

      expect(instance.constructor.name).toEqual('DispatchFixture');
    });

    it('returns args unchanged from commandArgs()', () => {
      expect(dispatcher.commandArgs()).toEqual(['/would/blow/up', 'x']);
    });

    it('returns the command method result from dispatch()', async () => {
      expect(await dispatcher.dispatch()).toEqual('dispatch-fixture: ok\n');
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

  describe('repoContext getter', () => {
    it('is lazy — not built until first read', () => {
      const dispatcher = new Dispatcher('spawn-issue', ['/fake/repo']);

      expect(dispatcher._repoContext).toBeUndefined();
    });

    it('is memoized — repeated reads return the same instance', () => {
      const dispatcher = new Dispatcher('spawn-issue', ['/fake/repo']);

      expect(dispatcher.repoContext).toBe(dispatcher.repoContext);
    });
  });

  describe('claudeContext getter', () => {
    it('is lazy — not built until first read', () => {
      const dispatcher = new Dispatcher('permission-grant-add', ['/fake/anchor']);

      expect(dispatcher._claudeContext).toBeUndefined();
    });

    it('is memoized — repeated reads return the same instance', () => {
      const dispatcher = new Dispatcher('permission-grant-add', ['/fake/anchor']);

      expect(dispatcher.claudeContext).toBe(dispatcher.claudeContext);
    });
  });

  describe('InvocationLog recording', () => {
    it('awaits record() before importing the command module', async () => {
      const events = [];
      const dispatcher = new Dispatcher('dispatch-fixture-crash', [], {
        invocationLog: fakeInvocationLog(events)
      });
      const original = dispatcher.commandInstance.bind(dispatcher);

      spyOn(dispatcher, 'commandInstance').and.callFake(async () => {
        events.push('command-instance');
        return original();
      });

      await expectAsync(dispatcher.dispatch()).toBeRejected();

      expect(events).toEqual([
        'record-start:dispatch-fixture-crash',
        'record-end:dispatch-fixture-crash',
        'command-instance'
      ]);
    });

    it('records a crashing command before it crashes', async () => {
      const invocationLog = { record: jasmine.createSpy('record').and.resolveTo(undefined) };
      const dispatcher = new Dispatcher('dispatch-fixture-crash', [], { invocationLog });

      await expectAsync(dispatcher.dispatch()).toBeRejected();

      expect(invocationLog.record).toHaveBeenCalledWith('dispatch-fixture-crash');
    });

    it('does not record when the entry sets log: false', async () => {
      const invocationLog = { record: jasmine.createSpy('record').and.resolveTo(undefined) };
      const dispatcher = new Dispatcher('dispatch-fixture', [], { invocationLog });

      await dispatcher.dispatch();

      expect(invocationLog.record).not.toHaveBeenCalled();
    });
  });

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

    it('does NOT validate an absent leading arg — the command\'s own USAGE throw still wins (see #333)', async () => {
      const dispatcher = new Dispatcher('spawn-issue', [], { invocationLog: noopInvocationLog });

      spyOn(dispatcher.repoContext, 'validate').and.rejectWith(new Error('validate should not run'));

      await expectAsync(dispatcher.dispatch()).toBeRejectedWithError(/^Usage: spawn-issue/);
      expect(dispatcher.repoContext.validate).not.toHaveBeenCalled();
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
