import { FileError, NpmError, TargetUnavailableError, UsageError } from '../../lib/exitCodes.js';
import { createOutput, errorMessage, formatValue, reportError, wantsJson } from '../../lib/output.js';
import { fakeIo } from '../support/fakeIo.js';

describe('output', () => {
  let io;

  beforeEach(() => {
    io = fakeIo();
  });

  describe('reportError', () => {
    it('prints the prefixed message and the hint', () => {
      const error = new FileError('/x is not valid JSON (line 3); refusing to overwrite it', { hint: 'fix or remove the file' });

      expect(reportError(io, error)).toBe(7);
      expect(io.err()).toBe(
        'arcanum: /x is not valid JSON (line 3); refusing to overwrite it\nhint: fix or remove the file\n'
      );
      expect(io.out()).toBe('');
    });

    it('points a usage error without a hint at --help', () => {
      expect(reportError(io, new UsageError('bad'))).toBe(2);
      expect(io.err()).toBe('arcanum: bad\nRun \'arcanum --help\' for usage.\n');
    });

    it('prints the JSON error object under --json', () => {
      const error = new TargetUnavailableError('no repo at /x/bar; --repo and --local need a git repo');

      expect(reportError(io, error, { json: true })).toBe(4);
      expect(JSON.parse(io.err())).toEqual({
        error: {
          code: 'target_unavailable', exit: 4,
          message: 'arcanum: no repo at /x/bar; --repo and --local need a git repo', hint: null
        }
      });
      expect(io.err().endsWith('}\n')).toBeTrue();
    });

    it('maps a foreign error to 1 in JSON mode', () => {
      reportError(io, new Error('boom'), { json: true });

      expect(JSON.parse(io.err()).error).toEqual({ code: 'error', exit: 1, message: 'arcanum: boom', hint: null });
    });

    it('prints an NpmError\'s captured npm lines after the hint', () => {
      const error = new NpmError('npm i -g failed (exit 1)', { hint: 'try again', npmOutput: 'npm error code E1\nnpm error boom' });

      expect(reportError(io, error)).toBe(8);
      expect(io.err()).toBe('arcanum: npm i -g failed (exit 1)\nhint: try again\nnpm error code E1\nnpm error boom\n');
    });

    it('keeps npm lines out of the JSON error object', () => {
      reportError(io, new NpmError('npm i -g failed (exit 1)', { npmOutput: 'npm error boom' }), { json: true });

      expect(JSON.parse(io.err())).toEqual({
        error: { code: 'npm', exit: 8, message: 'arcanum: npm i -g failed (exit 1)', hint: null }
      });
    });

    it('prints no stack trace by default', () => {
      reportError(io, new Error('boom'));

      expect(io.err()).toBe('arcanum: boom\n');
    });

    it('prints the stack trace under ARCANUM_DEBUG=1', () => {
      reportError(io, new Error('boom'), { env: { ARCANUM_DEBUG: '1' } });

      expect(io.err()).toContain('at ');
    });
  });

  describe('errorMessage', () => {
    it('strips a leading Error: or arcanum: prefix', () => {
      expect(errorMessage(new Error('Error: not a directory: /x'))).toBe('not a directory: /x');
      expect(errorMessage(new Error('arcanum: x'))).toBe('x');
    });

    it('stringifies a non-Error', () => {
      expect(errorMessage('boom')).toBe('boom');
    });
  });

  describe('createOutput', () => {
    it('prints the human text, newline-terminated', () => {
      createOutput(io).result('hello', { a: 1 });

      expect(io.out()).toBe('hello\n');
    });

    it('prints nothing for an empty human text', () => {
      createOutput(io).result('', {});

      expect(io.out()).toBe('');
    });

    it('prints exactly one JSON object under --json', () => {
      createOutput(io, { json: true }).result('hello', { a: 1 });

      expect(io.out()).toBe('{"a":1}\n');
    });

    it('prints warnings as plain text on stderr in both modes', () => {
      createOutput(io, { json: true }).warn('careful');

      expect(io.err()).toBe('arcanum: warning: careful\n');
      expect(io.out()).toBe('');
    });
  });

  describe('formatValue', () => {
    it('prints strings bare and others as compact JSON', () => {
      expect(formatValue('native')).toBe('native');
      expect(formatValue([1, 'a'])).toBe('[1,"a"]');
      expect(formatValue(true)).toBe('true');
    });
  });

  describe('wantsJson', () => {
    it('sees --json before --', () => {
      expect(wantsJson(['config', '--json'])).toBeTrue();
      expect(wantsJson(['config', '--', '--json'])).toBeFalse();
    });
  });
});
