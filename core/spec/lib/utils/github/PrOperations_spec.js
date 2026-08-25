import PrOperations from '../../../../lib/utils/github/PrOperations.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';
const REPO_PATH = '/fake/repo';

/**
 * Build a fake `execFileAsync`, answering `git branch --show-current`
 * with `branch`, and every other `git` call successfully — used by
 * `_currentBranch`.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the current branch's name.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ branch = 'issue-5' } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    if (cmd === 'git' && args[0] === 'branch' && args[1] === '--show-current') {
      return { stdout: `${branch}\n`, stderr: '' };
    }

    return { stdout: '', stderr: '' };
  });
}

/**
 * Build a fake `fetch`, routing every REST call `PrOperations.js`
 * makes to a configurable canned response.
 * @param {object} [config] - behavior overrides.
 * @param {Array} [config.pulls] - the `/pulls?head=...` response body.
 * @param {string|Array} [config.commits] - the `/pulls/<n>/commits`
 *   response body (JSON string or already-parsed array).
 * @param {object} [config.user] - the `/user` response body.
 * @param {boolean} [config.userFails] - whether `/user` fails.
 * @param {boolean} [config.mergeOk] - whether the merge PUT succeeds.
 * @returns {Function} a jasmine spy usable as `fetchFn`.
 */
function fakeFetch({
  pulls = [],
  commits = '[]',
  user = { login: 'fake-merger' },
  userFails = false,
  mergeOk = true
} = {}) {
  return jasmine.createSpy('fetch').and.callFake(async (url, options = {}) => {
    if (url.includes('/pulls?head=')) {
      return { ok: true, json: async () => pulls };
    }

    if (/\/pulls\/\d+\/commits/.test(url)) {
      return { ok: true, json: async () => (typeof commits === 'string' ? JSON.parse(commits) : commits) };
    }

    if (options.method === 'PUT' && /\/pulls\/\d+\/merge$/.test(url)) {
      return { ok: mergeOk, json: async () => ({}) };
    }

    if (url === 'https://api.github.com/user') {
      return userFails ? { ok: false } : { ok: true, json: async () => user };
    }

    if (options.method === 'DELETE' && url.includes('/git/refs/heads/')) {
      return { ok: true };
    }

    throw new Error(`unexpected fetch call: ${url} ${JSON.stringify(options)}`);
  });
}

