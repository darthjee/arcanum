import { looksLikeJson, parseValue } from '../../lib/values.js';

// One case per row of the Value parsing table in
// docs/agents/specs/arcanum-cli/command-surface.md#value-parsing.
describe('values', () => {
  describe('parseValue', () => {
    const rows = [
      { input: '', plain: '', string: '' },
      { input: 'true', plain: true, string: 'true' },
      { input: 'false', plain: false, string: 'false' },
      { input: '42', plain: 42, string: '42' },
      { input: '-1.5', plain: -1.5, string: '-1.5' },
      { input: '1e3', plain: 1000, string: '1e3' },
      { input: 'null', plain: null, string: 'null' },
      { input: '[1,2]', plain: [1, 2], string: '[1,2]' },
      { input: '{"a":1}', plain: { a: 1 }, string: '{"a":1}' },
      { input: '"quoted"', plain: 'quoted', string: '"quoted"' },
      { input: ' 42 ', plain: ' 42 ', string: ' 42 ' },
      { input: 'native', plain: 'native', string: 'native' }
    ];

    rows.forEach(({ input, plain, string }) => {
      it(`parses ${JSON.stringify(input)} without --string`, () => {
        expect(parseValue(input)).toEqual({ value: plain, jsonError: null, precisionLoss: false });
      });

      it(`keeps ${JSON.stringify(input)} a string with --string`, () => {
        expect(parseValue(input, { string: true })).toEqual({ value: string, jsonError: null, precisionLoss: false });
      });
    });

    it('flags an integer beyond MAX_SAFE_INTEGER', () => {
      expect(parseValue('9007199254740993').precisionLoss).toBeTrue();
    });

    it('flags an overflow to infinity', () => {
      expect(parseValue('1e400').precisionLoss).toBeTrue();
    });

    it('keeps a big integer a string with --string', () => {
      expect(parseValue('9007199254740993', { string: true })).toEqual({
        value: '9007199254740993', jsonError: null, precisionLoss: false
      });
    });

    ['[1,', '{a:1}'].forEach((input) => {
      it(`stores ${input} (looks like JSON, is not) as a string with its parse error`, () => {
        const parsed = parseValue(input);

        expect(parsed.value).toBe(input);
        expect(parsed.jsonError).toEqual(jasmine.any(String));
      });

      it(`keeps ${input} a plain string with --string`, () => {
        expect(parseValue(input, { string: true }).jsonError).toBeNull();
      });
    });
  });

  describe('looksLikeJson', () => {
    it('does not trim', () => {
      expect(looksLikeJson(' [1]')).toBeFalse();
      expect(looksLikeJson('[1]')).toBeTrue();
    });
  });
});
