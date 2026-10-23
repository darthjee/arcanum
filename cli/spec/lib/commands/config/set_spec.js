import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Lock from '../../../../../shared/lib/file/Lock.js';
import { runCli } from '../../../support/cli.js';
import { LOCAL_FILE, REPO_FILE, makeRepo, removeDir, tmpDir, writeTier } from '../../../support/fixtures.js';

describe('config set', () => {
  let tmp;
  let account;
  let globalFile;
  let root;
  let env;
  let deps;

  const set = (args, options = {}) => runCli(['config', 'set', ...args], {
    cwd: root, env, deps, version: '2.4.0', migrationVersions: { repo: [], local: [], global: [] }, ...options
  });
  const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

  beforeEach(async () => {
    tmp = await tmpDir();
    account = path.join(tmp, 'account');
    globalFile = path.join(account, 'arcanum-config.json');
    await mkdir(account);
    root = await makeRepo(path.join(tmp, 'repo'), { repoConfig: { version: '2.4.0', engine: { mode: 'shell' } } });
    env = { CLAUDE_CONFIG_DIR: account };
    deps = { lock: new Lock({ sleepMs: 10 }), signals: { on: () => {}, off: () => {}, exit: () => {} } };
  });

  afterEach(async () => {
    await removeDir(tmp);
  });

  it('writes a key, creating the global file, and reports it', async () => {
    const result = await set(['next_step.auto.enhance-issue', 'true', '--global']);

    expect(result.code).toBe(0);
    expect(result.out).toBe(`set next_step.auto.enhance-issue = true   (global: ${globalFile}, was: unset)\n`);
    expect(await readJson(globalFile)).toEqual({ next_step: { auto: { 'enhance-issue': true } } });
  });

  it('prints the JSON shape', async () => {
    const result = await set(['engine.mode', 'native', '--repo', '--json']);

    expect(result.json()).toEqual({
      key: 'engine.mode', tier: 'repo', file: path.join(root, REPO_FILE),
      changed: true, previous: { set: true, value: 'shell' }, value: 'native', forced: false
    });
  });

  it('reports changed: false when the value is the same', async () => {
    expect((await set(['engine.mode', 'shell', '--repo', '--json'])).json().changed).toBeFalse();
  });

  it('keeps sibling keys and the file\'s key order', async () => {
    await writeTier(path.join(root, LOCAL_FILE), { git: { email: 'a@x' }, engine: { mode: 'native' } });

    await set(['git.agents.node', 'n@x', '--local']);

    expect(await readFile(path.join(root, LOCAL_FILE), 'utf8')).toBe(
      `${JSON.stringify({ git: { email: 'a@x', agents: { node: 'n@x' } }, engine: { mode: 'native' } }, null, 2)}\n`
    );
  });

  it('creates the local file in a configured repo', async () => {
    expect((await set(['git.safe_branch', 'origin/dev', '--local'])).code).toBe(0);
    expect(await readJson(path.join(root, LOCAL_FILE))).toEqual({ git: { safe_branch: 'origin/dev' } });
  });

  it('writes an empty file as if it were {}', async () => {
    await writeTier(globalFile, '');

    await set(['git.email', 'a@x', '--global']);

    expect(await readJson(globalFile)).toEqual({ git: { email: 'a@x' } });
  });

  it('replaces a whole object value', async () => {
    await writeTier(path.join(root, LOCAL_FILE), { custom: { a: 1, b: 2 } });

    await set(['custom', '{"c":3}', '--local', '--force']);

    expect(await readJson(path.join(root, LOCAL_FILE))).toEqual({ custom: { c: 3 } });
  });

  it('parses an array value', async () => {
    await set(['git.remove_coauthors', '["a@x","b@x"]', '--global']);

    expect(await readJson(globalFile)).toEqual({ git: { remove_coauthors: ['a@x', 'b@x'] } });
  });

  it('accepts a value starting with - after --', async () => {
    expect((await set(['custom.n', '--global', '--force', '--', '-1'])).code).toBe(0);
    expect(await readJson(globalFile)).toEqual({ custom: { n: -1 } });
  });

  describe('usage errors (exit 2)', () => {
    it('needs a tier', async () => {
      const result = await set(['engine.mode', 'native']);

      expect(result.code).toBe(2);
      expect(result.err).toContain('arcanum: set needs a tier: --global, --repo or --local');
    });

    it('needs a value', async () => {
      expect((await set(['engine.mode', '--repo'])).code).toBe(2);
    });

    it('refuses --all-tiers', async () => {
      expect((await set(['engine.mode', 'native', '--repo', '--all-tiers'])).code).toBe(2);
    });

    it('refuses a bad --lock-timeout', async () => {
      expect((await set(['engine.mode', 'native', '--repo', '--lock-timeout', '-1'])).code).toBe(2);
    });

    it('wins over every other refusal', async () => {
      const result = await runCli(['config', 'set', 'a..b', '1', '--local', '--json'], { cwd: account, env });

      expect(result.code).toBe(2);
      expect(JSON.parse(result.err).error.code).toBe('usage');
    });
  });

  describe('target unavailable (exit 4)', () => {
    it('refuses --local outside a repo', async () => {
      const result = await set(['git.safe_branch', 'x', '--local', '--json'], { cwd: account });

      expect(result.code).toBe(4);
      expect(JSON.parse(result.err)).toEqual({
        error: {
          code: 'target_unavailable', exit: 4,
          message: `arcanum: no repo at ${account}; --repo and --local need a git repo`, hint: null
        }
      });
    });

    it('refuses an unconfigured repo, even with --force', async () => {
      await rm(path.join(root, REPO_FILE));

      const result = await set(['engine.mode', 'native', '--local', '--force']);

      expect(result.code).toBe(4);
      expect(result.err).toBe(
        `arcanum: ${root} is not arcanum-configured (no ${REPO_FILE})\nhint: run /init-claude in that repo\n`
      );
    });

    it('refuses a missing claude config dir without creating it', async () => {
      const typo = path.join(tmp, 'typo');
      const result = await set(['git.email', 'a@x', '--global'], { env: { CLAUDE_CONFIG_DIR: typo } });

      expect(result.code).toBe(4);
      expect(result.err).toContain(`arcanum: claude config dir ${typo} does not exist`);
      await expectAsync(readFile(path.join(typo, 'arcanum-config.json'))).toBeRejected();
    });

    it('refuses an unresolved account', async () => {
      expect((await set(['git.email', 'a@x', '--global'], { env: {} })).code).toBe(4);
    });

    it('wins over a malformed file', async () => {
      await writeTier(path.join(root, REPO_FILE), '{oops');

      expect((await set(['engine.mode', 'native', '--global'], { env: {} })).code).toBe(4);
    });
  });

  describe('malformed files (exit 7)', () => {
    [
      ['invalid JSON', '{\n"a": 1,\n}', 'is not valid JSON (line 3)'],
      ['null', 'null', 'is not a JSON object (got null)'],
      ['an array', '[1]', 'is not a JSON object (got array)'],
      ['a scalar', '42', 'is not a JSON object (got 42)']
    ].forEach(([kind, content, message]) => {
      it(`refuses ${kind}, leaving the bytes unchanged, even with --force`, async () => {
        await writeTier(globalFile, content);

        const result = await set(['custom.x', '1', '--global', '--force']);

        expect(result.code).toBe(7);
        expect(result.err).toBe(
          `arcanum: ${globalFile} ${message}; refusing to overwrite it\nhint: fix or remove the file\n`
        );
        expect(await readFile(globalFile, 'utf8')).toBe(content);
      });
    });

    it('refuses an unreadable file (a directory)', async () => {
      await mkdir(globalFile);

      const result = await set(['git.email', 'a@x', '--global']);

      expect(result.code).toBe(7);
      expect(result.err).toContain('is unreadable');
    });

    it('refuses a non-object on the key\'s path, file unchanged', async () => {
      const content = '{"git": "oops"}\n';

      await writeTier(globalFile, content);

      const result = await set(['git.email', 'a@x', '--global']);

      expect(result.code).toBe(7);
      expect(result.err).toContain(`cannot write git.email to ${globalFile}: .git is not a JSON object`);
      expect(await readFile(globalFile, 'utf8')).toBe(content);
    });

    it('wins over a validation error', async () => {
      await writeTier(globalFile, '[1]');

      expect((await set(['nope.key', '1', '--global'])).code).toBe(7);
    });
  });

  describe('validation (exit 3)', () => {
    const cases = [
      [['nope.key', '1', '--global'], 'arcanum: unknown key \'nope.key\'\n' +
        'hint: check the spelling, or pass --force for a key newer than this CLI\n'],
      [['next_step.auto.enhance-issue', 'true', '--global', '--string'],
        'arcanum: next_step.auto.enhance-issue must be a boolean, got string "true"\nhint: drop --string\n'],
      [['version', '9.9.9', '--repo', '--force'], 'arcanum: version is read-only; it is managed by migrations\n'],
      [['auto-fix-all.ignored_check_patterns', '["a"]', '--global'],
        'arcanum: auto-fix-all.ignored_check_patterns is repo-only\n'],
      [['auto-fix-all.ignored_check_patterns', '["a","b","(x"]', '--repo'],
        'arcanum: auto-fix-all.ignored_check_patterns[2] is not a valid regex: Unterminated group\n'],
      [['git.safe_branch', 'null', '--local'],
        'arcanum: git.safe_branch must be a string, got null\nhint: use \'config unset\' to remove it\n'],
      [['engine.mode', 'turbo', '--repo'], 'arcanum: engine.mode must be one of shell, native, docker, got "turbo"\n'],
      [['git.remove_coauthors', '[1,', '--global'], /git\.remove_coauthors must be a JSON array: /],
      [['custom.big', '9007199254740993', '--global', '--force'],
        /cannot be stored as a number without losing precision\nhint: pass --string to store it as text/]
    ];

    cases.forEach(([args, expected]) => {
      it(`refuses ${args.join(' ')}`, async () => {
        const result = await set(args);

        expect(result.code).toBe(3);

        if (typeof expected === 'string') {
          expect(result.err).toBe(expected);
        } else {
          expect(result.err).toMatch(expected);
        }
      });
    });

    it('lets --force write an unknown key, reporting forced', async () => {
      const result = await set(['nope.key', 'null', '--global', '--force', '--json']);

      expect(result.code).toBe(0);
      expect(result.json().forced).toBeTrue();
      expect(await readJson(globalFile)).toEqual({ nope: { key: null } });
    });

    it('does not let --force bypass a known key\'s type', async () => {
      expect((await set(['engine.mode', 'turbo', '--repo', '--force'])).code).toBe(3);
    });

    it('stores a big number as text with --string', async () => {
      await set(['custom.big', '9007199254740993', '--global', '--force', '--string']);

      expect(await readJson(globalFile)).toEqual({ custom: { big: '9007199254740993' } });
    });

    it('wins over version skew', async () => {
      await writeTier(path.join(root, REPO_FILE), { version: '9.0.0' });

      expect((await set(['nope.key', '1', '--repo'])).code).toBe(3);
    });
  });

  describe('version skew (exit 5)', () => {
    beforeEach(async () => {
      await writeTier(path.join(root, REPO_FILE), { version: '2.5.0', engine: { mode: 'shell' } });
    });

    it('refuses a write to a tier ahead of the CLI', async () => {
      const result = await set(['engine.mode', 'native', '--repo']);

      expect(result.code).toBe(5);
      expect(result.err).toBe('arcanum: repo config is at 2.5.0, newer than this CLI (2.4.0)\n' +
        'hint: npm i -g arcanum-cli@latest, or pass --force\n');
    });

    it('ignores the pointers of other tiers', async () => {
      expect((await set(['engine.mode', 'native', '--global'])).code).toBe(0);
    });

    it('lets --force bypass it, reporting forced', async () => {
      const result = await set(['engine.mode', 'native', '--repo', '--force', '--json']);

      expect(result.code).toBe(0);
      expect(result.json().forced).toBeTrue();
    });

    it('wins over a held lock', async () => {
      await writeFile(path.join(root, `${REPO_FILE}.lock`), `${os.hostname()}:${process.pid}:held\n`);

      expect((await set(['engine.mode', 'native', '--repo', '--lock-timeout', '0'])).code).toBe(5);
    });
  });

  describe('lock contention (exit 6)', () => {
    let lockFile;

    beforeEach(async () => {
      lockFile = `${globalFile}.lock`;
      await writeFile(lockFile, `${os.hostname()}:${process.pid}:held-by-someone\n`);
    });

    it('times out after --lock-timeout, writing nothing', async () => {
      const result = await set(['git.email', 'a@x', '--global', '--lock-timeout', '0.05']);

      expect(result.code).toBe(6);
      expect(result.err).toBe(`arcanum: timed out after 0.05s waiting for ${lockFile}\n` +
        'hint: if no arcanum process is running, remove that file\n');
      await expectAsync(readFile(globalFile)).toBeRejected();
      expect(await readFile(lockFile, 'utf8')).toContain('held-by-someone');
    });

    it('tries once with --lock-timeout 0', async () => {
      expect((await set(['git.email', 'a@x', '--global', '--lock-timeout', '0', '--json'])).code).toBe(6);
    });

    it('does not print Lock\'s own "seems stuck" warning', async () => {
      const result = await set(['git.email', 'a@x', '--global', '--lock-timeout', '0.2'], {
        deps: { ...deps, lock: new Lock({ sleepMs: 1 }) }
      });

      expect(result.code).toBe(6);
      expect(result.err).not.toContain('seems stuck');
    });

    it('acquires the lock once it is released', async () => {
      setTimeout(() => {
        rm(lockFile, { force: true });
      }, 30);

      const result = await set(['git.email', 'a@x', '--global', '--lock-timeout', '5']);

      expect(result.code).toBe(0);
      expect(await readJson(globalFile)).toEqual({ git: { email: 'a@x' } });
      await expectAsync(readFile(lockFile)).toBeRejected();
    });
  });

  describe('SIGINT', () => {
    it('releases a held lock and exits 130', async () => {
      const handlers = [];
      let exitCode;
      const lock = new Lock({ sleepMs: 10 });
      const lockFile = `${globalFile}.lock`;
      const signals = {
        on: (signal, handler) => handlers.push(handler),
        off: () => {},
        exit: (code) => {
          exitCode = code;
        }
      };
      const acquire = lock.acquire.bind(lock);
      let interrupted;

      spyOn(lock, 'acquire').and.callFake(async (...args) => {
        await acquire(...args);
        interrupted = new Promise((resolve) => {
          handlers[0]();
          setTimeout(resolve, 20);
        });
      });

      await set(['git.email', 'a@x', '--global'], { deps: { lock, signals } });
      await interrupted;

      expect(lock.acquire.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ warn: false }));
      expect(exitCode).toBe(130);
      await expectAsync(readFile(lockFile)).toBeRejected();
    });
  });
});
