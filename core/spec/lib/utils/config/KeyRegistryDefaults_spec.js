import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import NextStepPrompt from '../../../../lib/commands/shared/NextStepPrompt.js';
import { DEFAULT_ERROR_SLEEP_TIME, DEFAULT_MAX_RETRY_COUNT } from '../../../../lib/commands/shared/SpawnIssue.js';
import { DEFAULT_VALUE as BOOLEAN_KEY_DEFAULT } from '../../../../lib/utils/config/BooleanKeyConfig.js';
import KeyRegistry from '../../../../lib/utils/config/KeyRegistry.js';
import RepoConfig, { DEFAULT_SAFE_BRANCH } from '../../../../lib/utils/config/RepoConfig.js';
import MergeBodyResolver, { DEFAULT_MERGE_BODY_MODE } from '../../../../lib/utils/github/MergeBodyResolver.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

// Defaults drift spec (issue #777, docs/agents/specs/arcanum-cli/key-registry.md
// "How arcanum's own code consumes the registry"): every keys.json
// `default` must equal the default the code actually applies. Node
// defaults are compared through their exported constants (or, where the
// default is only implicit, the reader's observable result with no
// config present); shell defaults by running the helper against a temp
// repo with no config files and an empty CLAUDE_CONFIG_DIR. A fake `gh`
// / `curl` / `sleep` on PATH keeps every shell case offline and fast.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const LIB = path.join(REPO_ROOT, 'arcanum', '_lib');
const AUTO_FIX_ALL_SCRIPTS = path.join(REPO_ROOT, 'auto-fix-all', 'scripts');

const FAKE_GH = `#!/usr/bin/env bash
echo "gh $*" >> "$FAKE_LOG"
case "$1 $2" in
  "pr view")
    case "$*" in
      *number*) echo 7 ;;
      *headRefOid*) echo abc123 ;;
    esac
    ;;
  "auth token") echo fake-token ;;
  "api "*) echo '{"check_runs":[{"name":"lint","status":"completed","conclusion":"failure"}]}' ;;
  *) exit 0 ;;
esac
`;
const FAKE_CURL = '#!/usr/bin/env bash\necho "curl" >> "$FAKE_LOG"\nexit 22\n';
const FAKE_SLEEP = '#!/usr/bin/env bash\necho "$1" >> "$FAKE_SLEEP_LOG"\n';
const DUMMY_SHELL_IMPL = '#!/usr/bin/env bash\necho SHELL-IMPLEMENTATION\n';

