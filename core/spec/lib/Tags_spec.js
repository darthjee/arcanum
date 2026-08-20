import Tags from '../../lib/Tags.js';

describe('Tags', () => {
  describe('.extractTags', () => {
    it('maps recognized GitHub labels to their canonical tag names', () => {
      expect(Tags.extractTags(['Created', 'Ready for Work'])).toEqual(['created', 'ready_for_work']);
    });

    it('maps every documented label in the canonical table', () => {
      const labels = [
        'Created', 'Ready for Work', 'shipit', 'Working', 'Question', 'Fetched',
        'Refined', 'Ready', 'Enqueued', 'Idea', 'Writting', 'Enhancing', 'PR',
        'Planning', 'Split', 'Spawned'
      ];
      const expected = [
        'created', 'ready_for_work', 'shipit', 'working', 'question', 'fetched',
        'refined', 'ready', 'enqueued', 'idea', 'writting', 'enhancing', 'pr',
        'planning', 'split', 'spawned'
      ];

      expect(Tags.extractTags(labels)).toEqual(expected);
    });

    it('silently ignores unrecognized labels', () => {
      expect(Tags.extractTags(['Created', 'Bug', 'Feature'])).toEqual(['created']);
    });

    it('deduplicates while preserving first-occurrence order', () => {
      expect(Tags.extractTags(['Ready', 'Created', 'Ready'])).toEqual(['ready', 'created']);
    });

    it('returns an empty array for an empty/undefined input', () => {
      expect(Tags.extractTags([])).toEqual([]);
      expect(Tags.extractTags(undefined)).toEqual([]);
    });
  });
});
