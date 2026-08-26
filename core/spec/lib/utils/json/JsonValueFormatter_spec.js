import JsonValueFormatter from '../../../../lib/utils/json/JsonValueFormatter.js';

describe('JsonValueFormatter', () => {
  describe('#format', () => {
    it('returns "" for undefined', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format(undefined)).toEqual('');
    });

    it('returns "" for null', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format(null)).toEqual('');
    });

    it('returns "" for false', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format(false)).toEqual('');
    });

    it('returns the raw string for a string value', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format('A Title')).toEqual('A Title');
    });

    it('returns an empty string as-is for an empty string value', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format('')).toEqual('');
    });

    it('returns 2-space-indented JSON for an object value', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format({ priority: 'high' })).toEqual(JSON.stringify({ priority: 'high' }, null, 2));
    });

    it('returns 2-space-indented JSON for an array value', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format(['a', 'b'])).toEqual(JSON.stringify(['a', 'b'], null, 2));
    });

    it('returns "true" for boolean true', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format(true)).toEqual('true');
    });

    it('returns the stringified number for a numeric value', () => {
      const formatter = new JsonValueFormatter();

      expect(formatter.format(42)).toEqual('42');
    });
  });
});
