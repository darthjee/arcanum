import { BOOLEAN_TOKEN_NAMES, parseBooleanToken } from '../../lib/booleanToken.js';
import { ValidationError } from '../../lib/exitCodes.js';

describe('booleanToken', () => {
  it('lists the accepted tokens', () => {
    expect(BOOLEAN_TOKEN_NAMES).toEqual(['on', 'off', 'true', 'false']);
  });

  for (const [token, value] of [['on', true], ['true', true], ['off', false], ['false', false]]) {
    it(`parses ${token} as ${value}`, () => {
      expect(parseBooleanToken('k', token)).toBe(value);
    });
  }

  for (const token of ['ON', 'Off', 'TRUE', 'yes', '1', '', 'toString']) {
    it(`refuses ${JSON.stringify(token)} with exit 3 and the accepted tokens`, () => {
      let error;

      try {
        parseBooleanToken('a.b', token);
      } catch (thrown) {
        error = thrown;
      }

      expect(error).toEqual(jasmine.any(ValidationError));
      expect(error.exit).toBe(3);
      expect(error.message).toBe(`a.b must be on or off, got ${JSON.stringify(token)}`);
      expect(error.hint).toBe('accepted: on, off, true, false (lowercase)');
    });
  }
});
