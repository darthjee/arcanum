import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import DiscussIssueRenderIssue from '../../../../lib/commands/discuss-issue/DiscussIssueRenderIssue.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const TEMPLATE = [
  '# Issue: %%TITLE%%',
  '',
  '%%DESCRIPTION%%',
  '',
  '%%PROBLEM%%',
  '',
  '%%EXPECTED_BEHAVIOR%%',
  '',
  '%%SOLUTION%%',
  '',
  '%%BENEFITS%%',
  ''
].join('\n');

describe('DiscussIssueRenderIssue', () => {
  let repoPath;
  let outputFile;

  beforeEach(async () => {
    repoPath = await createTempDir();
    await mkdir(path.join(repoPath, 'discuss-issue', 'templates'), { recursive: true });
    await writeFile(path.join(repoPath, 'discuss-issue', 'templates', 'issue.tmpl.md'), TEMPLATE);
    outputFile = path.join(repoPath, 'issue.md');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    it('renders every section when all arguments are present', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await discussIssueRenderIssue.run(
        outputFile,
        'Something broke',
        '## Description\nDesc text',
        '## Problem\nProb text',
        '## Expected Behavior\nExp text',
        '## Solution\nSol text',
        '## Benefits\nBen text'
      );

      const content = await readFile(outputFile, 'utf8');

      expect(content).toEqual(
        [
          '# Issue: Something broke',
          '',
          '## Description',
          'Desc text',
          '',
          '## Problem',
          'Prob text',
          '',
          '## Expected Behavior',
          'Exp text',
          '',
          '## Solution',
          'Sol text',
          '',
          '## Benefits',
          'Ben text',
          ''
        ].join('\n')
      );
    });

    it('collapses the blank lines left behind by an omitted description section', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await discussIssueRenderIssue.run(
        outputFile,
        'Something broke',
        '',
        '## Problem\nProb text',
        '## Expected Behavior\nExp text',
        '## Solution\nSol text',
        '## Benefits\nBen text'
      );

      const content = await readFile(outputFile, 'utf8');

      expect(content).toEqual(
        [
          '# Issue: Something broke',
          '',
          '## Problem',
          'Prob text',
          '',
          '## Expected Behavior',
          'Exp text',
          '',
          '## Solution',
          'Sol text',
          '',
          '## Benefits',
          'Ben text',
          ''
        ].join('\n')
      );
    });

    it('collapses the blank lines left behind by an omitted problem section', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await discussIssueRenderIssue.run(
        outputFile,
        'Something broke',
        '## Description\nDesc text',
        '',
        '## Expected Behavior\nExp text',
        '## Solution\nSol text',
        '## Benefits\nBen text'
      );

      const content = await readFile(outputFile, 'utf8');

      expect(content).toEqual(
        [
          '# Issue: Something broke',
          '',
          '## Description',
          'Desc text',
          '',
          '## Expected Behavior',
          'Exp text',
          '',
          '## Solution',
          'Sol text',
          '',
          '## Benefits',
          'Ben text',
          ''
        ].join('\n')
      );
    });

    it('collapses the blank lines left behind by an omitted expected_behavior section', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await discussIssueRenderIssue.run(
        outputFile,
        'Something broke',
        '## Description\nDesc text',
        '## Problem\nProb text',
        '',
        '## Solution\nSol text',
        '## Benefits\nBen text'
      );

      const content = await readFile(outputFile, 'utf8');

      expect(content).toEqual(
        [
          '# Issue: Something broke',
          '',
          '## Description',
          'Desc text',
          '',
          '## Problem',
          'Prob text',
          '',
          '## Solution',
          'Sol text',
          '',
          '## Benefits',
          'Ben text',
          ''
        ].join('\n')
      );
    });

    it('collapses the blank lines left behind by an omitted solution section', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await discussIssueRenderIssue.run(
        outputFile,
        'Something broke',
        '## Description\nDesc text',
        '## Problem\nProb text',
        '## Expected Behavior\nExp text',
        '',
        '## Benefits\nBen text'
      );

      const content = await readFile(outputFile, 'utf8');

      expect(content).toEqual(
        [
          '# Issue: Something broke',
          '',
          '## Description',
          'Desc text',
          '',
          '## Problem',
          'Prob text',
          '',
          '## Expected Behavior',
          'Exp text',
          '',
          '## Benefits',
          'Ben text',
          ''
        ].join('\n')
      );
    });

    it('trims a trailing blank line left behind by an omitted benefits section', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await discussIssueRenderIssue.run(
        outputFile,
        'Something broke',
        '## Description\nDesc text',
        '## Problem\nProb text',
        '## Expected Behavior\nExp text',
        '## Solution\nSol text',
        ''
      );

      const content = await readFile(outputFile, 'utf8');

      expect(content).toEqual(
        [
          '# Issue: Something broke',
          '',
          '## Description',
          'Desc text',
          '',
          '## Problem',
          'Prob text',
          '',
          '## Expected Behavior',
          'Exp text',
          '',
          '## Solution',
          'Sol text',
          ''
        ].join('\n')
      );
    });

    it('collapses a longer blank-line run left behind by multiple consecutive omissions', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await discussIssueRenderIssue.run(
        outputFile,
        'Something broke',
        '## Description\nDesc text',
        '',
        '',
        '',
        '## Benefits\nBen text'
      );

      const content = await readFile(outputFile, 'utf8');

      expect(content).toEqual(
        ['# Issue: Something broke', '', '## Description', 'Desc text', '', '## Benefits', 'Ben text', ''].join('\n')
      );
    });

    it('throws and writes no file when outputFile is missing', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await expectAsync(
        discussIssueRenderIssue.run('', 'Something broke', '## Description\nDesc text')
      ).toBeRejectedWithError();

      const exists = await access(outputFile)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBeFalse();
    });

    it('throws and writes no file when title is missing', async () => {
      const discussIssueRenderIssue = new DiscussIssueRenderIssue(new RepoContext({ repoPath }));

      await expectAsync(
        discussIssueRenderIssue.run(outputFile, '', '## Description\nDesc text')
      ).toBeRejectedWithError();

      const exists = await access(outputFile)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBeFalse();
    });
  });
});