describe('keys.json defaults drift', () => {
  const registry = new KeyRegistry();
  let root;
  let repoPath;
  let configDir;

  function registryDefault(key) {
    const entry = registry.entries().find((item) => item.key === key);

    expect(entry).withContext(`${key} is registered`).toBeDefined();

    return entry.default;
  }

  beforeEach(async () => {
    root = await createTempDir('arcanum-core-defaults-drift-');
    repoPath = path.join(root, 'repo');
    configDir = path.join(root, 'claude-config');

    await mkdir(repoPath, { recursive: true });
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await removeTempDir(root);
  });

  const nodeCases = {
    'git.safe_branch': async () => DEFAULT_SAFE_BRANCH,
    'git.merge_body_mode': async () => DEFAULT_MERGE_BODY_MODE,
    'git.omit_model_coauthor': async () => newMergeBodyResolver()._modelCoauthorOmitted(),
    'git.remove_coauthors': async () => newMergeBodyResolver()._removeCoauthorsList(),
    'next_step.auto.<skill>': async () => newNextStepPrompt().autoEnabled({ repoPath, autoKey: 'enhance-issue' }),
    'next_step.clear.<skill>': async () => newNextStepPrompt().clearEnabled({ repoPath, autoKey: 'enhance-issue' }),
    'auto-fix-all.ignored_check_patterns': async () =>
      new RepoConfig(createRepoContextMock({ repoPath })).getIgnoredCheckPatterns(),
    'auto-fix-all.clear_context': async () => JSON.parse(BOOLEAN_KEY_DEFAULT),
    'auto-fix-all.finish_on_empty_queue': async () => JSON.parse(BOOLEAN_KEY_DEFAULT),
    'plan-issues.max-retry-count': async () => DEFAULT_MAX_RETRY_COUNT,
    'plan-issues.error-sleep-time': async () => DEFAULT_ERROR_SLEEP_TIME
  };

  function newMergeBodyResolver() {
    const context = { readConfig: async () => undefined };

    return new MergeBodyResolver({ context, githubClient: {} });
  }

  function newNextStepPrompt() {
    return new NextStepPrompt({ env: { CLAUDE_CONFIG_DIR: configDir } });
  }

  const shellCases = {
    'engine.mode': async () => {
      const dummy = path.join(root, 'dummy_shell_impl.sh');

      await writeFile(dummy, DUMMY_SHELL_IMPL);

      // github-issue-info is a dual command whose status is not `shell`,
      // so only engine.mode=shell runs <shell_script>.
      const stdout = await runBash(
        'source "$1/engine_dispatch.sh"; engine_dispatch "$2" github-issue-info "$3" -- x',
        [LIB, repoPath, dummy]
      );

      return stdout === 'SHELL-IMPLEMENTATION\n' ? 'shell' : `not shell: ${stdout}`;
    },
    'git.safe_branch': async () => trimmed(await runBash('source "$1/safe_branch.sh"; safe_branch_get', [LIB])),
    'git.merge_body_mode': async () => trimmed(await runBash('source "$1/merge_body.sh"; merge_body_mode', [LIB])),
    'git.omit_model_coauthor': async () =>
      JSON.parse(await runBash('source "$1/agent_email.sh"; model_coauthor_omitted', [LIB])),
    'git.remove_coauthors': async () =>
      JSON.parse(await runBash('source "$1/agent_email.sh"; remove_coauthors_list', [LIB])),
    'next_step.auto.<skill>': async () => {
      const stdout = await runScript(path.join(LIB, 'next_step_prompt_shell.sh'), [
        '--repo', repoPath, '--command', '/enhance-issue 1', '--auto-key', 'enhance-issue', '--no-prompt'
      ]);

      return stdout.includes('AUTO=true');
    },
    'next_step.clear.<skill>': async () => {
      await writeLocalState({ next_step: { auto: { 'enhance-issue': true } } });

      const stdout = await runScript(path.join(LIB, 'next_step_prompt_shell.sh'), [
        '--repo', repoPath, '--command', '/enhance-issue 1', '--auto-key', 'enhance-issue', '--no-prompt'
      ]);

      expect(stdout).toContain('AUTO=true');

      return stdout.includes('CLEAR=true');
    },
    'auto-fix-all.ignored_check_patterns': async () => {
      // With no pattern configured nothing is ignored, so the failed
      // check is reported: the observable behaviour of `[]`.
      const stdout = await runScript(path.join(AUTO_FIX_ALL_SCRIPTS, 'wait_ci_shell.sh'), [repoPath]);

      return stdout === 'failed\nlint\n' ? [] : `checks were ignored: ${stdout}`;
    },
    'auto-fix-all.clear_context': async () =>
      JSON.parse(await runScript(path.join(AUTO_FIX_ALL_SCRIPTS, 'config_get_shell.sh'), [repoPath, 'clear_context'])),
    'auto-fix-all.finish_on_empty_queue': async () => JSON.parse(
      await runScript(path.join(AUTO_FIX_ALL_SCRIPTS, 'config_get_shell.sh'), [repoPath, 'finish_on_empty_queue'])
    ),
    'plan-issues.max-retry-count': async () => {
      const { stdout } = await runFailingSpawn();
      const attempts = [...stdout.matchAll(/\(attempt (\d+)\/(\d+)\)/g)];

      expect(attempts.length).toBe(Number(attempts.at(-1)[2]));

      return Number(attempts.at(-1)[2]);
    },
    'plan-issues.error-sleep-time': async () => {
      const { sleeps } = await runFailingSpawn();

      expect(new Set(sleeps).size).toBe(1);

      return Number(sleeps[0]);
    }
  };

  function trimmed(stdout) {
    return stdout.replace(/\n$/, '');
  }

  async function writeLocalState(content) {
    const dir = path.join(repoPath, '.claude', 'state');

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'arcanum-config.json'), JSON.stringify(content));
  }

  async function setUpRepo() {
    await execFileAsync('git', ['init', '--quiet', '-b', 'main', repoPath]);
    await execFileAsync('git', ['-C', repoPath, 'remote', 'add', 'origin', 'https://github.com/acme/widgets.git']);
  }

  async function fakeBinDir() {
    const binDir = path.join(root, 'bin');

    await mkdir(binDir, { recursive: true });

    for (const [name, source] of [['gh', FAKE_GH], ['curl', FAKE_CURL], ['sleep', FAKE_SLEEP]]) {
      await writeFile(path.join(binDir, name), source);
      await chmod(path.join(binDir, name), 0o755);
    }

    return binDir;
  }

  async function shellEnv() {
    const home = path.join(root, 'home');

    await mkdir(home, { recursive: true });

    return {
      PATH: `${await fakeBinDir()}${path.delimiter}${process.env.PATH}`,
      HOME: home,
      CLAUDE_CONFIG_DIR: configDir,
      FAKE_LOG: path.join(root, 'fake.log'),
      FAKE_SLEEP_LOG: path.join(root, 'sleep.log')
    };
  }

  async function runScript(script, args) {
    return runBash('bash "$@"', [script, ...args]);
  }

  async function runBash(source, args) {
    await setUpRepo();

    const { stdout } = await execFileAsync('bash', ['-c', source, 'bash', ...args], {
      cwd: repoPath,
      env: await shellEnv(),
      timeout: 30000
    });

    return stdout;
  }

  async function runFailingSpawn() {
    const bodyFile = path.join(root, 'body.md');

    await writeFile(bodyFile, 'body\n');

    let stdout;

    try {
      await runScript(path.join(LIB, 'spawn_issue_shell.sh'), [repoPath, '1', 'Title', bodyFile]);
    } catch (error) {
      stdout = error.stdout;
    }

    expect(stdout).withContext('spawn_issue_shell.sh exhausts its retries').toMatch(/STATUS=failed\n$/);

    const sleeps = (await readFile(path.join(root, 'sleep.log'), 'utf8')).trim().split('\n');

    return { stdout, sleeps };
  }

  it('covers every registry key that has a default', () => {
    const withDefault = registry.entries().filter((entry) => 'default' in entry).map((entry) => entry.key);
    const covered = new Set([...Object.keys(nodeCases), ...Object.keys(shellCases)]);

    expect(withDefault.filter((key) => !covered.has(key))).toEqual([]);
  });

  describe('Node defaults', () => {
    for (const [key, actual] of Object.entries(nodeCases)) {
      it(`match keys.json for ${key}`, async () => {
        expect(await actual()).toEqual(registryDefault(key));
      });
    }
  });

  describe('shell defaults', () => {
    for (const [key, actual] of Object.entries(shellCases)) {
      it(`match keys.json for ${key}`, async () => {
        expect(await actual()).toEqual(registryDefault(key));
      }, 30000);
    }
  });
});
