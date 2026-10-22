import { execFile } from 'node:child_process';
import { access, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CLI_DIR, REPO_ROOT } from '../support/paths.js';

// Runs the built bundle (`yarn build` first) through the gate, from a
// temp copy outside the repo, which proves the bundle is self-contained.

/**
 * @param {string} gate - the copied bin/arcanum.
 * @param {string[]} args - the CLI arguments.
 * @param {string} cwd - the working directory.
 * @returns {Promise<{code: number, stdout: string, stderr: string}>} the outcome.
 */
function runCli(gate, args, cwd) {
  return new Promise((resolve) => {
    execFile(process.execPath, [gate, ...args], { cwd }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr });
    });
  });
}

describe('smoke: dist/arcanum.mjs', () => {
  let tmp;
  let gate;
  let manifest;

  beforeAll(async () => {
    await access(path.join(CLI_DIR, 'dist', 'arcanum.mjs')).catch(() => {
      throw new Error('cli/dist/arcanum.mjs is missing: run `yarn build` before `yarn test`');
    });

    manifest = JSON.parse(await readFile(path.join(CLI_DIR, 'package.json'), 'utf8'));
    tmp = await mkdtemp(path.join(os.tmpdir(), 'arcanum-cli-smoke-'));
    await cp(path.join(CLI_DIR, 'bin'), path.join(tmp, 'bin'), { recursive: true });
    await cp(path.join(CLI_DIR, 'dist'), path.join(tmp, 'dist'), { recursive: true });
    gate = path.join(tmp, 'bin', 'arcanum');
  });

  afterAll(async () => {
    if (tmp) {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('prints the packaged version for --version', async () => {
    const result = await runCli(gate, ['--version'], tmp);

    expect(result).toEqual({ code: 0, stdout: `arcanum-cli ${manifest.version}\n`, stderr: '' });
  });

  it('prints a JSON version for --version --json', async () => {
    const result = await runCli(gate, ['--version', '--json'], tmp);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ version: manifest.version });
  });

  it('exits 0 for --help', async () => {
    const result = await runCli(gate, ['--help'], tmp);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage: arcanum <command>');
    expect(result.stderr).toBe('');
  });

  it('exits 2 on an unknown command', async () => {
    const result = await runCli(gate, ['nope'], tmp);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('unknown command');
  });

  it('lists keys from the inlined key registry in config --help', async () => {
    const keys = JSON.parse(await readFile(path.join(REPO_ROOT, 'shared', 'lib', 'config', 'keys.json'), 'utf8'));
    const result = await runCli(gate, ['config', '--help'], tmp);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');

    for (const entry of keys.keys) {
      expect(result.stdout).toContain(entry.key);
    }
  });
});
