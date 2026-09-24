import path from 'node:path';
import InstallVersion from '../../../../lib/utils/file/InstallVersion.js';
import { fakeExecFileAsync, subcommand } from '../../../support/utils/fakeExecFileAsync.js';

const INSTALL = '/install/root';
const ARCANUM_JSON = path.join(INSTALL, 'arcanum.json');
const GIT_DIR = path.join(INSTALL, '.git');

/**
 * @param {string[]} paths - the paths that "exist".
 * @returns {Function} a fake `existsSync`.
 */
function existing(paths) {
  const set = new Set(paths);

  return (file) => set.has(file);
}

/**
 * @param {string|Error} contents - what `readFile` resolves to (or
 *   rejects with, for an `Error`).
 * @returns {Function} a jasmine spy usable as `readFile`.
 */
function readingAs(contents) {
  return jasmine.createSpy('readFile').and.callFake(async () => {
    if (contents instanceof Error) {
      throw contents;
    }

    return contents;
  });
}

/**
 * @param {string|Error} result - the `describe` stdout, or an error.
 * @returns {Function} a fake `execFileAsync` answering `git -C ... describe`.
 */
function describing(result) {
  return fakeExecFileAsync('git', [
    {
      match: (args) => subcommand('-C', INSTALL, 'describe', '--tags', '--exact-match')(args),
      respond: () => {
        if (result instanceof Error) {
          throw result;
        }

        return { stdout: result };
      }
    }
  ]);
}

describe('InstallVersion', () => {
  describe('#zipVersion', () => {
    it('returns arcanum.json .version', async () => {
      const readFile = readingAs(JSON.stringify({ version: '1.2.3' }));
      const version = new InstallVersion({ readFile });

      await expectAsync(version.zipVersion(INSTALL)).toBeResolvedTo('1.2.3');
      expect(readFile).toHaveBeenCalledWith(ARCANUM_JSON, 'utf8');
    });

    it('returns an empty string when .version is missing', async () => {
      const version = new InstallVersion({ readFile: readingAs('{"repo":"a/b"}') });

      await expectAsync(version.zipVersion(INSTALL)).toBeResolvedTo('');
    });

    it('returns an empty string when .version is null or false', async () => {
      await expectAsync(new InstallVersion({ readFile: readingAs('{"version":null}') }).zipVersion(INSTALL))
        .toBeResolvedTo('');
      await expectAsync(new InstallVersion({ readFile: readingAs('{"version":false}') }).zipVersion(INSTALL))
        .toBeResolvedTo('');
    });

    it('stringifies a non-string .version like jq -r does', async () => {
      const version = new InstallVersion({ readFile: readingAs('{"version":3}') });

      await expectAsync(version.zipVersion(INSTALL)).toBeResolvedTo('3');
    });

    it('returns an empty string when arcanum.json is malformed', async () => {
      const version = new InstallVersion({ readFile: readingAs('not json') });

      await expectAsync(version.zipVersion(INSTALL)).toBeResolvedTo('');
    });

    it('returns an empty string when arcanum.json is not an object', async () => {
      const version = new InstallVersion({ readFile: readingAs('"1.2.3"') });

      await expectAsync(version.zipVersion(INSTALL)).toBeResolvedTo('');
    });

    it('returns an empty string when arcanum.json is unreadable', async () => {
      const version = new InstallVersion({ readFile: readingAs(new Error('ENOENT')) });

      await expectAsync(version.zipVersion(INSTALL)).toBeResolvedTo('');
    });
  });

  describe('#exactTag', () => {
    it('returns the trimmed exact tag', async () => {
      const version = new InstallVersion({ execFileAsync: describing('1.2.3\n') });

      await expectAsync(version.exactTag(INSTALL)).toBeResolvedTo('1.2.3');
    });

    it('returns an empty string when git fails', async () => {
      const version = new InstallVersion({ execFileAsync: describing(new Error('no tag')) });

      await expectAsync(version.exactTag(INSTALL)).toBeResolvedTo('');
    });
  });

  describe('#resolve', () => {
    it('uses arcanum.json when it exists, even alongside .git', async () => {
      const execFileAsync = describing('9.9.9\n');
      const version = new InstallVersion({
        existsSync: existing([ARCANUM_JSON, GIT_DIR]),
        readFile: readingAs('{"version":"1.2.3"}'),
        execFileAsync
      });

      await expectAsync(version.resolve(INSTALL)).toBeResolvedTo('1.2.3');
      expect(execFileAsync).not.toHaveBeenCalled();
    });

    it('does not fall back to git when arcanum.json has no version', async () => {
      const version = new InstallVersion({
        existsSync: existing([ARCANUM_JSON, GIT_DIR]),
        readFile: readingAs('{}'),
        execFileAsync: describing('9.9.9\n')
      });

      await expectAsync(version.resolve(INSTALL)).toBeResolvedTo('');
    });

    it('uses the exact tag when only .git exists', async () => {
      const readFile = readingAs('{"version":"1.2.3"}');
      const version = new InstallVersion({
        existsSync: existing([GIT_DIR]),
        readFile,
        execFileAsync: describing('2.0.0\n')
      });

      await expectAsync(version.resolve(INSTALL)).toBeResolvedTo('2.0.0');
      expect(readFile).not.toHaveBeenCalled();
    });

    it('returns an empty string when neither exists', async () => {
      const version = new InstallVersion({ existsSync: existing([]) });

      await expectAsync(version.resolve(INSTALL)).toBeResolvedTo('');
    });
  });
});
