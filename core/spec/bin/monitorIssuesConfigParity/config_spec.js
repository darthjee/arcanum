import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  createDirPair, readOptional, runCwdPair, writeJson
} from '../../support/factories/monitorIssuesParitySetup.js';
import { expectParity } from '../../support/utils/runCommand.js';

// Parity test for the "monitor-issues-config-*" migrated entrypoints
// (issue #586): runs monitor-issues/scripts/config_<subcommand>_shell.sh
// and `core/bin/arcanum monitor-issues-config-<subcommand> <cwd>` against
// identically-seeded directories, asserting byte-identical stdout, exit
// code and written files.
const CONFIG = path.join('.claude', 'configuration', 'monitor-issues.json');
const STATE = path.join('.claude', 'state', 'monitor-issues-config.json');

// Each shell/native write acquires the config/state file lock, which sleeps a
// real 1 second per acquisition (see docs/agents/architecture/lock-system.md),
// so these specs get a generous timeout rather than Jasmine's 5000ms default
// to avoid flaking on slower CI runners.
const LOCKED_WRITE_TIMEOUT_MS = 30000;

describe('monitor-issues-config-* parity (shell vs. native)', () => {
  let dirs;

  beforeEach(async () => {
    dirs = await createDirPair();
    // config_set_shell.sh writes <file>.tmp without creating
    // .claude/configuration/ first, so seed it on both sides.
    await Promise.all([dirs.shellDir, dirs.nativeDir].map((dir) => mkdir(path.join(dir, '.claude', 'configuration'), { recursive: true })));
  });

  afterEach(async () => {
    await dirs.cleanup();
  });

  async function seed(relative, content) {
    await writeJson(dirs.shellDir, relative, content);
    await writeJson(dirs.nativeDir, relative, content);
  }

  async function expectSameFile(relative) {
    expect(await readOptional(dirs.nativeDir, relative)).toEqual(await readOptional(dirs.shellDir, relative));
  }

  function run(subcommand, args) {
    return runCwdPair(
      `config_${subcommand.replace('-', '_')}_shell.sh`, `monitor-issues-config-${subcommand}`, dirs, args
    );
  }

  it('get: matches for a present, an absent and a clear_context key', async () => {
    await seed(CONFIG, { auto_rewrite: true, name: 'abc' });
    await seed(STATE, { clear_context: true });

    for (const key of ['auto_rewrite', 'name', 'missing', 'clear_context']) {
      const { shell, native } = await run('get', [key]);

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
    }
  });

  it('is-enabled: matches for true (exit 0) and false (exit 1)', async () => {
    await seed(CONFIG, { on: true, off: false });

    const on = await run('is-enabled', ['on']);
    const off = await run('is-enabled', ['off']);

    expectParity(on.shell, on.native);
    expect(on.shell.code).toEqual(0);
    expectParity(off.shell, off.native);
    expect(off.shell.code).toEqual(1);
  });

  it('set: matches for a valid value, writing identical files', async () => {
    await seed(CONFIG, { other: 'x' });

    const { shell, native } = await run('set', ['auto_rewrite', 'true']);

    expectParity(shell, native);
    expect(shell.code).toEqual(0);
    await expectSameFile(CONFIG);

    const state = await run('set', ['clear_context', 'false']);

    expectParity(state.shell, state.native);
    await expectSameFile(STATE);
  }, LOCKED_WRITE_TIMEOUT_MS);

  it('set: matches for an invalid value (exit 1, same stderr message)', async () => {
    const { shell, native } = await run('set', ['auto_rewrite', 'maybe']);

    expectParity(shell, native);
    expect(shell.code).toEqual(1);
    expect(native.stderr).toContain(shell.stderr.trim());
  });

  it('toggle: matches, printing the new value and writing identical files', async () => {
    await seed(CONFIG, { auto_rewrite: true });

    const first = await run('toggle', ['auto_rewrite']);
    const second = await run('toggle', ['clear_context']);

    expectParity(first.shell, first.native);
    expect(first.shell.stdout).toEqual('false\n');
    expectParity(second.shell, second.native);
    expect(second.shell.stdout).toEqual('true\n');
    await expectSameFile(CONFIG);
    await expectSameFile(STATE);
  }, LOCKED_WRITE_TIMEOUT_MS);

  for (const subcommand of ['get', 'is-enabled', 'set', 'toggle']) {
    it(`${subcommand}: matches for a missing key (exit 1, same stderr message)`, async () => {
      const { shell, native } = await run(subcommand, []);

      expectParity(shell, native);
      expect(shell.code).toEqual(1);
      expect(native.stderr).toContain(shell.stderr.trim());
    });
  }
});
