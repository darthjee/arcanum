import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ResolveAndFetch from '../../lib/ResolveAndFetch.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

/**
 * @param {object} [overrides] - collaborator overrides.
 * @returns {ResolveAndFetch} an instance with a no-op safeBranch and a
 *   githubIssue stub that always fails, unless overridden.
 */
function buildResolveAndFetch(overrides = {}) {
  const safeBranch = overrides.safeBranch || { checkout: jasmine.createSpy('checkout').and.resolveTo(undefined) };
  const githubIssue = overrides.githubIssue || {
    fetch: jasmine.createSpy('fetch').and.rejectWith(new Error('Error: could not fetch issue #0 from o/r'))
  };

  return new ResolveAndFetch({ safeBranch, githubIssue });
}

describe('ResolveAndFetch', () => {
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
    it('checks out the safe branch before doing anything else', async () => {
      const safeBranch = { checkout: jasmine.createSpy('checkout').and.resolveTo(undefined) };
      const resolveAndFetch = buildResolveAndFetch({ safeBranch });

      await resolveAndFetch.run(repoPath, issuesFolder, 'not-valid');

      expect(safeBranch.checkout).toHaveBeenCalledWith(repoPath);
    });

    it('propagates a dirty-tree hard failure uncaught (no STATUS= output)', async () => {
      const safeBranch = {
        checkout: jasmine.createSpy('checkout').and.rejectWith(new Error('Error: working tree has uncommitted changes'))
      };
      const resolveAndFetch = buildResolveAndFetch({ safeBranch });

      await expectAsync(resolveAndFetch.run(repoPath, issuesFolder, '#1')).toBeRejectedWithError(
        /uncommitted changes/
      );
    });

    describe('malformed input', () => {
      const cases = ['', '   ', '#abc', '#193 - title', 'bare title', '#', '193', '# 1'];

      cases.forEach((argString) => {
        it(`returns STATUS=error for '${argString}'`, async () => {
          const resolveAndFetch = buildResolveAndFetch();

          const output = await resolveAndFetch.run(repoPath, issuesFolder, argString);

          expect(output).toEqual(`STATUS=error\nERROR=Error: invalid input '${argString}' — expected '#<id>'\n`);
        });
      });
    });

    describe('valid input with surrounding whitespace', () => {
      it('trims before parsing', async () => {
        const githubIssue = {
          fetch: jasmine
            .createSpy('fetch')
            .and.resolveTo({ title: 'T', file: 'docs/agents/issues/1-t.md', domain: 'github.com', repo: 'o/r' })
        };
        const resolveAndFetch = buildResolveAndFetch({ githubIssue });

        const output = await resolveAndFetch.run(repoPath, issuesFolder, '  #1  ');

        expect(output).toContain('ID=1');
      });
    });

    describe('an existing local file', () => {
      it('returns STATUS=ok from the filename, without calling the GitHub fetcher', async () => {
        await writeFile(path.join(repoPath, issuesFolder, '42_my_cool_issue.md'), 'content\n');
        const githubIssue = { fetch: jasmine.createSpy('fetch') };
        const resolveAndFetch = buildResolveAndFetch({ githubIssue });

        const output = await resolveAndFetch.run(repoPath, issuesFolder, '#42');

        expect(output).toEqual('STATUS=ok\nID=42\nTITLE=My Cool Issue\nFILE=docs/agents/issues/42_my_cool_issue.md\n');
        expect(githubIssue.fetch).not.toHaveBeenCalled();
      });

      it('derives TITLE from a dash-separated filename', async () => {
        await writeFile(path.join(repoPath, issuesFolder, '7-some-title-here.md'), 'content\n');
        const resolveAndFetch = buildResolveAndFetch();

        const output = await resolveAndFetch.run(repoPath, issuesFolder, '#7');

        expect(output).toEqual('STATUS=ok\nID=7\nTITLE=Some Title Here\nFILE=docs/agents/issues/7-some-title-here.md\n');
      });
    });

    describe('no existing file — a fresh GitHub fetch', () => {
      it('returns STATUS=ok with DOMAIN/REPO on success', async () => {
        const githubIssue = {
          fetch: jasmine.createSpy('fetch').and.resolveTo({
            title: 'Fresh Issue',
            file: 'docs/agents/issues/9-fresh-issue.md',
            domain: 'github.com',
            repo: 'darthjee/arcanum'
          })
        };
        const resolveAndFetch = buildResolveAndFetch({ githubIssue });

        const output = await resolveAndFetch.run(repoPath, issuesFolder, '#9');

        expect(output).toEqual(
          'STATUS=ok\nID=9\nTITLE=Fresh Issue\nFILE=docs/agents/issues/9-fresh-issue.md\nDOMAIN=github.com\nREPO=darthjee/arcanum\n'
        );
        expect(githubIssue.fetch).toHaveBeenCalledWith(repoPath, '9');
      });

      it('returns STATUS=error with ID set on a GitHub fetch failure', async () => {
        const githubIssue = {
          fetch: jasmine
            .createSpy('fetch')
            .and.rejectWith(new Error('Error: could not fetch issue #9 from darthjee/arcanum'))
        };
        const resolveAndFetch = buildResolveAndFetch({ githubIssue });

        const output = await resolveAndFetch.run(repoPath, issuesFolder, '#9');

        expect(output).toEqual('STATUS=error\nID=9\nERROR=Error: could not fetch issue #9 from darthjee/arcanum\n');
      });

      it('returns STATUS=error with the exact auth-failure message', async () => {
        const githubIssue = {
          fetch: jasmine
            .createSpy('fetch')
            .and.rejectWith(new Error('Error: could not obtain GitHub token via gh auth token'))
        };
        const resolveAndFetch = buildResolveAndFetch({ githubIssue });

        const output = await resolveAndFetch.run(repoPath, issuesFolder, '#9');

        expect(output).toEqual('STATUS=error\nID=9\nERROR=Error: could not obtain GitHub token via gh auth token\n');
      });
    });
  });
});
