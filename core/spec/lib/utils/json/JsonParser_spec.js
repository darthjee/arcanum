import JsonParser from '../../../../lib/utils/json/JsonParser.js';

describe('JsonParser', () => {
  describe('#parse', () => {
    it('returns { ok: true, value } for valid JSON', () => {
      const parser = new JsonParser();

      expect(parser.parse('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    });

    it('parses arrays', () => {
      const parser = new JsonParser();

      expect(parser.parse('["a","b"]')).toEqual({ ok: true, value: ['a', 'b'] });
    });

    it('parses primitive JSON values', () => {
      const parser = new JsonParser();

      expect(parser.parse('"a"')).toEqual({ ok: true, value: 'a' });
      expect(parser.parse('42')).toEqual({ ok: true, value: 42 });
      expect(parser.parse('null')).toEqual({ ok: true, value: null });
    });

    it('returns { ok: false } for invalid JSON, without throwing', () => {
      const parser = new JsonParser();

      expect(parser.parse('not json')).toEqual({ ok: false });
    });

    it('returns { ok: false } for empty input', () => {
      const parser = new JsonParser();

      expect(parser.parse('')).toEqual({ ok: false });
    });
  });
});
