import Dispatcher from '../../../lib/core/dispatcher.js';

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

describe('Dispatcher (InvocationLog recording)', () => {
  // These unit-level crash-survival proofs anchor on the already-registered
  // real context: 'none' command auto-fix-all-config-get plus a mocked
  // commandInstance() that returns a synthetic instance whose entry method
  // throws — standing in for a real crash. Since commandInstance()/
  // entryMethod() are plain registry lookups, no command module actually has
  // to crash here, so this no longer depends on dispatch-fixture-crash /
  // DispatchFixture.js (see #342). The process-level proof in
  // core/spec/bin/arcanum_spec.js still needs the real crashing fixture.
  describe('InvocationLog recording', () => {
    it('awaits record() before importing the command module', async () => {
      const events = [];
      const dispatcher = new Dispatcher('auto-fix-all-config-get', [], {
        invocationLog: fakeInvocationLog(events)
      });

      spyOn(dispatcher, 'commandInstance').and.callFake(async () => {
        events.push('command-instance');
        return { [dispatcher.entryMethod()]: () => { throw new Error('simulated crash'); } };
      });

      await expectAsync(dispatcher.dispatch()).toBeRejected();

      expect(events).toEqual([
        'record-start:auto-fix-all-config-get',
        'record-end:auto-fix-all-config-get',
        'command-instance'
      ]);
    });

    it('records a crashing command before it crashes', async () => {
      const invocationLog = { record: jasmine.createSpy('record').and.resolveTo(undefined) };
      const dispatcher = new Dispatcher('auto-fix-all-config-get', [], { invocationLog });

      spyOn(dispatcher, 'commandInstance').and.resolveTo({
        [dispatcher.entryMethod()]: () => { throw new Error('simulated crash'); }
      });

      await expectAsync(dispatcher.dispatch()).toBeRejected();

      expect(invocationLog.record).toHaveBeenCalledWith('auto-fix-all-config-get');
    });
  });
});
