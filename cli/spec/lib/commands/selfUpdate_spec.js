import { EventEmitter } from 'node:events';

import { findPackageDir, isPlainSemver } from '../../../lib/commands/selfUpdate.js';
import { InterruptedError, NpmError } from '../../../lib/exitCodes.js';
import { classifyNpmError } from '../../../lib/npm.js';
import { runCli } from '../../support/cli.js';

describe('self-update', () => {
  const ROOT = '/usr/local/lib/node_modules';
  const GLOBAL = `${ROOT}/arcanum-cli`;
  const RUNNING = '/usr/local/lib/node_modules/arcanum-cli';
  const VIEW_ARGS = ['view', 'arcanum-cli@latest', 'version', '--json', '--fetch-retries=0', '--fetch-timeout=15000'];

  let npm;
  let files;
  let links;
  let signals;
  let deps;

  const npmFailure = (args, fields) => classifyNpmError(args, Object.assign(new Error('Command failed'), fields));

  /**
   * @param {object} handlers - npm subcommand → a result or a thrown error.
   * @returns {jasmine.Spy} a fake `runNpm`.
   */
  const fakeNpm = (handlers) => jasmine.createSpy('runNpm').and.callFake(async (args) => {
    const handler = handlers[args[0]];

    if (handler instanceof Error) {
      throw handler;
    }

    if (typeof handler === 'function') {
      return handler(args);
    }

    return { stdout: handler === undefined ? '' : handler, stderr: '' };
  });

  const stat = (kind) => ({ isSymbolicLink: () => kind === 'link', isDirectory: () => kind === 'dir' });

  const npmCalls = () => npm.calls.allArgs().map(([args]) => args);
  const installCalls = () => npmCalls().filter((args) => args[0] === 'i');

  const selfUpdate = (argv = [], { version = '2.2.3', env = {} } = {}) => runCli(
    ['self-update', ...argv], { cwd: '/work', env, version, deps }
  );

  beforeEach(() => {
    files = { [`${GLOBAL}/package.json`]: JSON.stringify({ name: 'arcanum-cli', version: '2.3.0' }) };
    links = { [GLOBAL]: 'dir' };
    signals = new EventEmitter();
    npm = fakeNpm({
      root: `${ROOT}\n`,
      view: '"2.3.0"\n',
      i: (args) => {
        files[`${GLOBAL}/package.json`] = JSON.stringify({ version: args[3].split('@')[1] });

        return { stdout: 'changed 1 package in 2s\n', stderr: 'npm warn something\n' };
      },
      config: 'https://registry.example.com/\n'
    });
    deps = {
      runNpm: npm,
      platform: 'darwin',
      packageDir: RUNNING,
      signals,
      realpath: jasmine.createSpy('realpath').and.callFake(async (file) => file),
      lstat: jasmine.createSpy('lstat').and.callFake(async (file) => {
        if (!links[file]) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }

        return stat(links[file]);
      }),
      readFile: jasmine.createSpy('readFile').and.callFake(async (file) => {
        if (!Object.hasOwn(files, file)) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }

        return files[file];
      })
    };
  });

  describe('outcomes', () => {
    it('updates an older global copy to the exact latest version', async () => {
      files[`${GLOBAL}/package.json`] = JSON.stringify({ version: '2.2.3' });

      const result = await selfUpdate();

      expect(result.code).toBe(0);
      expect(result.out).toBe('Updated arcanum-cli 2.2.3 → 2.3.0\n');
      expect(result.err).toBe('arcanum: note: updating arcanum-cli 2.2.3 → 2.3.0...\n');
      expect(npmCalls()).toEqual([['root', '-g'], VIEW_ARGS, ['i', '-g', '--ignore-scripts', 'arcanum-cli@2.3.0']]);
    });

    it('prints exactly one JSON object for an update, the note staying on stderr', async () => {
      const result = await selfUpdate(['--json']);

      expect(result.code).toBe(0);
      expect(result.json()).toEqual({ status: 'updated', from: '2.2.3', to: '2.3.0', latest: '2.3.0' });
      expect(result.out.trim().split('\n').length).toBe(1);
      expect(result.err).toBe('arcanum: note: updating arcanum-cli 2.2.3 → 2.3.0...\n');
    });

    it('is up to date when the running version is latest, with no install', async () => {
      const result = await selfUpdate([], { version: '2.3.0' });

      expect(result.code).toBe(0);
      expect(result.out).toBe('arcanum-cli is up to date (2.3.0)\n');
      expect(result.err).toBe('');
      expect(installCalls()).toEqual([]);
    });

    it('reports up_to_date under --json', async () => {
      const result = await selfUpdate(['--json'], { version: '2.3.0' });

      expect(result.json()).toEqual({ status: 'up_to_date', from: '2.3.0', to: '2.3.0', latest: '2.3.0' });
    });

    it('never downgrades a running copy newer than latest', async () => {
      const result = await selfUpdate([], { version: '2.4.0-rc.1' });

      expect(result.code).toBe(0);
      expect(result.out).toBe('arcanum-cli 2.4.0-rc.1 is newer than the latest release (2.3.0); nothing to do\n');
      expect(result.err).toBe('');
      expect(installCalls()).toEqual([]);
    });

    it('reports newer under --json', async () => {
      const result = await selfUpdate(['--json'], { version: '2.4.0-rc.1' });

      expect(result.json()).toEqual({ status: 'newer', from: '2.4.0-rc.1', to: '2.4.0-rc.1', latest: '2.3.0' });
    });

    it('drops npm\'s captured output on success', async () => {
      const result = await selfUpdate();

      expect(result.out).not.toContain('changed 1 package');
      expect(result.err).not.toContain('npm warn');
    });

    it('shows npm\'s captured output on stderr under ARCANUM_DEBUG=1', async () => {
      const result = await selfUpdate([], { env: { ARCANUM_DEBUG: '1' } });

      expect(result.out).toBe('Updated arcanum-cli 2.2.3 → 2.3.0\n');
      expect(result.err).toContain('changed 1 package in 2s\nnpm warn something\n');
    });

    it('ignores ARCANUM_SKIP_CLI', async () => {
      const result = await selfUpdate([], { env: { ARCANUM_SKIP_CLI: '1' } });

      expect(result.code).toBe(0);
      expect(installCalls().length).toBe(1);
    });
  });

  describe('running copy vs global install', () => {
    it('refuses a linked checkout (exit 4) without any network call', async () => {
      links[GLOBAL] = 'link';
      deps.realpath.and.callFake(async (file) => (file === GLOBAL ? '/src/arcanum/cli' : file));

      const result = await selfUpdate();

      expect(result.code).toBe(4);
      expect(result.out).toBe('');
      expect(result.err).toBe(
        'arcanum: running from a linked checkout (/src/arcanum/cli); update it with git pull and a rebuild\n'
      );
      expect(npmCalls()).toEqual([['root', '-g']]);
    });

    it('reports a linked checkout as target_unavailable under --json', async () => {
      links[GLOBAL] = 'link';

      const result = await selfUpdate(['--json']);

      expect(result.code).toBe(4);
      expect(result.out).toBe('');
      expect(JSON.parse(result.err).error).toEqual(jasmine.objectContaining({ code: 'target_unavailable', exit: 4 }));
    });

    it('refuses a copy that is not the global install, with the hint and the nvm note', async () => {
      deps.packageDir = '/work/node_modules/arcanum-cli';

      const result = await selfUpdate();

      expect(result.code).toBe(4);
      expect(result.out).toBe('');
      expect(result.err).toBe(
        'arcanum: this arcanum-cli (/work/node_modules/arcanum-cli) is not the global install\n' +
        'hint: run npm i -g arcanum-cli@latest, or update it through the project\'s package manager ' +
        '(a different Node/npm on PATH? e.g. nvm)\n'
      );
      expect(npmCalls()).toEqual([['root', '-g']]);
    });

    it('refuses when there is no global arcanum-cli', async () => {
      delete links[GLOBAL];

      const result = await selfUpdate();

      expect(result.code).toBe(4);
      expect(result.err).toContain('is not the global install');
      expect(installCalls()).toEqual([]);
    });

    it('refuses when the global arcanum-cli is not a directory', async () => {
      links[GLOBAL] = 'file';

      expect((await selfUpdate()).code).toBe(4);
    });

    it('refuses when the running package cannot be found (a source run)', async () => {
      deps.packageDir = null;

      const result = await selfUpdate();

      expect(result.code).toBe(4);
      expect(result.err).toContain('is not the global install');
    });

    it('follows a symlinked bin through realpath to the global copy', async () => {
      deps.packageDir = '/opt/alias/arcanum-cli';
      deps.realpath.and.callFake(async (file) => (file === '/opt/alias/arcanum-cli' ? GLOBAL : file));

      const result = await selfUpdate();

      expect(result.code).toBe(0);
      expect(result.out).toBe('Updated arcanum-cli 2.2.3 → 2.3.0\n');
    });

    it('treats an unresolvable path as itself', async () => {
      deps.realpath.and.rejectWith(new Error('ELOOP'));

      expect((await selfUpdate()).code).toBe(0);
    });

    it('finds the running package by default, a source checkout not being the global copy', async () => {
      delete deps.packageDir;
      delete deps.readFile;

      const result = await selfUpdate();

      expect(result.code).toBe(4);
      expect(result.err).toMatch(/this arcanum-cli \(.*\/cli\) is not the global install/);
    });
  });

  describe('failures', () => {
    it('reports npm missing from PATH (exit 8), not a file error', async () => {
      npm = fakeNpm({ root: npmFailure(['root', '-g'], { code: 'ENOENT', errno: -2, syscall: 'spawn npm' }) });
      deps.runNpm = npm;

      const result = await selfUpdate();

      expect(result.code).toBe(8);
      expect(result.err).toBe('arcanum: npm not found on PATH\nhint: install Node.js and npm, then run it again\n');
    });

    it('reports npm missing under --json with the npm identifier', async () => {
      deps.runNpm = fakeNpm({ root: npmFailure(['root', '-g'], { code: 'ENOENT' }) });

      const result = await selfUpdate(['--json']);

      expect(JSON.parse(result.err)).toEqual({
        error: { code: 'npm', exit: 8, message: 'arcanum: npm not found on PATH', hint: 'install Node.js and npm, then run it again' }
      });
    });

    it('reports npm root -g failing, with npm\'s last lines', async () => {
      deps.runNpm = fakeNpm({ root: npmFailure(['root', '-g'], { code: 1, stderr: 'npm error broken\n' }) });

      const result = await selfUpdate();

      expect(result.code).toBe(8);
      expect(result.err).toBe('arcanum: could not locate the npm global install (npm root -g failed)\nnpm error broken\n');
    });

    it('bounds npm root -g and reports its timeout', async () => {
      deps.runNpm = fakeNpm({ root: npmFailure(['root', '-g'], { killed: true, signal: 'SIGTERM' }) });

      const result = await selfUpdate();

      expect(result.code).toBe(8);
      expect(result.err).toContain('could not locate the npm global install (npm root -g failed)');
      expect(deps.runNpm.calls.argsFor(0)[1]).toEqual({ timeout: 15000 });
    });

    it('bounds npm view, with no registry override', async () => {
      await selfUpdate();

      expect(npm.calls.argsFor(1)).toEqual([VIEW_ARGS, { timeout: 30000 }]);
      expect(npmCalls().flat().some((arg) => arg.startsWith('--registry'))).toBeFalse();
      expect(npmCalls().flat()).not.toContain('sudo');
    });

    [
      ['a network error', { code: 1, stderr: 'npm error code ENOTFOUND\n' }],
      ['a timeout', { killed: true, signal: 'SIGTERM' }]
    ].forEach(([label, fields]) => {
      it(`reports ${label} on npm view as an unreachable registry, with no install`, async () => {
        npm = fakeNpm({ root: ROOT, view: npmFailure(VIEW_ARGS, fields) });
        deps.runNpm = npm;

        const result = await selfUpdate();

        expect(result.code).toBe(8);
        expect(result.err).toMatch(
          /^arcanum: could not reach the npm registry\nhint: check your network or npm proxy\/registry config\n/
        );
        expect(installCalls()).toEqual([]);
      });
    });

    it('names the configured registry on E404', async () => {
      npm = fakeNpm({
        root: ROOT, view: npmFailure(VIEW_ARGS, { code: 1, stderr: 'npm error code E404\n' }),
        config: 'https://registry.example.com/\n'
      });
      deps.runNpm = npm;

      const result = await selfUpdate();

      expect(result.code).toBe(8);
      expect(result.err).toMatch(/^arcanum: arcanum-cli is not on the configured registry \(https:\/\/registry\.example\.com\/\)\n/);
      expect(npm.calls.argsFor(2)).toEqual([['config', 'get', 'registry'], { timeout: 5000 }]);
      expect(installCalls()).toEqual([]);
    });

    it('falls back to a generic registry name when npm config get fails', async () => {
      deps.runNpm = fakeNpm({
        root: ROOT, view: npmFailure(VIEW_ARGS, { code: 1, stderr: 'npm error code E404\n' }),
        config: npmFailure(['config'], { code: 1 })
      });

      const result = await selfUpdate();

      expect(result.err).toContain('arcanum-cli is not on the configured registry (the configured registry)');
    });

    it('falls back to a generic registry name when npm config get prints nothing', async () => {
      deps.runNpm = fakeNpm({
        root: ROOT, view: npmFailure(VIEW_ARGS, { code: 1, stderr: 'npm error code E404\n' }), config: '\n'
      });

      expect((await selfUpdate()).err).toContain('(the configured registry)');
    });

    it('keeps any other npm view failure as npm reported it', async () => {
      deps.runNpm = fakeNpm({ root: ROOT, view: npmFailure(VIEW_ARGS, { code: 1, stderr: 'npm error code EWEIRD\n' }) });

      const result = await selfUpdate();

      expect(result.code).toBe(8);
      expect(result.err).toContain(`arcanum: npm ${VIEW_ARGS.join(' ')} failed (exit 1)`);
    });

    ['"latest"', '"2.3"', '"v2.3.0"', '"2.3.0+build"', '["2.3.0"]', 'not json', '"2.3.0; rm -rf /"'].forEach((stdout) => {
      it(`refuses the invalid version ${stdout} and never installs`, async () => {
        npm = fakeNpm({ root: ROOT, view: stdout });
        deps.runNpm = npm;

        const result = await selfUpdate();

        expect(result.code).toBe(8);
        expect(result.err).toMatch(/^arcanum: npm returned an invalid version '.*'\n$/);
        expect(installCalls()).toEqual([]);
      });
    });

    it('quotes the bare invalid string', async () => {
      deps.runNpm = fakeNpm({ root: ROOT, view: '"latest"\n' });

      expect((await selfUpdate()).err).toBe('arcanum: npm returned an invalid version \'latest\'\n');
    });

    ['EACCES', 'EPERM'].forEach((code) => {
      it(`reports an unwritable prefix on ${code}, never retrying with sudo`, async () => {
        npm = fakeNpm({
          root: ROOT, view: '"2.3.0"',
          i: npmFailure(['i'], { code: 243, stderr: `npm error code ${code}\nnpm error path ${ROOT}\n` })
        });
        deps.runNpm = npm;

        const result = await selfUpdate();

        expect(result.code).toBe(8);
        expect(result.err).toBe(
          'arcanum: note: updating arcanum-cli 2.2.3 → 2.3.0...\n' +
          'arcanum: the npm global prefix (/usr/local) is not writable\n' +
          'hint: fix its permissions or use a user-owned prefix (npm config set prefix ~/.npm-global); ' +
          'arcanum never retries with sudo\n' +
          `npm error code ${code}\nnpm error path ${ROOT}\n`
        );
        expect(installCalls().length).toBe(1);
      });
    });

    it('reports any other npm i -g failure with its exit code and npm\'s lines', async () => {
      deps.runNpm = fakeNpm({
        root: ROOT, view: '"2.3.0"', i: npmFailure(['i'], { code: 1, stderr: 'npm error code ETARGET\n' })
      });

      const result = await selfUpdate(['--json']);

      expect(result.code).toBe(8);
      expect(result.out).toBe('');
      expect(result.err.split('\n')[1]).toBe(JSON.stringify({
        error: { code: 'npm', exit: 8, message: 'arcanum: npm i -g failed (exit 1)', hint: null }
      }));
    });

    it('words an npm i -g failure without an exit code', async () => {
      deps.runNpm = fakeNpm({ root: ROOT, view: '"2.3.0"', i: new NpmError('x', { category: 'failed' }) });

      expect((await selfUpdate()).err).toContain('arcanum: npm i -g failed (exit unknown)');
    });

    it('lets npm vanishing before npm i -g surface as npm not found', async () => {
      deps.runNpm = fakeNpm({ root: ROOT, view: '"2.3.0"', i: npmFailure(['i'], { code: 'ENOENT' }) });

      expect((await selfUpdate()).err).toContain('arcanum: npm not found on PATH');
    });

    it('rethrows a non-npm error from npm view or npm i -g unchanged', async () => {
      deps.runNpm = fakeNpm({ root: ROOT, view: new Error('boom') });

      expect((await selfUpdate()).code).toBe(1);

      deps.runNpm = fakeNpm({ root: ROOT, view: '"2.3.0"', i: new Error('bang') });

      expect((await selfUpdate()).code).toBe(1);
    });

    it('refuses when the installed package.json is not at the version', async () => {
      deps.runNpm = fakeNpm({ root: ROOT, view: '"2.3.0"', i: '' });
      files[`${GLOBAL}/package.json`] = JSON.stringify({ version: '2.2.3' });

      const result = await selfUpdate();

      expect(result.code).toBe(8);
      expect(result.out).toBe('');
      expect(result.err).toContain('arcanum: npm i -g reported success but arcanum-cli is at 2.2.3\n');
    });

    it('refuses when the installed package.json cannot be read', async () => {
      deps.runNpm = fakeNpm({ root: ROOT, view: '"2.3.0"', i: '' });
      delete files[`${GLOBAL}/package.json`];

      expect((await selfUpdate()).err).toContain('reported success but arcanum-cli is at an unreadable version');
    });
  });

  describe('edge cases', () => {
    it('updates a prerelease to its release', async () => {
      const result = await selfUpdate(['--json'], { version: '2.3.0-rc.1' });

      expect(result.json()).toEqual({ status: 'updated', from: '2.3.0-rc.1', to: '2.3.0', latest: '2.3.0' });
    });

    it('compares a prerelease latest without a special case', async () => {
      npm.and.callFake(async (args) => {
        if (args[0] === 'view') {
          return { stdout: '"2.4.0-rc.2"', stderr: '' };
        }

        if (args[0] === 'i') {
          files[`${GLOBAL}/package.json`] = JSON.stringify({ version: '2.4.0-rc.2' });
        }

        return { stdout: args[0] === 'root' ? ROOT : '', stderr: '' };
      });

      const result = await selfUpdate(['--json'], { version: '2.4.0-rc.1' });

      expect(result.json().status).toBe('updated');
      expect(installCalls()).toEqual([['i', '-g', '--ignore-scripts', 'arcanum-cli@2.4.0-rc.2']]);
    });

    it('exits 130 on Ctrl-C during npm i -g, naming the fallback', async () => {
      deps.runNpm = fakeNpm({ root: ROOT, view: '"2.3.0"', i: new InterruptedError('npm i -g was interrupted') });

      const result = await selfUpdate();

      expect(result.code).toBe(130);
      expect(result.err).toBe(
        'arcanum: note: updating arcanum-cli 2.2.3 → 2.3.0...\n' +
        'arcanum: the install may be incomplete; run arcanum self-update again\n' +
        'hint: if arcanum no longer runs: npm i -g arcanum-cli@latest\n'
      );
    });

    it('keeps the CLI alive on SIGINT only while npm i -g runs', async () => {
      let listenersDuringInstall;

      deps.runNpm = fakeNpm({
        root: ROOT, view: '"2.3.0"',
        i: () => {
          listenersDuringInstall = signals.listenerCount('SIGINT');
          signals.emit('SIGINT');
          files[`${GLOBAL}/package.json`] = JSON.stringify({ version: '2.3.0' });

          return { stdout: '', stderr: '' };
        }
      });

      await selfUpdate();

      expect(listenersDuringInstall).toBe(1);
      expect(signals.listenerCount('SIGINT')).toBe(0);
    });

    it('refuses Windows (exit 1) before any npm call', async () => {
      deps.platform = 'win32';

      const result = await selfUpdate();

      expect(result.code).toBe(1);
      expect(result.err).toBe('arcanum: self-update is not supported on Windows\nhint: npm i -g arcanum-cli@latest\n');
      expect(npm).not.toHaveBeenCalled();
    });
  });

  describe('usage', () => {
    it('prints its usage for --help, without any npm call', async () => {
      const result = await selfUpdate(['--help']);

      expect(result.code).toBe(0);
      expect(result.out).toMatch(/^Usage: arcanum self-update \[--json\]\n/);
      expect(result.out).toContain('-h, --help');
      expect(npm).not.toHaveBeenCalled();
    });

    it('refuses an extra argument (exit 2)', async () => {
      const result = await selfUpdate(['2.3.0']);

      expect(result.code).toBe(2);
      expect(result.err).toContain('arcanum: self-update: unexpected argument \'2.3.0\'\n');
      expect(npm).not.toHaveBeenCalled();
    });

    it('refuses --repo <path> (exit 2)', async () => {
      const result = await selfUpdate(['--repo', './x']);

      expect(result.code).toBe(2);
      expect(result.err).toContain('arcanum: --repo is not accepted by self-update\n');
    });

    it('refuses --claude-config-dir (exit 2)', async () => {
      const result = await selfUpdate(['--claude-config-dir', '/d']);

      expect(result.code).toBe(2);
      expect(result.err).toContain('arcanum: --claude-config-dir is not accepted by self-update\n');
      expect(npm).not.toHaveBeenCalled();
    });

    it('refuses a tier flag as an unknown option (exit 2)', async () => {
      expect((await selfUpdate(['--global'])).code).toBe(2);
    });
  });

  describe('defaults', () => {
    it('runs npm through execFileAsync when no runNpm is injected', async () => {
      const execFileAsync = jasmine.createSpy('execFileAsync').and.callFake(async (file, args) => {
        if (args[0] === 'root') {
          return { stdout: `${ROOT}\n`, stderr: '' };
        }

        return { stdout: '"2.2.3"\n', stderr: '' };
      });

      delete deps.runNpm;
      deps.execFileAsync = execFileAsync;

      const result = await selfUpdate();

      expect(result.code).toBe(0);
      expect(execFileAsync.calls.allArgs().map(([file]) => file)).toEqual(['npm', 'npm']);
    });
  });

  describe('findPackageDir', () => {
    it('walks up to the arcanum-cli package.json', async () => {
      const readFile = async (file) => {
        if (file === '/a/arcanum-cli/package.json') {
          return JSON.stringify({ name: 'arcanum-cli' });
        }

        if (file === '/a/arcanum-cli/dist/package.json') {
          return JSON.stringify({ name: 'other' });
        }

        throw new Error('ENOENT');
      };

      expect(await findPackageDir('/a/arcanum-cli/dist/x', readFile)).toBe('/a/arcanum-cli');
      expect(await findPackageDir('/b/c', readFile)).toBeNull();
    });
  });

  describe('isPlainSemver', () => {
    it('accepts MAJOR.MINOR.PATCH[-prerelease] only', () => {
      expect(isPlainSemver('2.3.0')).toBeTrue();
      expect(isPlainSemver('2.3.0-rc.1')).toBeTrue();
      expect(isPlainSemver('2.3.0+b')).toBeFalse();
      expect(isPlainSemver(230)).toBeFalse();
    });
  });
});
