import IssueLinker from '../../../../lib/utils/issue/IssueLinker.js';
import { fakeExecFileAsync as fakeCommandExecFileAsync, subcommand } from '../../../support/utils/fakeExecFileAsync.js';

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
  return fakeCommandExecFileAsync('gh', [
    {
      match: (args) => subcommand('issue', 'view')(args) && args.includes('id'),
      respond: (args) => {
        if (nodeIdFail) {
          throw new Error('gh: could not resolve node id');
        }

        return { stdout: `${nodeIds[args[2]] || ''}\n` };
      }
    },
    {
      match: subcommand('issue', 'comment'),
      respond: (args) => {
        const isParentComment = args[3].startsWith('Spawned issue #');

        if (isParentComment && parentCommentFail) {
          throw new Error('gh: could not comment on parent');
        }

        if (!isParentComment && newCommentFail) {
          throw new Error('gh: could not comment on new issue');
        }

        return { stdout: '' };
      }
    },
    {
      match: subcommand('api', 'graphql'),
      respond: () => {
        if (graphqlFail) {
          throw new Error('gh: graphql mutation failed');
        }

        return { stdout: '' };
      }
    }
  ]);
}

/**
 * Arrange and run `IssueLinker#link('1', '42', 'New issue', REPO_REF,
 * asSubissue)` against a fresh fake `execFileAsync`, with
 * `process.stderr.write` spied on.
 * @param {object} fakeOptions - forwarded to `fakeExecFileAsync`.
 * @param {boolean} asSubissue - whether to link as a native sub-issue.
 * @returns {Promise<Function>} the spy used as `execFileAsync`.
 */
async function runLink(fakeOptions, asSubissue) {
  const execFileAsync = fakeExecFileAsync(fakeOptions);
  const issueLinker = new IssueLinker({ execFileAsync });

  spyOn(process.stderr, 'write');

  await issueLinker.link('1', '42', 'New issue', REPO_REF, asSubissue);

  return execFileAsync;
}

describe('IssueLinker', () => {
  describe('#link', () => {
    describe('comment-only linking', () => {
      it('comments on both the parent and the new issue', async () => {
        const execFileAsync = await runLink({}, false);

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
        await runLink({ parentCommentFail: true, newCommentFail: true }, false);

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
        const execFileAsync = await runLink({ nodeIds: { 1: 'PARENT_NODE_ID', 42: 'NEW_NODE_ID' } }, true);

        const graphqlCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'api');

        expect(graphqlCall.args[1]).toEqual([
          'api', 'graphql',
          '-f', jasmine.stringMatching(/^query=/),
          '-F', 'issueId=PARENT_NODE_ID',
          '-F', 'subIssueId=NEW_NODE_ID'
        ]);
      });
    });

    describe('--as-subissue link failure fallback', () => {
      [
        {
          description: 'the node id is missing',
          fakeOptions: { nodeIds: {} },
          expectsMutation: false
        },
        {
          description: 'the node-id lookup itself throws',
          fakeOptions: { nodeIdFail: true },
          expectsMutation: false
        },
        {
          description: 'the GraphQL mutation call fails',
          fakeOptions: { graphqlFail: true, nodeIds: { 1: 'PARENT_NODE_ID', 42: 'NEW_NODE_ID' } },
          expectsMutation: true
        }
      ].forEach(({ description, fakeOptions, expectsMutation }) => {
        it(`warns to stderr when ${description}`, async () => {
          const execFileAsync = await runLink(fakeOptions, true);

          if (!expectsMutation) {
            expect(execFileAsync).not.toHaveBeenCalledWith('gh', jasmine.arrayContaining(['api']));
          }
          expect(process.stderr.write).toHaveBeenCalledWith(
            'Warning: could not link issue #42 as a native sub-issue of #1 — created but not linked; link it manually on GitHub\n'
          );
        });
      });
    });
  });
});
