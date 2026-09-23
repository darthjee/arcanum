import path from 'node:path';
import { MARK_TRANSITIONS } from '../../../lib/commands/shared/GithubIssueMark.js';
import { TAG_TO_LABEL } from '../../../lib/utils/issue/Tags.js';
import { setupParityTest } from '../factories/githubParitySetup.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { FAKE_FETCH_PRELOAD, NATIVE_BIN, REPO_ROOT, expectParity, runCommand } from '../utils/runCommand.js';

const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'github_issue_shell.sh');
const REPO = 'darthjee/arcanum-github-fixture';
const ID = '42';

/**
 * Drops the fake `gh` binary's own diagnostic lines (`fake gh: ...`)
 * from the shell side's stderr: `tag_mutate.sh` doesn't redirect `gh
 * issue edit`'s stderr, so the fake binary's failure message leaks
 * through on the shell side only. It is `gh`'s own output, not part of
 * the `cmd_mark_*` contract, and has no native counterpart.
 * @param {string} stderr - the shell side's raw stderr.
 * @returns {string} stderr without `fake gh:` lines.
 */
function withoutFakeGhLines(stderr) {
  return stderr.split('\n').filter((line) => !line.startsWith('fake gh:')).join('\n');
}

/**
 * @param {string[]} tags - canonical tag names.
 * @returns {string} their GitHub label names, one per line (the fake
 *   `gh`/fetch `*_ISSUE_LABELS` format).
 */
function labelsFor(tags) {
  return tags.map((tag) => TAG_TO_LABEL[tag]).join('\n');
}

/**
 * Runs `github_issue_shell.sh mark-<name>` (directly — bypassing the
 * `github_issue.sh` engine_dispatch shim so the comparison isn't
 * circular) and `core/bin/arcanum github-issue-mark-<name>` with the
 * fake-fetch preload, each against its own fixture repo.
 * @param {string} name - the `MARK_TRANSITIONS` key.
 * @param {object} scenario - the fake `gh`/fetch scenario.
 * @param {string} [scenario.labels] - the issue's current GitHub labels,
 *   one per line.
 * @param {boolean} [scenario.viewFail] - whether every issue fetch fails.
 * @param {boolean} [scenario.editFail] - whether every label add/remove
 *   fails.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runMarkBoth(name, { labels = '', viewFail = false, editFail = false }) {
  const ghVars = { FAKE_GH_ISSUE_LABELS: labels };
  const fetchVars = { FAKE_FETCH_ISSUE_LABELS: labels };

  if (viewFail) {
    Object.assign(ghVars, { FAKE_GH_ISSUE_VIEW_FAIL: '1' });
    Object.assign(fetchVars, { FAKE_FETCH_ISSUE_VIEW_FAIL: '1' });
  }

  if (editFail) {
    Object.assign(ghVars, { FAKE_GH_ISSUE_EDIT_FAIL: '1' });
    Object.assign(fetchVars, { FAKE_FETCH_ISSUE_EDIT_FAIL: '1' });
  }

  const ctx = await setupParityTest({ ghVars, fetchVars });

  try {
    const shell = await runCommand(
      [SHELL_SCRIPT, `mark-${name}`, ctx.shellRepo.repoPath, ID], ctx.shellRepo.repoPath, ctx.shellEnv
    );
    const native = await runCommand(
      [process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN, `github-issue-mark-${name}`, ctx.nativeRepo.repoPath, ID],
      ctx.nativeRepo.repoPath,
      ctx.nativeEnv
    );

    return { shell, native };
  } finally {
    await ctx.cleanup();
  }
}

/**
 * Asserts byte-identical stdout, stderr (minus the fake `gh`'s own
 * diagnostics) and exit code, plus the expected shell output.
 * @param {{shell: object, native: object}} results - both sides' results.
 * @param {{stdout: string, stderr: string}} expected - the expected output.
 * @returns {void}
 */
function expectMarkParity({ shell, native }, { stdout, stderr }) {
  expectParity(shell, native);
  expect(native.stderr).toEqual(withoutFakeGhLines(shell.stderr));
  expect(shell.code).toEqual(0);
  expect(shell.stdout).toEqual(stdout);
  expect(native.stderr).toEqual(stderr);
}

/**
 * @param {'add'|'remove'} action - the mutation.
 * @param {string} tag - the canonical tag.
 * @returns {string} `cmd_mark_*`'s `Warning:` line for a failed mutation.
 */
function warning(action, tag) {
  const preposition = action === 'add' ? 'to' : 'from';

  return `Warning: could not ${action} '${tag}' tag ${preposition} issue #${ID} on ${REPO}\n`;
}

/**
 * Shared example: `github_issue_shell.sh mark-<name>` and `core/bin/arcanum
 * github-issue-mark-<name>` produce byte-identical stdout, stderr and exit
 * code for every tag-mutation outcome, driven by `MARK_TRANSITIONS[name]`.
 * @param {string} name - the `MARK_TRANSITIONS` key (e.g. `'created'`).
 * @returns {void}
 */
export function itMatchesShellForMark(name) {
  const { add, removes } = MARK_TRANSITIONS[name];
  const mutations = [['add', add], ...removes.map((tag) => ['remove', tag])];

  describe(`github-issue-mark-${name} parity (shell vs. native)`, () => {
    it('matches shell when the add tag is added and every remove tag is removed', async () => {
      const results = await runMarkBoth(name, { labels: labelsFor(removes) });

      expectMarkParity(results, {
        stdout: `Added tag '${add}' to issue #${ID} on ${REPO}\n` +
          removes.map((tag) => `Removed tag '${tag}' from issue #${ID} on ${REPO}\n`).join(''),
        stderr: ''
      });
    });

    it('matches shell when every tag is already in its desired state', async () => {
      const results = await runMarkBoth(name, { labels: labelsFor([add]) });

      expectMarkParity(results, {
        stdout: `Tag '${add}' already present on issue #${ID} — nothing to do.\n` +
          removes.map((tag) => `Tag '${tag}' not present on issue #${ID} — nothing to do.\n`).join(''),
        stderr: ''
      });
    });

    it('matches shell (Error + Warning per tag, exit 0) when every issue fetch fails', async () => {
      const results = await runMarkBoth(name, { viewFail: true });

      expectMarkParity(results, {
        stdout: '',
        stderr: mutations.map(([action, tag]) =>
          `Error: could not fetch issue #${ID} from ${REPO}\n${warning(action, tag)}`
        ).join('')
      });
    });

    it('matches shell (Error + Warning per mutated tag, exit 0) when every issue update fails', async () => {
      const results = await runMarkBoth(name, { labels: labelsFor(removes), editFail: true });

      expectMarkParity(results, {
        stdout: '',
        stderr: mutations.map(([action, tag]) =>
          `Error: could not update issue #${ID} on ${REPO}\n${warning(action, tag)}`
        ).join('')
      });
    });

    it('matches shell (exit 1, _load_origin error) for a git repo with no origin remote', async () => {
      const repo = await createGitFixtureRepo();

      try {
        await runCommand(['git', '-C', repo.repoPath, 'remote', 'remove', 'origin'], repo.repoPath);

        const shell = await runCommand([SHELL_SCRIPT, `mark-${name}`, repo.repoPath, ID], repo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, `github-issue-mark-${name}`, repo.repoPath, ID], repo.repoPath
        );
        const message = `Error: '${repo.repoPath}' is not a git repository or has no 'origin' remote`;

        expectParity(shell, native);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(message);
        expect(native.stderr.trim()).toContain(message);
      } finally {
        await repo.cleanup();
      }
    });
  });
}
