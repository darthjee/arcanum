import path from 'node:path';
import {
  createDirPair, readOptional, runCwdPair, writeJson
} from '../../support/factories/monitorIssuesParitySetup.js';
import { expectParity } from '../../support/utils/runCommand.js';

// Parity test for the "monitor-issues-rewrite-queue-*" migrated
// entrypoints (issue #586): runs
// monitor-issues/scripts/rewrite_queue_<subcommand>_shell.sh and
// `core/bin/arcanum monitor-issues-rewrite-queue-<subcommand> <cwd>`
// against identically-seeded directories, asserting byte-identical
// stdout, exit code and queue file.
const QUEUE = path.join('.claude', 'state', 'monitor-issues-rewrite-queue.json');

describe('monitor-issues-rewrite-queue-* parity (shell vs. native)', () => {
  let dirs;

  beforeEach(async () => {
    dirs = await createDirPair();
  });

  afterEach(async () => {
    await dirs.cleanup();
  });

  async function seed(entries) {
    await writeJson(dirs.shellDir, QUEUE, entries);
    await writeJson(dirs.nativeDir, QUEUE, entries);
  }

  async function expectSameQueue() {
    expect(await readOptional(dirs.nativeDir, QUEUE)).toEqual(await readOptional(dirs.shellDir, QUEUE));
  }

  function run(subcommand, args) {
    return runCwdPair(`rewrite_queue_${subcommand}_shell.sh`, `monitor-issues-rewrite-queue-${subcommand}`, dirs, args);
  }

  it('push: matches for a new id, creating identical queue files', async () => {
    const { shell, native } = await run('push', ['5']);

    expectParity(shell, native);
    expect(shell.stdout).toEqual('Pushed: 5\n');
    await expectSameQueue();
  });

  it('push: matches for a duplicate id (idempotent)', async () => {
    await seed([{ id: '5' }, { id: '6' }]);

    const { shell, native } = await run('push', ['5']);

    expectParity(shell, native);
    await expectSameQueue();
  });

  it('push: matches for a missing id (exit 1)', async () => {
    const { shell, native } = await run('push', []);

    expectParity(shell, native);
    expect(shell.code).toEqual(1);
    expect(native.stderr).toContain(shell.stderr.trim());
  });

  it('pop: matches for a non-empty queue', async () => {
    await seed([{ id: '5' }, { id: '6' }]);

    const { shell, native } = await run('pop', []);

    expectParity(shell, native);
    expect(shell.stdout).toEqual('5\n');
    await expectSameQueue();
  });

  it('pop: matches for an empty/absent queue (exit 1, no output)', async () => {
    const { shell, native } = await run('pop', []);

    expectParity(shell, native);
    expect(shell.code).toEqual(1);
    expect(shell.stdout).toEqual('');
  });
});
