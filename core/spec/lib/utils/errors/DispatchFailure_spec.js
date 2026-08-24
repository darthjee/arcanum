import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';

describe('DispatchFailure', () => {
  describe('#constructor', () => {
    it('stores the stdout payload verbatim on .stdout', () => {
      const failure = new DispatchFailure('STATUS=failed\n');

      expect(failure.stdout).toBe('STATUS=failed\n');
    });

    it('defaults .exitCode to 1 when omitted', () => {
      const failure = new DispatchFailure('STATUS=failed\n');

      expect(failure.exitCode).toBe(1);
    });

    it('stores an explicit exitCode argument on .exitCode', () => {
      const failure = new DispatchFailure('STATUS=failed\n', 2);

      expect(failure.exitCode).toBe(2);
    });

    it('is an instanceof Error and DispatchFailure with message "dispatch failure"', () => {
      const failure = new DispatchFailure('STATUS=failed\n');

      expect(failure).toBeInstanceOf(Error);
      expect(failure).toBeInstanceOf(DispatchFailure);
      expect(failure.message).toBe('dispatch failure');
    });
  });
});
