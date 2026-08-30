import { readFile } from 'node:fs/promises';
import path from 'node:path';
import IssueState from '../../../lib/commands/IssueState.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const USAGE_SNIPPET = 'Usage: issue_state.sh <repo_path> get <id> <field>';

describe('IssueState', () => {
  let repoPath;

  /**
   * Build a real `RepoContext` bound to the per-test temp dir — mirrors
   * `SpawnIssue_spec.js`'s `buildContext` helper.
   * @param {object} [opts] - context wiring overrides.
   * @param {string} [opts.repoPath] - the context's repo path (defaults
   *   to the per-test temp dir).
   * @returns {RepoContext} the assembled context.
   */
  function buildContext({ repoPath: contextRepoPath = repoPath } = {}) {
    return new RepoContext({ repoPath: contextRepoPath });
  }

  /**
   * @param {object} [overrides] - collaborator overrides for `IssueState`.
   * @returns {object} the deps object passed to `new IssueState(context, deps)`.
   */
  function stubDeps(overrides = {}) {
    return {
      ...overrides
    };
  }

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-issue-state-spec-');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  describe('#run', () => {
    describe('argument validation', () => {
      it('throws the usage message when the subcommand is missing', async () => {
        const issueState = new IssueState(buildContext(), stubDeps());

        await expectAsync(issueState.run()).toBeRejectedWithError(new RegExp(USAGE_SNIPPET));
      });

      it('throws the usage message when the id is missing', async () => {
        const issueState = new IssueState(buildContext(), stubDeps());

        await expectAsync(issueState.run('get', undefined, 'title')).toBeRejectedWithError(new RegExp(USAGE_SNIPPET));
      });

      it('throws the usage message when the field is missing', async () => {
        const issueState = new IssueState(buildContext(), stubDeps());

        await expectAsync(issueState.run('get', '42')).toBeRejectedWithError(new RegExp(USAGE_SNIPPET));
      });

      it('throws when the injected context has no repoPath', async () => {
        const issueState = new IssueState(buildContext({ repoPath: '' }), stubDeps());

        await expectAsync(issueState.run('get', '42', 'title')).toBeRejectedWithError(new RegExp(USAGE_SNIPPET));
      });

      it('throws Unknown command for an unrecognized subcommand', async () => {
        const issueState = new IssueState(buildContext(), stubDeps());

        await expectAsync(issueState.run('bogus', '42', 'title')).toBeRejectedWithError(/Unknown command: bogus/);
      });
    });

    describe('subcommand dispatch (stubbed IssueStateService)', () => {
      let service;
      let issueState;
      let pathsSpy;

      beforeEach(() => {
        service = {
          get: jasmine.createSpy('get').and.resolveTo('resolved-value'),
          set: jasmine.createSpy('set').and.resolveTo(undefined),
          setJson: jasmine.createSpy('setJson').and.resolveTo(undefined),
          appendJson: jasmine.createSpy('appendJson').and.resolveTo(undefined)
        };
        pathsSpy = jasmine
          .createSpy('paths')
          .and.callFake((rp, id) => ({
            stateDir: path.join(rp, '.claude', 'state'),
            stateFile: path.join(rp, '.claude', 'state', `issue-${id}.json`),
            lockFile: path.join(rp, '.claude', 'state', `issue-${id}.lock`)
          }));
        issueState = new IssueState(buildContext(), stubDeps({ issueStatePaths: { paths: pathsSpy } }));
        spyOn(issueState, '_issueStateService').and.returnValue(service);
      });

      it('resolves the state dir/file paths from the injected context repoPath', async () => {
        await issueState.run('get', '42', 'title');

        expect(pathsSpy).toHaveBeenCalledWith(repoPath, '42');
      });

      it('get delegates to IssueStateService#get and appends a trailing newline', async () => {
        const output = await issueState.run('get', '42', 'title');

        expect(service.get).toHaveBeenCalledWith('42', 'title');
        expect(output).toEqual('resolved-value\n');
      });

      it('get returns the empty string unchanged (no trailing newline)', async () => {
        service.get.and.resolveTo('');

        const output = await issueState.run('get', '42', 'title');

        expect(output).toEqual('');
      });

      it('set delegates to IssueStateService#set and returns the empty string', async () => {
        const output = await issueState.run('set', '42', 'title', 'A Title');

        expect(service.set).toHaveBeenCalledWith('42', 'title', 'A Title');
        expect(output).toEqual('');
      });

      it('set defaults a missing value to the empty string', async () => {
        await issueState.run('set', '42', 'title');

        expect(service.set).toHaveBeenCalledWith('42', 'title', '');
      });

      it('set-json delegates to IssueStateService#setJson', async () => {
        const output = await issueState.run('set-json', '42', 'meta', '{"priority":"high"}');

        expect(service.setJson).toHaveBeenCalledWith('42', 'meta', '{"priority":"high"}');
        expect(output).toEqual('');
      });

      it('append-json delegates to IssueStateService#appendJson', async () => {
        const output = await issueState.run('append-json', '42', 'tags', '"a"');

        expect(service.appendJson).toHaveBeenCalledWith('42', 'tags', '"a"');
        expect(output).toEqual('');
      });
    });

    describe('end to end against a real state file', () => {
      it('round-trips a set then get through the default IssueStateService', async () => {
        const issueState = new IssueState(buildContext(), stubDeps());

        await issueState.run('set', '7', 'title', 'Round Trip');
        const output = await issueState.run('get', '7', 'title');

        expect(output).toEqual('Round Trip\n');

        const stateFile = path.join(repoPath, '.claude', 'state', 'issue-7.json');
        const written = JSON.parse(await readFile(stateFile, 'utf8'));
        expect(written).toEqual({ title: 'Round Trip' });
      });

      it('append-json builds up an array field', async () => {
        const issueState = new IssueState(buildContext(), stubDeps());

        await issueState.run('append-json', '7', 'tags', '"a"');
        await issueState.run('append-json', '7', 'tags', '"b"');

        const stateFile = path.join(repoPath, '.claude', 'state', 'issue-7.json');
        const written = JSON.parse(await readFile(stateFile, 'utf8'));
        expect(written).toEqual({ tags: ['a', 'b'] });
      });
    });
  });

  describe('#_issueStateService', () => {
    it('binds the built service to the injected RepoContext', async () => {
      const context = buildContext();
      const issueState = new IssueState(context, stubDeps());

      const service = issueState._issueStateService();

      await service.set('9', 'state', 'open');

      const stateFile = path.join(repoPath, '.claude', 'state', 'issue-9.json');
      const written = JSON.parse(await readFile(stateFile, 'utf8'));
      expect(written).toEqual({ state: 'open' });
    });
  });
});
