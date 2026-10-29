import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixAllCleanupArtifacts from '../../../../lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js';
import {
  createCommitCommandRepo,
  fakeConfigChain,
  fakeGitExecFileAsync
} from '../../../support/factories/commitCommandFixtures.js';
import { removeTempDir } from '../../../support/utils/tempDir.js';

const ISSUE_FILE = 'docs/agents/issues/999-test.md';
const PLAN_DIR = 'docs/agents/plans/999-test';
const ID = '999';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';
const SUBJECT_LINE = 'chore(docs): remove planning artifacts (issue #999)';

describe('AutoFixAllCleanupArtifacts', () => {
  let repoPath;

  beforeEach(async () => {
    ({ repoPath } = await createCommitCommandRepo({ dirPath: PLAN_DIR }));
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {Function} execFileAsync - the fake `execFileAsync`.
   * @param {object} [configChainOpts] - `fakeConfigChain`'s opts.
   * @returns {AutoFixAllCleanupArtifacts} an instance wired to fakes.
   */
  function build(execFileAsync, configChainOpts = {}) {
    const configChain = fakeConfigChain(configChainOpts);

    return new AutoFixAllCleanupArtifacts({ repoPath }, { execFileAsync, configChain });
  }

  /**
   * Run a full (both tracked) cleanup and return the piped commit
   * message.
   * @param {object} configChainOpts - `fakeConfigChain`'s opts.
   * @returns {Promise<string>} the `git commit -F -` input.
   */
  async function commitMessageFor(configChainOpts) {
    const execFileAsync = fakeGitExecFileAsync({ tracked: [ISSUE_FILE, PLAN_DIR] });

    await build(execFileAsync, configChainOpts).run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

    return execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit').args[2].input;
  }

  describe('#run', () => {
    describe('when neither the issue file nor the plan dir is tracked', () => {
      it('does nothing, resolving with empty stdout and issuing no commit/push', async () => {
        const execFileAsync = fakeGitExecFileAsync({ tracked: [] });
        const instance = build(execFileAsync);

        const result = await instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

        expect(result).toEqual('');
        expect(execFileAsync).not.toHaveBeenCalledWith('git', ['rm', ISSUE_FILE], jasmine.anything());
        expect(execFileAsync).not.toHaveBeenCalledWith('git', ['rm', '-r', PLAN_DIR], jasmine.anything());
        expect(execFileAsync.calls.all().some((call) => call.args[1][0] === 'commit')).toBeFalse();
        expect(execFileAsync.calls.all().some((call) => call.args[1][0] === 'push')).toBeFalse();
      });
    });

    describe('when only the issue file is tracked', () => {
      it('stages only the issue file removal', async () => {
        const execFileAsync = fakeGitExecFileAsync({ tracked: [ISSUE_FILE] });
        const instance = build(execFileAsync);

        await instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

        expect(execFileAsync).toHaveBeenCalledWith('git', ['rm', ISSUE_FILE], { cwd: repoPath });
        expect(execFileAsync).not.toHaveBeenCalledWith('git', ['rm', '-r', PLAN_DIR], jasmine.anything());
      });
    });

    describe('when only the plan dir is tracked', () => {
      it('stages only the plan dir removal', async () => {
        const execFileAsync = fakeGitExecFileAsync({ tracked: [PLAN_DIR] });
        const instance = build(execFileAsync);

        await instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

        expect(execFileAsync).not.toHaveBeenCalledWith('git', ['rm', ISSUE_FILE], jasmine.anything());
        expect(execFileAsync).toHaveBeenCalledWith('git', ['rm', '-r', PLAN_DIR], { cwd: repoPath });
      });
    });

    describe('when both the issue file and the plan dir are tracked', () => {
      it('stages both removals, commits with the cleanup message, and pushes the current branch', async () => {
        const execFileAsync = fakeGitExecFileAsync({ tracked: [ISSUE_FILE, PLAN_DIR] });
        const instance = build(execFileAsync);

        const result = await instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL);

        expect(result).toEqual('');
        expect(execFileAsync).toHaveBeenCalledWith('git', ['rm', ISSUE_FILE], { cwd: repoPath });
        expect(execFileAsync).toHaveBeenCalledWith('git', ['rm', '-r', PLAN_DIR], { cwd: repoPath });

        const commitCall = execFileAsync.calls.all().find((call) => call.args[1][0] === 'commit');

        expect(commitCall.args[1]).toEqual(['commit', '-F', '-']);
        expect(commitCall.args[2].input).toEqual(
          `${SUBJECT_LINE}\n\n` +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        );

        expect(execFileAsync).toHaveBeenCalledWith('git', ['branch', '--show-current'], { cwd: repoPath });
        expect(execFileAsync).toHaveBeenCalledWith(
          'git', ['push', '-u', 'origin', 'my-branch:my-branch'], { cwd: repoPath }
        );
      });
    });

    describe('commit message trailers', () => {
      it('keeps the model line and uses the architect email when omit_model_coauthor is false', async () => {
        expect(await commitMessageFor({ agentEmail: 'architect@example.com', omitModelCoauthor: false })).toEqual(
          `${SUBJECT_LINE}\n\n` +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: architect agent <architect@example.com>'
        );
      });

      it('keeps only the architect line when omit_model_coauthor is true and an architect email is set', async () => {
        expect(await commitMessageFor({ agentEmail: 'architect@example.com', omitModelCoauthor: true })).toEqual(
          `${SUBJECT_LINE}\n\nCo-Authored-By: architect agent <architect@example.com>`
        );
      });

      it('emits no trailers when omit_model_coauthor is true and no agent email is set', async () => {
        expect(await commitMessageFor({ omitModelCoauthor: true })).toEqual(SUBJECT_LINE);
      });

      it('uses the model email for the architect line under the old template engine', async () => {
        await mkdir(path.join(repoPath, '.github'), { recursive: true });
        await writeFile(path.join(repoPath, '.github', 'commit_message_template.md'), 'template\n');

        expect(await commitMessageFor({ agentEmail: 'architect@example.com', omitModelCoauthor: false })).toEqual(
          `${SUBJECT_LINE}\n\n` +
            'Co-Authored-By: Node Agent <node@example.com>\n' +
            'Co-Authored-By: architect agent <node@example.com>'
        );
      });
    });

    describe('argument validation', () => {
      it('throws the usage message when a required argument is missing', async () => {
        const execFileAsync = fakeGitExecFileAsync({ tracked: [] });
        const instance = build(execFileAsync);

        await expectAsync(
          instance.run(ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, '')
        ).toBeRejectedWithError(
          'Usage: cleanup_artifacts.sh <repo_path> <issue_file> <plan_dir> <id> <model_name> <model_email>'
        );

        expect(execFileAsync).not.toHaveBeenCalled();
      });
    });
  });
});
