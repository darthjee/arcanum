import IssueLinker from '../../../../lib/utils/issue/IssueLinker.js';

const REPO_REF = 'darthjee/arcanum';

/**
 * Build a fake `execFileAsync` implementation that answers each `gh`
 * subcommand based on its argument shape.
 * @param {object} [opts] - behavior overrides.
 * @param {boolean} [opts.parentCommentFail] - reject the parent-issue comment call.
 * @param {boolean} [opts.newCommentFail] - reject the new-issue comment call.
 * @param {boolean} [opts.graphqlFail] - reject the `addSubIssue` mutation call.
 * @param {Record<string, string>} [opts.nodeIds] - id -> GraphQL node id map.
 * @param {boolean} [opts.nodeIdFail] - reject every node-id lookup call.
 * @returns {Function} a jasmine spy usable as `execFileAsync`.
 */
function fakeExecFileAsync({
  parentCommentFail = false,
  newCommentFail = false,
  graphqlFail = false,
  nodeIds = {},
  nodeIdFail = false
} = {}) {
  return jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args) => {
    if (cmd !== 'gh') {
      throw new Error(`unexpected command: ${cmd}`);
    }

    if (args[0] === 'issue' && args[1] === 'view' && args.includes('id')) {
      if (nodeIdFail) {
        throw new Error('gh: could not resolve node id');
      }

      const id = args[2];

      return { stdout: `${nodeIds[id] || ''}\n` };
    }

    if (args[0] === 'issue' && args[1] === 'comment') {
      const isParentComment = args[3].startsWith('Spawned issue #');

      if (isParentComment && parentCommentFail) {
        throw new Error('gh: could not comment on parent');
      }

      if (!isParentComment && newCommentFail) {
        throw new Error('gh: could not comment on new issue');
      }

      return { stdout: '' };
    }

    if (args[0] === 'api' && args[1] === 'graphql') {
      if (graphqlFail) {
        throw new Error('gh: graphql mutation failed');
      }

      return { stdout: '' };
    }

    throw new Error(`unexpected gh invocation: ${JSON.stringify(args)}`);
  });
}

describe('IssueLinker', () => {
  describe('#link', () => {
    describe('comment-only linking', () => {
      it('comments on both the parent and the new issue', async () => {
        const execFileAsync = fakeExecFileAsync();
        const issueLinker = new IssueLinker({ execFileAsync });

        spyOn(process.stderr, 'write');

        await issueLinker.link('1', '42', 'New issue', REPO_REF, false);

        expect(execFileAsync).toHaveBeenCalledWith('gh', [
          'issue', 'comment', '1', '-R', REPO_REF, '--body', 'Spawned issue #42: New issue'
        ]);
        expect(execFileAsync).toHaveBeenCalledWith('gh', [
          'issue', 'comment', '42', '-R', REPO_REF, '--body', 'Spawned from #1'
        ]);
        expect(execFileAsync).not.toHaveBeenCalledWith('gh', jasmine.arrayContaining(['api']));
      });
    });

    describe('linking comments best-effort', () => {
      it('warns for both failed comment calls without throwing', async () => {
        const execFileAsync = fakeExecFileAsync({ parentCommentFail: true, newCommentFail: true });
        const issueLinker = new IssueLinker({ execFileAsync });

        spyOn(process.stderr, 'write');

        await issueLinker.link('1', '42', 'New issue', REPO_REF, false);

        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not comment on parent issue #1 on darthjee/arcanum\n'
        );
        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not comment on issue #42 on darthjee/arcanum\n'
        );
      });
    });

    describe('--as-subissue success', () => {
      it('invokes the addSubIssue mutation with the two resolved node ids', async () => {
        const execFileAsync = fakeExecFileAsync({ nodeIds: { 1: 'PARENT_NODE_ID', 42: 'NEW_NODE_ID' } });
        const issueLinker = new IssueLinker({ execFileAsync });

        spyOn(process.stderr, 'write');

        await issueLinker.link('1', '42', 'New issue', REPO_REF, true);

        const graphqlCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'api');

        expect(graphqlCall.args[1]).toEqual([
          'api', 'graphql',
          '-f', jasmine.stringMatching(/^query=/),
          '-F', 'issueId=PARENT_NODE_ID',
          '-F', 'subIssueId=NEW_NODE_ID'
        ]);
      });
    });

    describe('--as-subissue node-id lookup failure fallback', () => {
      it('warns to stderr but does not attempt the mutation when a node id is missing', async () => {
        const execFileAsync = fakeExecFileAsync({ nodeIds: {} });
        const issueLinker = new IssueLinker({ execFileAsync });

        spyOn(process.stderr, 'write');

        await issueLinker.link('1', '42', 'New issue', REPO_REF, true);

        expect(execFileAsync).not.toHaveBeenCalledWith('gh', jasmine.arrayContaining(['api']));
        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not link issue #42 as a native sub-issue of #1 — created but not linked; link it manually on GitHub\n'
        );
      });

      it('warns to stderr but does not attempt the mutation when the node-id lookup itself throws', async () => {
        const execFileAsync = fakeExecFileAsync({ nodeIdFail: true });
        const issueLinker = new IssueLinker({ execFileAsync });

        spyOn(process.stderr, 'write');

        await issueLinker.link('1', '42', 'New issue', REPO_REF, true);

        expect(execFileAsync).not.toHaveBeenCalledWith('gh', jasmine.arrayContaining(['api']));
        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not link issue #42 as a native sub-issue of #1 — created but not linked; link it manually on GitHub\n'
        );
      });
    });

    describe('--as-subissue GraphQL failure fallback', () => {
      it('warns to stderr when the mutation call fails', async () => {
        const execFileAsync = fakeExecFileAsync({
          graphqlFail: true,
          nodeIds: { 1: 'PARENT_NODE_ID', 42: 'NEW_NODE_ID' }
        });
        const issueLinker = new IssueLinker({ execFileAsync });

        spyOn(process.stderr, 'write');

        await issueLinker.link('1', '42', 'New issue', REPO_REF, true);

        expect(process.stderr.write).toHaveBeenCalledWith(
          'Warning: could not link issue #42 as a native sub-issue of #1 — created but not linked; link it manually on GitHub\n'
        );
      });
    });
  });
});
