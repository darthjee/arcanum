import path from 'node:path';
import { setupParityTest } from '../../support/factories/githubParitySetup.js';
import { seedEngineMode } from '../../support/utils/engineMode.js';
import {
  REPO_ROOT, expectInvalidRepoPathParity, expectParity, runBoth, runCommand
} from '../../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'github.sh');

// Parity test for the "auto-fix-all-github has-label" migrated entrypoint
// (issue #692, generalizing #265's has-shipit-label) — see
// docs/agents/architecture/script-engine.md's "output/exit-code contract"
// and docs/agents/plans/692-create-issue-automation-skips-epics/plan.md.
// Runs auto-fix-all/scripts/github_shell.sh has-label and
// `core/bin/arcanum auto-fix-all-github-has-label` against equivalent
// inputs, asserting byte-identical stdout and exit code — see
// setupParityTest/runBoth for how `gh`/`fetch` are faked on each side.
// The `has-shipit-label` alias (no native command of its own) is covered
// both on github_shell.sh directly and through the real github.sh router.
describe('auto-fix-all-github parity (shell vs. native) — has-label', () => {
  /**
   * Runs `has-label` on both sides for one scenario and asserts parity
   * plus the expected exit code and empty stdout.
   * @param {object} scenario - the scenario.
   * @param {string[]} scenario.args - the arguments after `<repo_path>`.
   * @param {number} scenario.code - the expected exit code.
   * @param {object} [scenario.ghVars] - `FAKE_GH_*` overrides.
   * @param {object} [scenario.fetchVars] - `FAKE_FETCH_*` overrides.
   * @returns {Promise<void>} resolves once asserted.
   */
  async function expectHasLabelParity({ args, code, ghVars, fetchVars }) {
    const ctx = await setupParityTest({ ghVars, fetchVars });

    try {
      const { shell, native } = await runBoth(
        'has-label',
        'auto-fix-all-github-has-label',
        args,
        ctx.shellRepo,
        ctx.nativeRepo,
        ctx.shellEnv,
        ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(code);
      expect(shell.stdout).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  }

  it('matches shell exit code (0) when the label is present in another case', async () => {
    await expectHasLabelParity({
      args: ['5', 'epic'],
      code: 0,
      ghVars: { FAKE_GH_ISSUE_LABELS: 'Epic\nOther' },
      fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Epic\nOther' }
    });
  });

  it('matches shell exit code (1) when the label is absent', async () => {
    await expectHasLabelParity({
      args: ['5', 'Epic'],
      code: 1,
      ghVars: { FAKE_GH_ISSUE_LABELS: 'Epics\nOther' },
      fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Epics\nOther' }
    });
  });

  it('matches shell exit code (2) when the label fetch fails', async () => {
    await expectHasLabelParity({
      args: ['5', 'Epic'],
      code: 2,
      ghVars: { FAKE_GH_ISSUE_LABELS: 'Epic', FAKE_GH_ISSUE_VIEW_FAIL: '1' },
      fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Epic', FAKE_FETCH_ISSUE_VIEW_FAIL: '1' }
    });
  });

  it('matches shell exit code (1) when <name> is missing (usage)', async () => {
    await expectHasLabelParity({
      args: ['5'],
      code: 1,
      ghVars: { FAKE_GH_ISSUE_LABELS: 'Epic' },
      fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Epic' }
    });
  });

  it('matches shell for a non-directory / non-git repo_path (repo_path_enter parity)', async () => {
    await expectInvalidRepoPathParity('has-label', 'auto-fix-all-github-has-label', ['5', 'Epic']);
  });

  describe('has-shipit-label alias', () => {
    [
      { label: 'a ShipIt label', labels: 'ShipIt\nOther', code: 0 },
      { label: 'no shipit label', labels: 'Other', code: 1 }
    ].forEach(({ label, labels, code }) => {
      it(`github_shell.sh and github.sh (engine.mode=shell) both exit ${code} on ${label}`, async () => {
        const ctx = await setupParityTest({ ghVars: { FAKE_GH_ISSUE_LABELS: labels } });

        try {
          await seedEngineMode(ctx.nativeRepo, 'shell');

          const direct = await runCommand(
            [path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'github_shell.sh'),
              'has-shipit-label', ctx.shellRepo.repoPath, '5'],
            ctx.shellRepo.repoPath,
            ctx.shellEnv
          );
          const routed = await runCommand(
            [SHIM_SCRIPT, 'has-shipit-label', ctx.nativeRepo.repoPath, '5'],
            ctx.nativeRepo.repoPath,
            ctx.shellEnv
          );

          expectParity(direct, routed);
          expect(direct.code).toEqual(code);
          expect(direct.stdout).toEqual('');
        } finally {
          await ctx.cleanup();
        }
      });
    });
  });
});
