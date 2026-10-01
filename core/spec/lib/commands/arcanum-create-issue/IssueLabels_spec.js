import IssueLabels from '../../../../lib/commands/arcanum-create-issue/IssueLabels.js';

describe('IssueLabels', () => {
  describe('.isValid', () => {
    it('accepts a regular label', () => {
      expect(IssueLabels.isValid('Ready for Work')).toBeTrue();
    });

    for (const label of ['', '   ', 'a,b', 'a\nb', 'a\rb']) {
      it(`rejects ${JSON.stringify(label)}`, () => {
        expect(IssueLabels.isValid(label)).toBeFalse();
      });
    }
  });

  describe('.dedupe', () => {
    it('trims and drops case-insensitive duplicates, keeping the first spelling', () => {
      expect(IssueLabels.dedupe([' Bug ', 'epic', 'BUG', 'Epic', 'Feature'])).toEqual(['Bug', 'epic', 'Feature']);
    });
  });

  describe('.hasEpic / .hasShipit / .withoutShipit', () => {
    it('detects Epic and shipit in any case', () => {
      expect(IssueLabels.hasEpic(['EPIC'])).toBeTrue();
      expect(IssueLabels.hasEpic(['Bug'])).toBeFalse();
      expect(IssueLabels.hasShipit(['ShipIt'])).toBeTrue();
      expect(IssueLabels.hasShipit([])).toBeFalse();
    });

    it('drops shipit in any case', () => {
      expect(IssueLabels.withoutShipit(['Bug', 'SHIPIT'])).toEqual(['Bug']);
    });
  });

  describe('#resolve', () => {
    let client;
    let warnings;

    beforeEach(() => {
      client = {
        listLabelNames: jasmine.createSpy('listLabelNames').and.resolveTo(['Writting', 'bug', 'Bug', 'Epic']),
        createLabel: jasmine.createSpy('createLabel').and.resolveTo()
      };
      warnings = [];
    });

    it('returns nothing and calls nothing for no labels', async () => {
      expect(await new IssueLabels(client).resolve([], warnings)).toEqual([]);
      expect(client.listLabelNames).not.toHaveBeenCalled();
    });

    it('uses the existing spelling (first match wins)', async () => {
      expect(await new IssueLabels(client).resolve(['writting', 'BUG', 'epic'], warnings))
        .toEqual(['Writting', 'bug', 'Epic']);
      expect(client.createLabel).not.toHaveBeenCalled();
      expect(warnings).toEqual([]);
    });

    it('creates a missing label with the neutral color and warns', async () => {
      expect(await new IssueLabels(client).resolve(['Feature'], warnings)).toEqual(['Feature']);
      expect(client.createLabel).toHaveBeenCalledOnceWith('Feature', 'ededed');
      expect(warnings).toEqual(['created label Feature']);
    });

    it('creates a missing Epic with fbca04 and suggests /arcanum-migrate', async () => {
      client.listLabelNames.and.resolveTo([]);

      expect(await new IssueLabels(client).resolve(['Epic'], warnings)).toEqual(['Epic']);
      expect(client.createLabel).toHaveBeenCalledOnceWith('Epic', 'fbca04');
      expect(warnings).toEqual(['created label Epic (run /arcanum-migrate to set up the Epic label)']);
    });

    it('propagates a create failure, keeping earlier warnings', async () => {
      client.createLabel.and.callFake(async (name) => {
        if (name === 'B') {
          throw new Error('Error: could not create label \'B\' on a/b');
        }
      });

      await expectAsync(new IssueLabels(client).resolve(['A', 'B'], warnings))
        .toBeRejectedWithError('Error: could not create label \'B\' on a/b');
      expect(warnings).toEqual(['created label A']);
    });
  });
});
