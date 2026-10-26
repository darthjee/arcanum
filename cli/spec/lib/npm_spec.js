import { InterruptedError, NpmError, exitCodeForError } from '../../lib/exitCodes.js';
import { classifyNpmError, lastLines, npmErrorCode, runNpm } from '../../lib/npm.js';

describe('npm', () => {
  const failing = (fields) => jasmine.createSpy('execFileAsync').and.callFake(
    () => Promise.reject(Object.assign(new Error('Command failed'), fields))
  );

  const rejection = async (promise) => {
    try {
      await promise;
    } catch (error) {
      return error;
    }

    throw new Error('expected a rejection');
  };

  describe('runNpm', () => {
    it('passes the argv through unchanged, with no shell, and forwards the timeout', async () => {
      const execFileAsync = jasmine.createSpy('execFileAsync').and.resolveTo({ stdout: '"2.3.0"\n', stderr: '' });
      const args = ['view', 'arcanum-cli@latest', 'version', '--json'];

      expect(await runNpm(args, { timeout: 30000, execFileAsync })).toEqual({ stdout: '"2.3.0"\n', stderr: '' });
      expect(execFileAsync).toHaveBeenCalledOnceWith('npm', args, { timeout: 30000 });
      expect(execFileAsync.calls.argsFor(0)[2].shell).toBeUndefined();
    });

    it('defaults to no timeout', async () => {
      const execFileAsync = jasmine.createSpy('execFileAsync').and.resolveTo({ stdout: '', stderr: '' });

      await runNpm(['root', '-g'], { execFileAsync });

      expect(execFileAsync.calls.argsFor(0)[2]).toEqual({ timeout: 0 });
    });

    it('maps a spawn ENOENT to npm not found on PATH (exit 8)', async () => {
      const error = await rejection(runNpm(['root', '-g'], {
        execFileAsync: failing({ code: 'ENOENT', errno: -2, syscall: 'spawn npm' })
      }));

      expect(error).toBeInstanceOf(NpmError);
      expect(error.message).toBe('npm not found on PATH');
      expect(error.hint).toBe('install Node.js and npm, then run it again');
      expect(error.category).toBe('not_installed');
      expect(exitCodeForError(error)).toBe(8);
    });

    it('classifies the execFile timeout', async () => {
      const error = await rejection(runNpm(['root', '-g'], {
        timeout: 15000, execFileAsync: failing({ killed: true, signal: 'SIGTERM', code: null, stderr: '' })
      }));

      expect(error).toBeInstanceOf(NpmError);
      expect(error.category).toBe('timeout');
    });

    it('maps a SIGINT to an InterruptedError (exit 130)', async () => {
      const error = await rejection(runNpm(['i', '-g'], {
        execFileAsync: failing({ killed: false, signal: 'SIGINT', code: null, stderr: '' })
      }));

      expect(error).toBeInstanceOf(InterruptedError);
      expect(exitCodeForError(error)).toBe(130);
    });

    [
      ['npm error code EACCES', 'permission'],
      ['npm ERR! code EPERM', 'permission'],
      ['npm error code E404', 'not_found'],
      ['npm error code ECONNREFUSED', 'network'],
      ['npm error code ENOTFOUND', 'network'],
      ['npm error code EAI_AGAIN', 'network'],
      ['npm error code ETIMEDOUT', 'network'],
      ['npm error code ECONNRESET', 'network'],
      ['npm ERR! code ERR_SOCKET_TIMEOUT', 'network'],
      ['npm error code ETARGET', 'failed'],
      ['something unexpected', 'failed']
    ].forEach(([stderr, category]) => {
      it(`classifies '${stderr}' as ${category}`, async () => {
        const error = await rejection(runNpm(['i', '-g'], { execFileAsync: failing({ code: 1, stderr }) }));

        expect(error).toBeInstanceOf(NpmError);
        expect(error.category).toBe(category);
        expect(error.npmExit).toBe(1);
        expect(error.npmOutput).toBe(stderr);
      });
    });

    it('keeps the last 10 stderr lines and npm\'s exit code', async () => {
      const stderr = Array.from({ length: 15 }, (_, index) => `line ${index + 1}`).join('\n');
      const error = await rejection(runNpm(['i', '-g'], { execFileAsync: failing({ code: 243, stderr }) }));

      expect(error.npmOutput.split('\n')).toEqual(Array.from({ length: 10 }, (_, index) => `line ${index + 6}`));
      expect(error.npmExit).toBe(243);
      expect(error.message).toBe('npm i -g failed (exit 243)');
    });
  });

  describe('classifyNpmError', () => {
    it('words a missing exit code as unknown', () => {
      const error = classifyNpmError(['x'], { code: 'EPIPE' });

      expect(error.message).toBe('npm x failed (exit unknown)');
      expect(error.npmExit).toBeNull();
      expect(error.npmOutput).toBeNull();
    });
  });

  describe('lastLines', () => {
    it('drops blank lines and is null when empty', () => {
      expect(lastLines('a\n\n b\n')).toBe('a\n b');
      expect(lastLines('')).toBeNull();
      expect(lastLines(undefined)).toBeNull();
    });
  });

  describe('npmErrorCode', () => {
    it('reads npm 9+ and older error codes', () => {
      expect(npmErrorCode('npm error code EACCES\nnpm error syscall mkdir')).toBe('EACCES');
      expect(npmErrorCode('npm ERR! code E404')).toBe('E404');
      expect(npmErrorCode('nope')).toBeNull();
    });
  });
});
