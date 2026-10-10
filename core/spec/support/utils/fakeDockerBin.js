import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NATIVE_BIN } from './runCommand.js';
import { createTempDir, removeTempDir } from './tempDir.js';

// A `docker` CLI stand-in for the docker-engine routing specs (see
// docs/agents/specs/docker/testing.md -> "Fake `docker`"), built like
// `fakeGhBin.js`: an executable `docker` written into a fresh temp dir
// the spec puts first on `PATH`. Its behavior is baked into the script
// at build time (never read from env), so it survives whatever env the
// dispatch path hands it. No real daemon or network is ever touched.
//
// Every invocation appends one JSON line `{"argv": [...], "env": {...}}`
// to `<binDir>/calls.log`: `argv` is the full argv after `docker`, `env`
// maps every `-e NAME` it saw to that name's value in the fake's own
// environment (`null` when unset), so a spec can check a value arrived
// without it ever being in argv. `readCalls()` parses the log back.
//
// Modes:
//   - `scripted`: each subcommand (`inspect` for `image inspect`, `pull`,
//     `build`, `run`) answers with its configured `{ code, stdout,
//     stderr }` (default: exit 0, no output). `DOCKER_PRESETS` holds the
//     common `image inspect` answers (daemon down, image missing).
//   - `passthrough`: image acquisition succeeds; `run` validates the argv
//     shape, then runs the repo's real `core/bin/arcanum` with the args
//     after the image reference, in the `-w` directory, with an env built
//     only from the `-e` names (plus the host `PATH` and a throwaway
//     `HOME`, standing in for the image's own `PATH` and synthetic
//     `HOME`), and exits with its code (128+n for a signal). Shape
//     violations print `fake docker: invalid run argv: <reason>` on
//     stderr and exit 99 (outside 125-127, so dispatch never falls back
//     on them).

/** Exit code the passthrough fake uses for a malformed `docker run` argv. */
export const INVALID_RUN_ARGV_CODE = 99;

/** Common scripted `image inspect` answers. */
export const DOCKER_PRESETS = {
  daemonDown: {
    code: 1,
    stdout: '',
    stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?\n'
  },
  imageMissing: { code: 1, stdout: '', stderr: 'Error response from daemon: No such image\n' }
};

/**
 * The fake's body: plain node, with its config inlined as JSON.
 * @param {object} config - the baked-in configuration.
 * @returns {string} the script content.
 */
function buildDockerScript(config) {
  return `#!${process.execPath}
const { appendFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { constants } = require('node:os');

const config = ${JSON.stringify(config)};
const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--label', '--user', '--tmpfs', '--cap-drop', '--security-opt', '-w', '-v', '-e']);
const BARE_FLAGS = new Set(['--rm', '-i', '--init', '--read-only']);

// Parses \`run\`'s options up to the image reference.
function parseRun() {
  const opts = argv.slice(1);
  const parsed = { opts, names: [], workdir: null, imageIndex: -1, error: null };
  for (let i = 0; i < opts.length; i++) {
    const token = opts[i];
    if (BARE_FLAGS.has(token)) continue;
    if (VALUE_FLAGS.has(token)) {
      const value = opts[i + 1];
      if (value === undefined) return { ...parsed, error: token + ' has no value' };
      if (token === '-w') parsed.workdir = value;
      if (token === '-e') {
        if (value.includes('=')) return { ...parsed, error: '-e ' + value + ' carries a value' };
        parsed.names.push(value);
      }
      i++;
      continue;
    }
    if (token.startsWith('-')) return { ...parsed, error: 'unexpected flag ' + token };
    parsed.imageIndex = i;
    break;
  }
  return parsed;
}

const run = argv[0] === 'run' ? parseRun() : { names: [] };
const env = {};
run.names.forEach((name) => { env[name] = process.env[name] ?? null; });
appendFileSync(config.logFile, JSON.stringify({ argv, env }) + '\\n');

function answer(reply) {
  const { code = 0, stdout = '', stderr = '' } = reply || {};
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = code;
}

function subcommand() {
  if (argv[0] === 'image' && argv[1] === 'inspect') return 'inspect';
  return argv[0];
}

function invalid(reason) {
  process.stderr.write('fake docker: invalid run argv: ' + reason + '\\n');
  process.exitCode = ${INVALID_RUN_ARGV_CODE};
}

function passthroughRun() {
  if (run.error) return invalid(run.error);
  if (run.imageIndex < 0) return invalid('no image reference');
  const flags = run.opts.slice(0, run.imageIndex);
  if (!flags.includes('--rm') || !flags.includes('-i')) return invalid('missing --rm or -i');
  if (run.workdir === null) return invalid('missing -w');
  const childEnv = { PATH: process.env.PATH, HOME: config.homeDir };
  run.names.forEach((name) => {
    if (process.env[name] !== undefined) childEnv[name] = process.env[name];
  });
  const result = spawnSync(process.execPath, [config.nativeBin, ...run.opts.slice(run.imageIndex + 1)], {
    cwd: run.workdir,
    env: childEnv,
    stdio: 'inherit'
  });
  if (result.signal) {
    process.exitCode = 128 + constants.signals[result.signal];
  } else {
    process.exitCode = result.status ?? 1;
  }
}

const name = subcommand();
if (config.mode === 'passthrough' && name === 'run') {
  passthroughRun();
} else if (['inspect', 'pull', 'build', 'run'].includes(name)) {
  answer(config.replies[name]);
} else {
  answer({ code: 1, stderr: 'fake docker: unsupported subcommand ' + argv.join(' ') + '\\n' });
}
`;
}

/**
 * Build a fake `docker` binary in a fresh temp dir.
 * @param {object} [opts] - options, baked into the script.
 * @param {'scripted'|'passthrough'} [opts.mode] - see this file's header.
 * @param {object} [opts.inspect] - `{ code, stdout, stderr }` for `image inspect`.
 * @param {object} [opts.pull] - `{ code, stdout, stderr }` for `pull`.
 * @param {object} [opts.build] - `{ code, stdout, stderr }` for `build`.
 * @param {object} [opts.run] - `{ code, stdout, stderr }` for `run`
 *   (scripted mode only).
 * @returns {Promise<{binDir: string, readCalls: () => Promise<object[]>, cleanup: () => Promise<void>}>}
 *   the fake's directory (put it first on `PATH`), a reader returning the
 *   logged `{ argv, env }` calls in order, and a cleanup callback.
 */
export async function createFakeDockerBin({ mode = 'scripted', inspect, pull, build, run } = {}) {
  const binDir = await createTempDir('arcanum-core-fake-docker-');
  const logFile = path.join(binDir, 'calls.log');
  const homeDir = path.join(binDir, 'home');
  const dockerPath = path.join(binDir, 'docker');
  const config = { mode, logFile, homeDir, nativeBin: NATIVE_BIN, replies: { inspect, pull, build, run } };

  await mkdir(homeDir);
  await writeFile(logFile, '');
  await writeFile(dockerPath, buildDockerScript(config));
  await chmod(dockerPath, 0o755);

  return {
    binDir,
    readCalls: async () => (await readFile(logFile, 'utf8'))
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line)),
    cleanup: () => removeTempDir(binDir)
  };
}