describe('PrOperations', () => {
  function newPrOperations(overrides = {}) {
    return new PrOperations({
      origin: { resolveWithRef: async () => ({ domain: 'github.com', repo: REPO, repoRef: REPO }) },
      githubToken: { get: async () => TOKEN },
      issueState: { get: async () => '' },
      configChain: { read: async () => undefined },
      execFileAsync: fakeExecFileAsync(),
      fetchFn: fakeFetch(),
      timeoutMs: 5,
      ...overrides
    });
  }

  describe('#prNumber', () => {
    it('rejects when repoPath is missing', async () => {
      const prOperations = newPrOperations();

      await expectAsync(prOperations.prNumber()).toBeRejectedWithError('Usage: github.sh pr-number <repo_path>');
    });

    it('returns the cached pr_id when the branch matches issue-<id> and a cache entry exists', async () => {
      const fetchFn = fakeFetch();
      const prOperations = newPrOperations({
        execFileAsync: fakeExecFileAsync({ branch: 'issue-5' }),
        issueState: { get: async (repoPath, id, field) => (field === 'pr_id' ? '99' : '') },
        fetchFn
      });

      await expectAsync(prOperations.prNumber(REPO_PATH)).toBeResolvedTo('99\n');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('falls back to a REST lookup when the branch does not match issue-<id>', async () => {
      const prOperations = newPrOperations({
        execFileAsync: fakeExecFileAsync({ branch: 'some-other-branch' }),
        fetchFn: fakeFetch({ pulls: [{ number: 7, title: 't', html_url: 'u', state: 'open' }] })
      });

      await expectAsync(prOperations.prNumber(REPO_PATH)).toBeResolvedTo('7\n');
    });

    it('falls back to a REST lookup when the branch matches issue-<id> but no cache entry exists', async () => {
      const prOperations = newPrOperations({
        execFileAsync: fakeExecFileAsync({ branch: 'issue-5' }),
        issueState: { get: async () => '' },
        fetchFn: fakeFetch({ pulls: [{ number: 7, title: 't', html_url: 'u', state: 'open' }] })
      });

      await expectAsync(prOperations.prNumber(REPO_PATH)).toBeResolvedTo('7\n');
    });

    it('rejects with the not-found error when no pull request is found', async () => {
      const prOperations = newPrOperations({
        execFileAsync: fakeExecFileAsync({ branch: 'some-other-branch' }),
        fetchFn: fakeFetch({ pulls: [] })
      });

      await expectAsync(prOperations.prNumber(REPO_PATH)).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });
  });

  describe('#prState', () => {
    it('rejects when repoPath is missing', async () => {
      const prOperations = newPrOperations();

      await expectAsync(prOperations.prState()).toBeRejectedWithError('Usage: github.sh pr-state <repo_path>');
    });

    it('prints STATE=OPEN for an open, unmerged pull request', async () => {
      const prOperations = newPrOperations({
        fetchFn: fakeFetch({ pulls: [{ number: 7, state: 'open', merged: false, merged_at: null }] })
      });

      await expectAsync(prOperations.prState(REPO_PATH)).toBeResolvedTo('STATE=OPEN\n');
    });

    it('prints STATE=MERGED for a merged pull request, even though its raw state is "closed"', async () => {
      const prOperations = newPrOperations({
        fetchFn: fakeFetch({ pulls: [{ number: 7, state: 'closed', merged: true, merged_at: '2024-01-01T00:00:00Z' }] })
      });

      await expectAsync(prOperations.prState(REPO_PATH)).toBeResolvedTo('STATE=MERGED\n');
    });

    it('prints STATE=CLOSED for a closed, unmerged pull request', async () => {
      const prOperations = newPrOperations({
        fetchFn: fakeFetch({ pulls: [{ number: 7, state: 'closed', merged: false, merged_at: null }] })
      });

      await expectAsync(prOperations.prState(REPO_PATH)).toBeResolvedTo('STATE=CLOSED\n');
    });

    it('rejects with the not-found error when no pull request is found', async () => {
      const prOperations = newPrOperations({ fetchFn: fakeFetch({ pulls: [] }) });

      await expectAsync(prOperations.prState(REPO_PATH)).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });
  });

  describe('#prMerge', () => {
    const PULL = { number: 7, title: 'My PR', html_url: 'https://github.com/darthjee/arcanum/pull/7', state: 'open' };

    it('rejects when repoPath is missing', async () => {
      const prOperations = newPrOperations();

      await expectAsync(prOperations.prMerge()).toBeRejectedWithError(
        'Usage: github.sh pr-merge <repo_path> [model_email]'
      );
    });

    it('merges with an empty body by default (merge_body_mode absent) and prints the PR URL', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const prOperations = newPrOperations({ fetchFn });

      await expectAsync(prOperations.prMerge(REPO_PATH)).toBeResolvedTo(`${PULL.html_url}\n`);

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body)).toEqual({
        merge_method: 'squash',
        commit_title: 'My PR (#7)',
        commit_message: ''
      });
    });

    it('uses the cached pr_id/pr_url when the branch matches issue-<id> and both are cached, but still re-fetches the title via REST', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const prOperations = newPrOperations({
        execFileAsync: fakeExecFileAsync({ branch: 'issue-5' }),
        issueState: {
          get: async (repoPath, id, field) => (field === 'pr_id' ? '123' : field === 'pr_url' ? 'https://cached/url' : '')
        },
        fetchFn
      });

      await expectAsync(prOperations.prMerge(REPO_PATH)).toBeResolvedTo('https://cached/url\n');

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(mergeCall[0]).toEqual(`https://api.github.com/repos/${REPO}/pulls/123/merge`);
      expect(JSON.parse(mergeCall[1].body).commit_title).toEqual('My PR (#123)');
    });

    it('omits commit_message entirely in "full" mode', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const prOperations = newPrOperations({
        configChain: { read: async (repoPath, ns, key) => (key === 'merge_body_mode' ? 'full' : undefined) },
        fetchFn
      });

      await prOperations.prMerge(REPO_PATH);

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body)).toEqual({ merge_method: 'squash', commit_title: 'My PR (#7)' });
    });

    it('sends an empty commit_message in "empty" mode', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const prOperations = newPrOperations({
        configChain: { read: async (repoPath, ns, key) => (key === 'merge_body_mode' ? 'empty' : undefined) },
        fetchFn
      });

      await prOperations.prMerge(REPO_PATH);

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('');
    });

    it('warns to stderr and falls back to "empty" mode for an unrecognized merge_body_mode value', async () => {
      spyOn(process.stderr, 'write');

      const fetchFn = fakeFetch({ pulls: [PULL] });
      const prOperations = newPrOperations({
        configChain: { read: async (repoPath, ns, key) => (key === 'merge_body_mode' ? 'bogus' : undefined) },
        fetchFn
      });

      await prOperations.prMerge(REPO_PATH);

      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: unrecognized git.merge_body_mode value \'bogus\' — falling back to \'empty\'.\n'
      );

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('');
    });

    describe('"coauthors" mode', () => {
      function coauthorsPrOperations(overrides = {}) {
        return newPrOperations({
          configChain: {
            read: async (repoPath, ns, key) => {
              if (key === 'merge_body_mode') {
                return 'coauthors';
              }

              return undefined;
            }
          },
          ...overrides
        });
      }

      it('builds a deduped, email-sorted Co-authored-by block from the PR commits', async () => {
        const commits = [
          { commit: { author: { name: 'Bob', email: 'bob@x.com' } }, author: { login: 'bob' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const prOperations = coauthorsPrOperations({ fetchFn });

        await prOperations.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual(
          'Co-authored-by: Alice <alice@x.com>\nCo-authored-by: Bob <bob@x.com>\n'
        );
      });

      it('dedupes by email, keeping one entry per address', async () => {
        const commits = [
          { commit: { author: { name: 'Bob', email: 'bob@x.com' } }, author: { login: 'bob' } },
          { commit: { author: { name: 'Bob Again', email: 'bob@x.com' } }, author: { login: 'bob' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const prOperations = coauthorsPrOperations({ fetchFn });

        await prOperations.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Bob <bob@x.com>\n');
      });

      it('excludes the entry matching the merger\'s own GitHub login', async () => {
        const commits = [
          { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'merger' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const prOperations = coauthorsPrOperations({ fetchFn });

        await prOperations.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('fails open (skips only the merger exclusion) when the merger-login lookup fails', async () => {
        const commits = [
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, userFails: true });
        const prOperations = coauthorsPrOperations({ fetchFn });

        await prOperations.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('excludes modelEmail\'s entry only when omit_model_coauthor is true AND modelEmail is given', async () => {
        const commits = [
          { commit: { author: { name: 'Model', email: 'model@x.com' } }, author: { login: 'model-bot' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const prOperations = coauthorsPrOperations({
          configChain: {
            read: async (repoPath, ns, key) => {
              if (key === 'merge_body_mode') {
                return 'coauthors';
              }

              if (key === 'omit_model_coauthor') {
                return true;
              }

              return undefined;
            }
          },
          fetchFn
        });

        await prOperations.prMerge(REPO_PATH, 'model@x.com');

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('does not exclude modelEmail\'s entry when omit_model_coauthor is not set', async () => {
        const commits = [
          { commit: { author: { name: 'Model', email: 'model@x.com' } }, author: { login: 'model-bot' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const prOperations = coauthorsPrOperations({ fetchFn });

        await prOperations.prMerge(REPO_PATH, 'model@x.com');

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Model <model@x.com>\n');
      });

      it('excludes any entry whose email is in the remove_coauthors config list', async () => {
        const commits = [
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } },
          { commit: { author: { name: 'Removed', email: 'removed@x.com' } }, author: { login: 'removed' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const prOperations = coauthorsPrOperations({
          configChain: {
            read: async (repoPath, ns, key) => {
              if (key === 'merge_body_mode') {
                return 'coauthors';
              }

              if (key === 'remove_coauthors') {
                return ['removed@x.com'];
              }

              return undefined;
            }
          },
          fetchFn
        });

        await prOperations.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('falls back to "full" mode\'s behavior (omit commit_message) when the resulting list is empty', async () => {
        const commits = [
          { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'merger' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const prOperations = coauthorsPrOperations({ fetchFn });

        await prOperations.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body)).toEqual({ merge_method: 'squash', commit_title: 'My PR (#7)' });
      });
    });

    it('rejects with the merge-failure error when the merge REST call fails', async () => {
      const prOperations = newPrOperations({ fetchFn: fakeFetch({ pulls: [PULL], mergeOk: false }) });

      await expectAsync(prOperations.prMerge(REPO_PATH)).toBeRejectedWithError(
        'Error: could not merge PR #7 on darthjee/arcanum'
      );
    });

    it('deletes the branch ref after a successful merge', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const prOperations = newPrOperations({ execFileAsync: fakeExecFileAsync({ branch: 'issue-9' }), fetchFn });

      await prOperations.prMerge(REPO_PATH);

      const deleteCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'DELETE');

      expect(deleteCall[0]).toEqual(`https://api.github.com/repos/${REPO}/git/refs/heads/issue-9`);
    });

    it('tolerates a failed/already-deleted branch ref delete, still returning the PR URL', async () => {
      const fetchFn = jasmine.createSpy('fetch').and.callFake(async (url, options = {}) => {
        if (options.method === 'DELETE' && url.includes('/git/refs/heads/')) {
          throw new Error('404 not found');
        }

        return fakeFetch({ pulls: [PULL] })(url, options);
      });
      const prOperations = newPrOperations({ fetchFn });

      await expectAsync(prOperations.prMerge(REPO_PATH)).toBeResolvedTo(`${PULL.html_url}\n`);
    });
  });
});
