import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoMonitorPrMonitorPr from '../../../../lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js';
import IssueStateService from '../../../../lib/services/IssueStateService.js';
import RepoContext from '../../../../lib/context/RepoContext.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const USAGE = 'Usage: monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]';
const PR_NUMBER = '7';
const ISSUE_ID = '5';
const OWNER = 'darthjee';

describe('AutoMonitorPrMonitorPr#run', () => {
  let repoPath;
  let repoContext;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-monitor-pr-spec-');
    repoContext = new RepoContext({ repoPath });
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @returns {string} the legacy per-PR comments-state file's path.
   */
  function legacyFile() {
    return path.join(repoPath, '.claude', 'state', `auto-monitor-pr-${PR_NUMBER}-comments.json`);
  }

  /**
   * @returns {string} the `issue-<id>.json` state file's path.
   */
  function issueFile() {
    return path.join(repoPath, '.claude', 'state', `issue-${ISSUE_ID}.json`);
  }

  /**
   * @param {string} file - the state file to seed.
   * @param {object} content - the JSON content to write.
   * @returns {Promise<void>} resolves once written.
   */
  async function seedStateFile(file, content) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
  }

  /**
   * @param {string} file - the state file to read.
   * @returns {Promise<object|null>} the parsed content, or `null` when
   *   the file doesn't exist.
   */
  async function readStateFile(file) {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      return null;
    }
  }

  /**
   * @param {object} [overrides] - collaborator overrides.
   * @returns {AutoMonitorPrMonitorPr} the assembled command instance.
   */
  function createCommand(overrides = {}) {
    const {
      githubToken = { ghUser: jasmine.createSpy('ghUser').and.resolveTo(OWNER) },
      gitClient = { pushCurrentBranch: jasmine.createSpy('pushCurrentBranch').and.resolveTo(undefined) },
      prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo(null),
        newOwnerComments: jasmine.createSpy('newOwnerComments').and.resolveTo([]),
        isShipit: jasmine.createSpy('isShipit').and.returnValue(false),
        addEyes: jasmine.createSpy('addEyes').and.resolveTo(undefined),
        resolveAddressed: jasmine.createSpy('resolveAddressed').and.resolveTo(undefined)
      },
      ...rest
    } = overrides;

    return new AutoMonitorPrMonitorPr(repoContext, { githubToken, gitClient, prMonitor, ...rest });
  }

  describe('usage errors', () => {
    it('rejects when --pr-number is missing', async () => {
      const command = createCommand();

      await expectAsync(command.run('--issue-id', ISSUE_ID)).toBeRejectedWithError(USAGE);
    });

    it('rejects when --pr-number is given but empty', async () => {
      const command = createCommand();

      await expectAsync(command.run('--pr-number', '')).toBeRejectedWithError(USAGE);
    });

    it('rejects on an unrecognized flag', async () => {
      const command = createCommand();

      await expectAsync(command.run('--bogus', 'x')).toBeRejectedWithError(USAGE);
    });

    it('accepts and strips a leading "#" from --pr-number', async () => {
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo('closed'),
        newOwnerComments: jasmine.createSpy('newOwnerComments'),
        isShipit: jasmine.createSpy('isShipit'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', `#${PR_NUMBER}`)).toBeResolvedTo('closed\n');
      expect(prMonitor.resolveState).toHaveBeenCalledWith(PR_NUMBER, OWNER);
    });
  });

  describe('merged', () => {
    it('prints "merged\\n" and deletes the issue-state file (--issue-id shape)', async () => {
      await seedStateFile(issueFile(), { pr_comments: [], last_comment_time: '1970-01-01T00:00:00Z' });
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo('merged'),
        newOwnerComments: jasmine.createSpy('newOwnerComments'),
        isShipit: jasmine.createSpy('isShipit'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', PR_NUMBER, '--issue-id', ISSUE_ID)).toBeResolvedTo('merged\n');
      await expectAsync(readStateFile(issueFile())).toBeResolvedTo(null);
    });

    it('prints "merged\\n" and deletes the legacy per-PR file (no --issue-id)', async () => {
      await seedStateFile(legacyFile(), { pr_comments: [], last_comment_time: '1970-01-01T00:00:00Z' });
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo('merged'),
        newOwnerComments: jasmine.createSpy('newOwnerComments'),
        isShipit: jasmine.createSpy('isShipit'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', PR_NUMBER)).toBeResolvedTo('merged\n');
      await expectAsync(readStateFile(legacyFile())).toBeResolvedTo(null);
    });
  });

  describe('closed', () => {
    it('prints "closed\\n"', async () => {
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo('closed'),
        newOwnerComments: jasmine.createSpy('newOwnerComments'),
        isShipit: jasmine.createSpy('isShipit'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', PR_NUMBER)).toBeResolvedTo('closed\n');
    });
  });

  describe('approved', () => {
    it('prints "approved\\n" when PrMonitor#resolveState resolves it via the latest review', async () => {
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo('approved'),
        newOwnerComments: jasmine.createSpy('newOwnerComments'),
        isShipit: jasmine.createSpy('isShipit'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', PR_NUMBER)).toBeResolvedTo('approved\n');
      expect(prMonitor.newOwnerComments).not.toHaveBeenCalled();
    });

    it('prints "approved\\n" on a ":shipit:" comment, WITHOUT persisting last_comment_time', async () => {
      const newComments = [
        { id: 'IC_1', login: OWNER, url: 'https://x/1', body: ':shipit:', createdAt: '2024-06-01T00:00:00Z' }
      ];
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo(null),
        newOwnerComments: jasmine.createSpy('newOwnerComments').and.resolveTo(newComments),
        isShipit: jasmine.createSpy('isShipit').and.callFake((body) => body === ':shipit:'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', PR_NUMBER, '--issue-id', ISSUE_ID)).toBeResolvedTo('approved\n');
      expect(prMonitor.addEyes).not.toHaveBeenCalled();
      await expectAsync(readStateFile(issueFile())).toBeResolvedTo(null);
    });
  });

  describe('commented', () => {
    it('prints "---\\nid: ...\\nurl: ...\\n<body>" per new comment and persists fetched then processing, in order', async () => {
      await seedStateFile(issueFile(), {
        pr_comments: [{ id: 'IC_0', user: OWNER, url: 'https://x/0', state: 'addressed', emojis: [':+1:'] }],
        last_comment_time: '2024-01-01T00:00:00Z'
      });
      const newComments = [
        { id: 'IC_1', login: OWNER, url: 'https://x/1', body: 'first comment', createdAt: '2024-06-01T00:00:00Z' },
        { id: 'IC_2', login: OWNER, url: 'https://x/2', body: 'second comment', createdAt: '2024-06-02T00:00:00Z' }
      ];
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo(null),
        newOwnerComments: jasmine.createSpy('newOwnerComments').and.resolveTo(newComments),
        isShipit: jasmine.createSpy('isShipit').and.returnValue(false),
        addEyes: jasmine.createSpy('addEyes').and.resolveTo(undefined),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const issueStateService = new IssueStateService({ context: repoContext });
      const writeSpy = spyOn(issueStateService, 'write').and.callThrough();
      const command = createCommand({ prMonitor, issueStateService });

      const output = await command.run('--pr-number', PR_NUMBER, '--issue-id', ISSUE_ID);

      expect(output).toEqual(
        'commented\n---\nid: IC_1\nurl: https://x/1\nfirst comment\n---\nid: IC_2\nurl: https://x/2\nsecond comment\n'
      );

      const phase1 = writeSpy.calls.argsFor(0)[1].pr_comments;
      const phase2 = writeSpy.calls.argsFor(1)[1].pr_comments;

      expect(writeSpy.calls.count()).toEqual(2);
      expect(phase1.find((c) => c.id === 'IC_0').state).toEqual('addressed');
      expect(phase1.filter((c) => c.id !== 'IC_0').every((c) => c.state === 'fetched')).toBeTrue();
      expect(phase1.filter((c) => c.id !== 'IC_0').every((c) => Array.isArray(c.emojis) && c.emojis.length === 0)).toBeTrue();
      expect(phase2.find((c) => c.id === 'IC_0').state).toEqual('addressed');
      expect(phase2.filter((c) => c.id !== 'IC_0').every((c) => c.state === 'processing')).toBeTrue();
      expect(phase2.filter((c) => c.id !== 'IC_0').every((c) => c.emojis[0] === ':eyes:')).toBeTrue();
      expect(writeSpy.calls.argsFor(1)[1].last_comment_time).toEqual('2024-06-02T00:00:00Z');

      expect(prMonitor.addEyes).toHaveBeenCalledWith('IC_1');
      expect(prMonitor.addEyes).toHaveBeenCalledWith('IC_2');

      const finalState = await readStateFile(issueFile());

      expect(finalState.pr_comments.map((c) => ({ id: c.id, state: c.state, emojis: c.emojis }))).toEqual([
        { id: 'IC_0', state: 'addressed', emojis: [':+1:'] },
        { id: 'IC_1', state: 'processing', emojis: [':eyes:'] },
        { id: 'IC_2', state: 'processing', emojis: [':eyes:'] }
      ]);
    });

    it('behaves identically for the legacy per-PR file shape (no --issue-id)', async () => {
      const newComments = [
        { id: 'IC_1', login: OWNER, url: 'https://x/1', body: 'a comment', createdAt: '2024-06-01T00:00:00Z' }
      ];
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo(null),
        newOwnerComments: jasmine.createSpy('newOwnerComments').and.resolveTo(newComments),
        isShipit: jasmine.createSpy('isShipit').and.returnValue(false),
        addEyes: jasmine.createSpy('addEyes').and.resolveTo(undefined),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const command = createCommand({ prMonitor });

      const output = await command.run('--pr-number', PR_NUMBER);

      expect(output).toEqual('commented\n---\nid: IC_1\nurl: https://x/1\na comment\n');

      const finalState = await readStateFile(legacyFile());

      expect(finalState.pr_comments).toEqual([{ id: 'IC_1', user: OWNER, url: 'https://x/1', state: 'processing', emojis: [':eyes:'] }]);
      expect(finalState.last_comment_time).toEqual('2024-06-01T00:00:00Z');
    });
  });

  describe('pending', () => {
    it('prints "pending\\n" when there are no new comments', async () => {
      const command = createCommand();

      await expectAsync(command.run('--pr-number', PR_NUMBER)).toBeResolvedTo('pending\n');
    });

    it('prints "pending\\n" on a transient GitHub-call failure (newOwnerComments resolves null)', async () => {
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo(null),
        newOwnerComments: jasmine.createSpy('newOwnerComments').and.resolveTo(null),
        isShipit: jasmine.createSpy('isShipit'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed')
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', PR_NUMBER)).toBeResolvedTo('pending\n');
    });
  });

  describe('processing -> addressed resolution', () => {
    it('swaps reactions and persists addressed/[":+1:"] on a fresh invocation (--issue-id shape), leaving other entries untouched', async () => {
      await seedStateFile(issueFile(), {
        pr_comments: [
          { id: 'IC_1', user: OWNER, url: 'https://x/1', state: 'processing', emojis: [':eyes:'] },
          { id: 'IC_2', user: OWNER, url: 'https://x/2', state: 'fetched', emojis: [] }
        ],
        last_comment_time: '2024-01-01T00:00:00Z'
      });
      const calls = [];
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo(null),
        newOwnerComments: jasmine.createSpy('newOwnerComments').and.resolveTo([]),
        isShipit: jasmine.createSpy('isShipit'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed').and.callFake(async (id) => calls.push(id))
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', PR_NUMBER, '--issue-id', ISSUE_ID)).toBeResolvedTo('pending\n');

      expect(calls).toEqual(['IC_1']);

      const finalState = await readStateFile(issueFile());

      expect(finalState.pr_comments).toEqual([
        { id: 'IC_1', user: OWNER, url: 'https://x/1', state: 'addressed', emojis: [':+1:'] },
        { id: 'IC_2', user: OWNER, url: 'https://x/2', state: 'fetched', emojis: [] }
      ]);
    });

    it('swaps reactions and persists addressed/[":+1:"] on a fresh invocation (legacy shape)', async () => {
      await seedStateFile(legacyFile(), {
        pr_comments: [{ id: 'IC_1', user: OWNER, url: 'https://x/1', state: 'processing', emojis: [':eyes:'] }],
        last_comment_time: '2024-01-01T00:00:00Z'
      });
      const calls = [];
      const prMonitor = {
        resolveState: jasmine.createSpy('resolveState').and.resolveTo(null),
        newOwnerComments: jasmine.createSpy('newOwnerComments').and.resolveTo([]),
        isShipit: jasmine.createSpy('isShipit'),
        addEyes: jasmine.createSpy('addEyes'),
        resolveAddressed: jasmine.createSpy('resolveAddressed').and.callFake(async (id) => calls.push(id))
      };
      const command = createCommand({ prMonitor });

      await expectAsync(command.run('--pr-number', PR_NUMBER)).toBeResolvedTo('pending\n');

      expect(calls).toEqual(['IC_1']);

      const finalState = await readStateFile(legacyFile());

      expect(finalState.pr_comments).toEqual([{ id: 'IC_1', user: OWNER, url: 'https://x/1', state: 'addressed', emojis: [':+1:'] }]);
    });
  });

  describe('push_current_branch', () => {
    it('best-effort pushes the current branch before polling', async () => {
      const gitClient = { pushCurrentBranch: jasmine.createSpy('pushCurrentBranch').and.resolveTo(undefined) };
      const command = createCommand({ gitClient });

      await command.run('--pr-number', PR_NUMBER);

      expect(gitClient.pushCurrentBranch).toHaveBeenCalled();
    });
  });
});
