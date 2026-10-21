import {
  EXIT_ERROR, EXIT_FILE, EXIT_LOCK_TIMEOUT, EXIT_OK, EXIT_TARGET_UNAVAILABLE, EXIT_USAGE,
  EXIT_VALIDATION, EXIT_VERSION_SKEW, UsageError, exitCodeForError
} from '../../lib/exitCodes.js';

describe('exitCodes', () => {
  it('numbers the exit codes 0 to 7', () => {
    expect([
      EXIT_OK, EXIT_ERROR, EXIT_USAGE, EXIT_VALIDATION, EXIT_TARGET_UNAVAILABLE,
      EXIT_VERSION_SKEW, EXIT_LOCK_TIMEOUT, EXIT_FILE
    ]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  describe('UsageError', () => {
    it('is an Error with the USAGE code', () => {
      const error = new UsageError('bad');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('bad');
      expect(error.code).toBe('USAGE');
      expect(error.name).toBe('UsageError');
    });
  });

  describe('exitCodeForError', () => {
    const withCode = (code, extra = {}) => Object.assign(new Error('x'), { code }, extra);

    it('maps a UsageError to 2', () => {
      expect(exitCodeForError(new UsageError('bad'))).toBe(EXIT_USAGE);
    });

    it('maps parseArgs errors to 2', () => {
      expect(exitCodeForError(withCode('ERR_PARSE_ARGS_UNKNOWN_OPTION'))).toBe(EXIT_USAGE);
    });

    it('maps LOCK_TIMEOUT to 6', () => {
      expect(exitCodeForError(withCode('LOCK_TIMEOUT'))).toBe(EXIT_LOCK_TIMEOUT);
    });

    it('maps NOT_AN_OBJECT and INVALID_JSON to 7', () => {
      expect(exitCodeForError(withCode('NOT_AN_OBJECT'))).toBe(EXIT_FILE);
      expect(exitCodeForError(withCode('INVALID_JSON'))).toBe(EXIT_FILE);
    });

    it('maps a Node errno error to 7', () => {
      expect(exitCodeForError(withCode('EACCES', { errno: -13, syscall: 'open' }))).toBe(EXIT_FILE);
    });

    it('maps UNREGISTERED_KEY to 1', () => {
      expect(exitCodeForError(withCode('UNREGISTERED_KEY'))).toBe(EXIT_ERROR);
    });

    it('maps an unrecognised error to 1', () => {
      expect(exitCodeForError(new Error('x'))).toBe(EXIT_ERROR);
      expect(exitCodeForError('x')).toBe(EXIT_ERROR);
      expect(exitCodeForError(undefined)).toBe(EXIT_ERROR);
      expect(exitCodeForError(withCode('ENOENT'))).toBe(EXIT_ERROR);
    });
  });
});
