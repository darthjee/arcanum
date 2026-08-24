import AutoFixAllGithub from '../../../lib/commands/AutoFixAllGithub.js';
import DispatchFailure from '../../../lib/utils/errors/DispatchFailure.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';
const REPO_PATH = '/fake/repo';

/**
 * Build a fake `execFileAsync`, answering `git branch --show-current`
 * with `branch`, and every other `git` call successfully unless its
 * joined argv contains one of `failOn`'s substrings (in which case it
 * rejects) — used by `cleanupBranch`'s 4-command git sequence.
 * @param {object} [opts] - behavior overrides.
 * @param {string} [opts.branch] - the current branch's name.
 * @param {string[]} [opts.failOn] - argv substrings that should reject.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({ branch = 'issue-5', failOn = [] } = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    if (cmd === 'git' && args[0] === 'branch' && args[1] === '--show-current') {
      return { stdout: `${branch}\n`, stderr: '' };
    }

    const joined = args.join(' ');

    if (failOn.some((pattern) => joined.includes(pattern))) {
      throw new Error(`fake exec failure: git ${joined}`);
    }

    return { stdout: '', stderr: '' };
  });
}

/**
 * Build a fake `fetch`, routing every REST call `AutoFixAllGithub.js`
 * makes to a configurable canned response.
 * @param {object} [config] - behavior overrides.
 * @param {Array} [config.pulls] - the `/pulls?head=...` response body.
 * @param {string|Array} [config.commits] - the `/pulls/<n>/commits`
 *   response body (JSON string or already-parsed array).
 * @param {object} [config.user] - the `/user` response body.
 * @param {boolean} [config.userFails] - whether `/user` fails.
 * @param {boolean} [config.mergeOk] - whether the merge PUT succeeds.
 * @param {string[]} [config.labels] - the issue's current GitHub labels.
 * @param {boolean} [config.issueViewFails] - whether the issue GET fails.
 * @param {boolean} [config.mutateOk] - whether label POST/DELETE succeed.
 * @returns {Function} a jasmine spy usable as `fetchFn`.
 */
function fakeFetch({
  pulls = [],
  commits = '[]',
  user = { login: 'fake-merger' },
  userFails = false,
  mergeOk = true,
  labels = [],
  issueViewFails = false,
  mutateOk = true
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

    if (options.method === undefined && /\/issues\/[^/]+$/.test(url)) {
      return issueViewFails
        ? { ok: false }
        : { ok: true, json: async () => ({ labels: labels.map((name) => ({ name })) }) };
    }

    if ((options.method === 'POST' || options.method === 'DELETE') && url.includes('/labels')) {
      return { ok: mutateOk };
    }

    throw new Error(`unexpected fetch call: ${url} ${JSON.stringify(options)}`);
  });
}

