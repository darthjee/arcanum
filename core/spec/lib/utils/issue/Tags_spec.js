import Tags, { LABEL_TO_TAG, TAG_TO_LABEL } from '../../../../lib/utils/issue/Tags.js';

describe('Tags', () => {
  describe('TAG_TO_LABEL', () => {
    it('is the exact inversion of LABEL_TO_TAG', () => {
      const expected = Object.fromEntries(
        Object.entries(LABEL_TO_TAG).map(([label, tag]) => [tag, label])
      );

      expect(TAG_TO_LABEL).toEqual(expected);
    });

    it('maps every canonical tag back to its GitHub label', () => {
      expect(TAG_TO_LABEL.created).toEqual('Created');
      expect(TAG_TO_LABEL.ready_for_work).toEqual('Ready for Work');
      expect(TAG_TO_LABEL.shipit).toEqual('shipit');
    });
  });


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
