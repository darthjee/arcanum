import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RepoContext from '../../../lib/context/RepoContext.js';
import ResolveIdAndFile from '../../../lib/commands/ResolveIdAndFile.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

describe('ResolveIdAndFile', () => {
  let repoPath;
  const issuesFolder = 'docs/agents/issues';

  beforeEach(async () => {
    repoPath = await createTempDir();
    await mkdir(path.join(repoPath, issuesFolder), { recursive: true });
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('Scenario A — id and title provided', () => {
      it('returns STATUS=existing when a matching file is already present', async () => {
        await writeFile(path.join(repoPath, issuesFolder, '42_my_cool_issue.md'), 'content\n');
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#42 My Cool Issue');

        expect(output).toEqual(
          'SCENARIO=A\nID=42\nTITLE=My Cool Issue\nFILE=docs/agents/issues/42_my_cool_issue.md\nSTATUS=existing\n'
        );
      });

      it('supports the "- " title separator', async () => {
        await writeFile(path.join(repoPath, issuesFolder, '42_my_cool_issue.md'), 'content\n');
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#42 - My Cool Issue');

        expect(output).toContain('TITLE=My Cool Issue');
      });

      it('returns STATUS=new with NEEDS_FETCH=true and a snake_case FILE guess when no file matches', async () => {
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#123 My New Issue');

        expect(output).toEqual(
          'SCENARIO=A\nID=123\nTITLE=My New Issue\nFILE=docs/agents/issues/123_my_new_issue.md\nSTATUS=new\nNEEDS_FETCH=true\n'
        );
      });

      it('sanitizes symbols, uppercase, and repeated separators when building FILE', async () => {
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#9 Fix ##Weird!!  Title__here');

        expect(output).toContain('FILE=docs/agents/issues/9_fix_weird_title_here.md');
      });
    });

    describe('Scenario B — bare title, no id', () => {
      it('returns STATUS=missing_id with empty ID/FILE', async () => {
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, 'bare title');

        expect(output).toEqual('SCENARIO=B\nID=\nTITLE=bare title\nFILE=\nSTATUS=missing_id\n');
      });
    });

    describe('Scenario C — id only, no title', () => {
      it('derives TITLE from an underscore-separated matching filename', async () => {
        await writeFile(path.join(repoPath, issuesFolder, '42_my_cool_issue.md'), 'content\n');
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#42');

        expect(output).toEqual(
          'SCENARIO=C\nID=42\nTITLE=My Cool Issue\nFILE=docs/agents/issues/42_my_cool_issue.md\nSTATUS=existing\n'
        );
      });

      it('derives TITLE from a dash-separated matching filename', async () => {
        await writeFile(path.join(repoPath, issuesFolder, '7-some-title-here.md'), 'content\n');
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#7');

        expect(output).toEqual(
          'SCENARIO=C\nID=7\nTITLE=Some Title Here\nFILE=docs/agents/issues/7-some-title-here.md\nSTATUS=existing\n'
        );
      });

      it('returns STATUS=new with NEEDS_FETCH=true and empty TITLE/FILE when no file matches', async () => {
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#999');

        expect(output).toEqual('SCENARIO=C\nID=999\nTITLE=\nFILE=\nSTATUS=new\nNEEDS_FETCH=true\n');
      });
    });

    describe('a non-numeric id (hard failure)', () => {
      ['#abc', '#12x'].forEach((argString) => {
        it(`throws for '${argString}' with no STATUS= line`, async () => {
          const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

          await expectAsync(resolveIdAndFile.run(issuesFolder, argString)).toBeRejectedWithError(
            `Error: issue id must be numeric and linked to a GitHub issue (got '${argString.slice(1)}').` +
              ' Local-only ids are no longer supported.'
          );
        });
      });
    });

    describe('existing-file lookup scoping', () => {
      it('only matches <id>_*/<id>-* at the top level of issuesFolder, not recursively', async () => {
        await mkdir(path.join(repoPath, issuesFolder, 'nested'), { recursive: true });
        await writeFile(path.join(repoPath, issuesFolder, 'nested', '1_nested.md'), 'content\n');
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#1');

        expect(output).toEqual('SCENARIO=C\nID=1\nTITLE=\nFILE=\nSTATUS=new\nNEEDS_FETCH=true\n');
      });

      it('does not match a different id sharing the same prefix digits', async () => {
        await writeFile(path.join(repoPath, issuesFolder, '123_title.md'), 'content\n');
        const resolveIdAndFile = new ResolveIdAndFile(new RepoContext({ repoPath }));

        const output = await resolveIdAndFile.run(issuesFolder, '#12');

        expect(output).toEqual('SCENARIO=C\nID=12\nTITLE=\nFILE=\nSTATUS=new\nNEEDS_FETCH=true\n');
      });
    });
  });
});