describe('AutoFixAllGithub', () => {
  function newGithub(overrides = {}) {
    return new AutoFixAllGithub({
      origin: { resolve: async () => ({ domain: 'github.com', repo: REPO }) },
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
      const github = newGithub();

      await expectAsync(github.prNumber()).toBeRejectedWithError('Usage: github.sh pr-number <repo_path>');
    });

    it('returns the cached pr_id when the branch matches issue-<id> and a cache entry exists', async () => {
      const fetchFn = fakeFetch();
      const github = newGithub({
        execFileAsync: fakeExecFileAsync({ branch: 'issue-5' }),
        issueState: { get: async (repoPath, id, field) => (field === 'pr_id' ? '99' : '') },
        fetchFn
      });

      await expectAsync(github.prNumber(REPO_PATH)).toBeResolvedTo('99\n');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('falls back to a REST lookup when the branch does not match issue-<id>', async () => {
      const github = newGithub({
        execFileAsync: fakeExecFileAsync({ branch: 'some-other-branch' }),
        fetchFn: fakeFetch({ pulls: [{ number: 7, title: 't', html_url: 'u', state: 'open' }] })
      });

      await expectAsync(github.prNumber(REPO_PATH)).toBeResolvedTo('7\n');
    });

    it('falls back to a REST lookup when the branch matches issue-<id> but no cache entry exists', async () => {
      const github = newGithub({
        execFileAsync: fakeExecFileAsync({ branch: 'issue-5' }),
        issueState: { get: async () => '' },
        fetchFn: fakeFetch({ pulls: [{ number: 7, title: 't', html_url: 'u', state: 'open' }] })
      });

      await expectAsync(github.prNumber(REPO_PATH)).toBeResolvedTo('7\n');
    });

    it('rejects with the not-found error when no pull request is found', async () => {
      const github = newGithub({
        execFileAsync: fakeExecFileAsync({ branch: 'some-other-branch' }),
        fetchFn: fakeFetch({ pulls: [] })
      });

      await expectAsync(github.prNumber(REPO_PATH)).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });
  });

  describe('#prState', () => {
    it('rejects when repoPath is missing', async () => {
      const github = newGithub();

      await expectAsync(github.prState()).toBeRejectedWithError('Usage: github.sh pr-state <repo_path>');
    });

    it('prints STATE=OPEN for an open, unmerged pull request', async () => {
      const github = newGithub({
        fetchFn: fakeFetch({ pulls: [{ number: 7, state: 'open', merged: false, merged_at: null }] })
      });

      await expectAsync(github.prState(REPO_PATH)).toBeResolvedTo('STATE=OPEN\n');
    });

    it('prints STATE=MERGED for a merged pull request, even though its raw state is "closed"', async () => {
      const github = newGithub({
        fetchFn: fakeFetch({ pulls: [{ number: 7, state: 'closed', merged: true, merged_at: '2024-01-01T00:00:00Z' }] })
      });

      await expectAsync(github.prState(REPO_PATH)).toBeResolvedTo('STATE=MERGED\n');
    });

    it('prints STATE=CLOSED for a closed, unmerged pull request', async () => {
      const github = newGithub({
        fetchFn: fakeFetch({ pulls: [{ number: 7, state: 'closed', merged: false, merged_at: null }] })
      });

      await expectAsync(github.prState(REPO_PATH)).toBeResolvedTo('STATE=CLOSED\n');
    });

    it('rejects with the not-found error when no pull request is found', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ pulls: [] }) });

      await expectAsync(github.prState(REPO_PATH)).toBeRejectedWithError(
        'Error: no pull request found for the current branch on darthjee/arcanum'
      );
    });
  });

  describe('#prMerge', () => {
    const PULL = { number: 7, title: 'My PR', html_url: 'https://github.com/darthjee/arcanum/pull/7', state: 'open' };

    it('rejects when repoPath is missing', async () => {
      const github = newGithub();

      await expectAsync(github.prMerge()).toBeRejectedWithError('Usage: github.sh pr-merge <repo_path> [model_email]');
    });

    it('merges with an empty body by default (merge_body_mode absent) and prints the PR URL', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.prMerge(REPO_PATH)).toBeResolvedTo(`${PULL.html_url}\n`);

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body)).toEqual({
        merge_method: 'squash',
        commit_title: 'My PR (#7)',
        commit_message: ''
      });
    });

    it('uses the cached pr_id/pr_url when the branch matches issue-<id> and both are cached, but still re-fetches the title via REST', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const github = newGithub({
        execFileAsync: fakeExecFileAsync({ branch: 'issue-5' }),
        issueState: {
          get: async (repoPath, id, field) => (field === 'pr_id' ? '123' : field === 'pr_url' ? 'https://cached/url' : '')
        },
        fetchFn
      });

      await expectAsync(github.prMerge(REPO_PATH)).toBeResolvedTo('https://cached/url\n');

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(mergeCall[0]).toEqual(`https://api.github.com/repos/${REPO}/pulls/123/merge`);
      expect(JSON.parse(mergeCall[1].body).commit_title).toEqual('My PR (#123)');
    });

    it('omits commit_message entirely in "full" mode', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const github = newGithub({
        configChain: { read: async (repoPath, ns, key) => (key === 'merge_body_mode' ? 'full' : undefined) },
        fetchFn
      });

      await github.prMerge(REPO_PATH);

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body)).toEqual({ merge_method: 'squash', commit_title: 'My PR (#7)' });
    });

    it('sends an empty commit_message in "empty" mode', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const github = newGithub({
        configChain: { read: async (repoPath, ns, key) => (key === 'merge_body_mode' ? 'empty' : undefined) },
        fetchFn
      });

      await github.prMerge(REPO_PATH);

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('');
    });

    it('warns to stderr and falls back to "empty" mode for an unrecognized merge_body_mode value', async () => {
      spyOn(process.stderr, 'write');

      const fetchFn = fakeFetch({ pulls: [PULL] });
      const github = newGithub({
        configChain: { read: async (repoPath, ns, key) => (key === 'merge_body_mode' ? 'bogus' : undefined) },
        fetchFn
      });

      await github.prMerge(REPO_PATH);

      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: unrecognized git.merge_body_mode value \'bogus\' — falling back to \'empty\'.\n'
      );

      const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

      expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('');
    });

    describe('"coauthors" mode', () => {
      function coauthorsGithub(overrides = {}) {
        return newGithub({
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
        const github = coauthorsGithub({ fetchFn });

        await github.prMerge(REPO_PATH);

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
        const github = coauthorsGithub({ fetchFn });

        await github.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Bob <bob@x.com>\n');
      });

      it('excludes the entry matching the merger\'s own GitHub login', async () => {
        const commits = [
          { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'merger' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const github = coauthorsGithub({ fetchFn });

        await github.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('fails open (skips only the merger exclusion) when the merger-login lookup fails', async () => {
        const commits = [
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, userFails: true });
        const github = coauthorsGithub({ fetchFn });

        await github.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('excludes modelEmail\'s entry only when omit_model_coauthor is true AND modelEmail is given', async () => {
        const commits = [
          { commit: { author: { name: 'Model', email: 'model@x.com' } }, author: { login: 'model-bot' } },
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const github = coauthorsGithub({
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

        await github.prMerge(REPO_PATH, 'model@x.com');

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('does not exclude modelEmail\'s entry when omit_model_coauthor is not set', async () => {
        const commits = [
          { commit: { author: { name: 'Model', email: 'model@x.com' } }, author: { login: 'model-bot' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const github = coauthorsGithub({ fetchFn });

        await github.prMerge(REPO_PATH, 'model@x.com');

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Model <model@x.com>\n');
      });

      it('excludes any entry whose email is in the remove_coauthors config list', async () => {
        const commits = [
          { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } },
          { commit: { author: { name: 'Removed', email: 'removed@x.com' } }, author: { login: 'removed' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const github = coauthorsGithub({
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

        await github.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body).commit_message).toEqual('Co-authored-by: Alice <alice@x.com>\n');
      });

      it('falls back to "full" mode\'s behavior (omit commit_message) when the resulting list is empty', async () => {
        const commits = [
          { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'merger' } }
        ];
        const fetchFn = fakeFetch({ pulls: [PULL], commits, user: { login: 'merger' } });
        const github = coauthorsGithub({ fetchFn });

        await github.prMerge(REPO_PATH);

        const mergeCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'PUT');

        expect(JSON.parse(mergeCall[1].body)).toEqual({ merge_method: 'squash', commit_title: 'My PR (#7)' });
      });
    });

    it('rejects with the merge-failure error when the merge REST call fails', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ pulls: [PULL], mergeOk: false }) });

      await expectAsync(github.prMerge(REPO_PATH)).toBeRejectedWithError(
        'Error: could not merge PR #7 on darthjee/arcanum'
      );
    });

    it('deletes the branch ref after a successful merge', async () => {
      const fetchFn = fakeFetch({ pulls: [PULL] });
      const github = newGithub({ execFileAsync: fakeExecFileAsync({ branch: 'issue-9' }), fetchFn });

      await github.prMerge(REPO_PATH);

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
      const github = newGithub({ fetchFn });

      await expectAsync(github.prMerge(REPO_PATH)).toBeResolvedTo(`${PULL.html_url}\n`);
    });
  });

  describe('#cleanupBranch', () => {
    it('rejects when repoPath or id is missing', async () => {
      const github = newGithub();

      await expectAsync(github.cleanupBranch(REPO_PATH)).toBeRejectedWithError(
        'Usage: github.sh cleanup-branch <repo_path> <id>'
      );
    });

    it('runs the remote delete, checkout, reset, and local delete, in order', async () => {
      const execFileAsync = fakeExecFileAsync();
      const github = newGithub({ execFileAsync });

      await expectAsync(github.cleanupBranch(REPO_PATH, '5')).toBeResolvedTo('');

      const calls = execFileAsync.calls.allArgs().map(([cmd, args]) => `${cmd} ${args.join(' ')}`);

      expect(calls).toEqual([
        'git push origin --delete issue-5',
        'git checkout main',
        'git reset --hard origin/main',
        'git branch -D issue-5'
      ]);
    });

    it('forwards git checkout/reset --hard/branch -D\'s own stdout (unredirected in the shell script)', async () => {
      const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
        if (args[0] === 'branch' && args[1] === '--show-current') {
          return { stdout: 'issue-5\n', stderr: '' };
        }

        if (args[0] === 'checkout') {
          return { stdout: 'Your branch is up to date with \'origin/main\'.\n', stderr: '' };
        }

        if (args[0] === 'reset') {
          return { stdout: 'HEAD is now at abc123 seed\n', stderr: '' };
        }

        if (args[0] === 'branch' && args[1] === '-D') {
          return { stdout: 'Deleted branch issue-5 (was def456).\n', stderr: '' };
        }

        return { stdout: '', stderr: '' };
      });
      const github = newGithub({ execFileAsync });

      await expectAsync(github.cleanupBranch(REPO_PATH, '5')).toBeResolvedTo(
        'Your branch is up to date with \'origin/main\'.\nHEAD is now at abc123 seed\nDeleted branch issue-5 (was def456).\n'
      );
    });

    it('tolerates a failed remote branch delete, still running the rest of the sequence', async () => {
      const execFileAsync = fakeExecFileAsync({ failOn: ['push origin --delete'] });
      const github = newGithub({ execFileAsync });

      await expectAsync(github.cleanupBranch(REPO_PATH, '5')).toBeResolvedTo('');
      expect(execFileAsync).toHaveBeenCalledTimes(4);
    });

    it('rejects when the checkout step fails (not tolerated)', async () => {
      const execFileAsync = fakeExecFileAsync({ failOn: ['checkout main'] });
      const github = newGithub({ execFileAsync });

      await expectAsync(github.cleanupBranch(REPO_PATH, '5')).toBeRejected();
    });
  });

  describe('#hasShipitLabel', () => {
    it('resolves for a case-insensitive exact "shipit" label match', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ labels: ['Shipit', 'Other'] }) });

      await expectAsync(github.hasShipitLabel(REPO_PATH, '5')).toBeResolvedTo('');
    });

    it('rejects with an empty-stdout DispatchFailure (exit 1) when the label is absent', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ labels: ['Other'] }) });
      let thrown;

      try {
        await github.hasShipitLabel(REPO_PATH, '5');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });

    it('rejects with an empty-stdout DispatchFailure (exit 1) when the labels fetch fails', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ issueViewFails: true }) });
      let thrown;

      try {
        await github.hasShipitLabel(REPO_PATH, '5');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });

  describe('#addTag', () => {
    it('rejects when repoPath, id, or tag is missing', async () => {
      const github = newGithub();

      await expectAsync(github.addTag(REPO_PATH, '5')).toBeRejectedWithError(
        'Usage: github.sh add-tag <repo_path> <id> <tag>'
      );
    });

    it('rejects shipit with the human-only guard message', async () => {
      const github = newGithub();

      await expectAsync(github.addTag(REPO_PATH, '5', 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
    });

    it('prints a "nothing to do" line, without mutating, when the label is already present', async () => {
      const fetchFn = fakeFetch({ labels: ['Ready for Work'] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.addTag(REPO_PATH, '5', 'ready_for_work')).toBeResolvedTo(
        'Tag \'ready_for_work\' already present on issue #5 — nothing to do.\n'
      );
      expect(fetchFn.calls.allArgs().some(([, options = {}]) => options.method === 'POST')).toBeFalse();
    });

    it('adds the mapped GitHub label and prints the confirmation line', async () => {
      const fetchFn = fakeFetch({ labels: [] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.addTag(REPO_PATH, '5', 'ready_for_work')).toBeResolvedTo(
        'Added tag \'ready_for_work\' to issue #5 on darthjee/arcanum\n'
      );

      const postCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'POST');

      expect(postCall[0]).toEqual(`https://api.github.com/repos/${REPO}/issues/5/labels`);
      expect(JSON.parse(postCall[1].body)).toEqual({ labels: ['Ready for Work'] });
    });

    it('rejects with the fetch-failure error when the current labels cannot be fetched', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ issueViewFails: true }) });

      await expectAsync(github.addTag(REPO_PATH, '5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not fetch issue #5 from darthjee/arcanum'
      );
    });

    it('rejects with the update-failure error when the add-label call fails', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ labels: [], mutateOk: false }) });

      await expectAsync(github.addTag(REPO_PATH, '5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not update issue #5 on darthjee/arcanum'
      );
    });
  });

  describe('#removeTag', () => {
    it('rejects when repoPath, id, or tag is missing', async () => {
      const github = newGithub();

      await expectAsync(github.removeTag(REPO_PATH, '5')).toBeRejectedWithError(
        'Usage: github.sh remove-tag <repo_path> <id> <tag>'
      );
    });

    it('rejects shipit with the human-only guard message', async () => {
      const github = newGithub();

      await expectAsync(github.removeTag(REPO_PATH, '5', 'shipit')).toBeRejectedWithError(
        'Error: shipit is human-only; scripts must not add or remove it'
      );
    });

    it('prints a "nothing to do" line, without mutating, when the label is already absent', async () => {
      const fetchFn = fakeFetch({ labels: [] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.removeTag(REPO_PATH, '5', 'ready_for_work')).toBeResolvedTo(
        'Tag \'ready_for_work\' not present on issue #5 — nothing to do.\n'
      );
      expect(fetchFn.calls.allArgs().some(([, options = {}]) => options.method === 'DELETE')).toBeFalse();
    });

    it('removes the mapped GitHub label and prints the confirmation line', async () => {
      const fetchFn = fakeFetch({ labels: ['Ready for Work'] });
      const github = newGithub({ fetchFn });

      await expectAsync(github.removeTag(REPO_PATH, '5', 'ready_for_work')).toBeResolvedTo(
        'Removed tag \'ready_for_work\' from issue #5 on darthjee/arcanum\n'
      );

      const deleteCall = fetchFn.calls.allArgs().find(([, options]) => options.method === 'DELETE');

      expect(deleteCall[0]).toEqual(`https://api.github.com/repos/${REPO}/issues/5/labels/Ready%20for%20Work`);
    });

    it('rejects with the fetch-failure error when the current labels cannot be fetched', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ issueViewFails: true }) });

      await expectAsync(github.removeTag(REPO_PATH, '5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not fetch issue #5 from darthjee/arcanum'
      );
    });

    it('rejects with the update-failure error when the remove-label call fails', async () => {
      const github = newGithub({ fetchFn: fakeFetch({ labels: ['Ready for Work'], mutateOk: false }) });

      await expectAsync(github.removeTag(REPO_PATH, '5', 'ready_for_work')).toBeRejectedWithError(
        'Error: could not update issue #5 on darthjee/arcanum'
      );
    });
  });
});
