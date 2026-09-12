import DiscussIssueConfirm from '../../../../lib/commands/discuss-issue/DiscussIssueConfirm.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';

/**
 * @param {Promise} promise - the promise to await and capture a
 *   rejection from.
 * @returns {Promise<Error|undefined>} the rejection, or `undefined` if
 *   the promise resolved.
 */
async function captureRejection(promise) {
  try {
    await promise;

    return undefined;
  } catch (error) {
    return error;
  }
}

describe('DiscussIssueConfirm', () => {
  let confirm;

  beforeEach(() => {
    confirm = new DiscussIssueConfirm();
  });

  const AFFIRMATIVE_WORDS = ['yes', 'y', 'sim', 'correct', 'looks good', 'sure', 'ok', 'okay'];

  describe('affirmative replies', () => {
    AFFIRMATIVE_WORDS.forEach((word) => {
      it(`resolves for "${word}"`, async () => {
        await expectAsync(confirm.run(word)).toBeResolved();
      });

      it(`resolves for "${word}" uppercased`, async () => {
        await expectAsync(confirm.run(word.toUpperCase())).toBeResolved();
      });

      it(`resolves for "${word}" with surrounding whitespace`, async () => {
        await expectAsync(confirm.run(`  ${word}  `)).toBeResolved();
      });

      it(`resolves for "${word}" with a trailing period`, async () => {
        await expectAsync(confirm.run(`${word}.`)).toBeResolved();
      });

      it(`resolves for "${word}" with a trailing exclamation mark`, async () => {
        await expectAsync(confirm.run(`${word}!`)).toBeResolved();
      });

      it(`resolves for "${word}" with a trailing question mark`, async () => {
        await expectAsync(confirm.run(`${word}?`)).toBeResolved();
      });
    });
  });

  describe('negative replies', () => {
    ['no', 'n', 'não', 'nao', 'nope'].forEach((word) => {
      it(`rejects with a DispatchFailure (stdout "", exit code 1) for "${word}"`, async () => {
        const thrown = await captureRejection(confirm.run(word));

        expect(thrown).toBeInstanceOf(DispatchFailure);
        expect(thrown.stdout).toEqual('');
        expect(thrown.exitCode).toEqual(1);
      });
    });
  });

  describe('an unrecognized reply', () => {
    it('rejects with a DispatchFailure (stdout "", exit code 1)', async () => {
      const thrown = await captureRejection(confirm.run('maybe later'));

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });

  describe('a missing argument', () => {
    it('rejects with a DispatchFailure (stdout "", exit code 1), not a plain Error', async () => {
      const thrown = await captureRejection(confirm.run());

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });

  describe('an empty-string argument', () => {
    it('rejects with a DispatchFailure (stdout "", exit code 1)', async () => {
      const thrown = await captureRejection(confirm.run(''));

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });
});
