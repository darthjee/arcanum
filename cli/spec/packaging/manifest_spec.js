import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { CLI_DIR } from '../support/paths.js';

const execFileAsync = promisify(execFile);
const INSTALL_SCRIPTS = ['preinstall', 'install', 'postinstall'];

describe('cli/package.json', () => {
  let manifest;

  beforeAll(async () => {
    manifest = JSON.parse(await readFile(path.join(CLI_DIR, 'package.json'), 'utf8'));
  });

  it('is the arcanum-cli package', () => {
    expect(manifest.name).toBe('arcanum-cli');
    expect(manifest.type).toBe('module');
    expect(manifest.bin).toEqual({ arcanum: 'bin/arcanum' });
    expect(manifest.files).toEqual(['bin/', 'dist/', 'README.md']);
    expect(manifest.publishConfig).toEqual({ access: 'public', tag: 'latest' });
    expect(manifest.private).toBeUndefined();
  });

  it('has no runtime dependencies', () => {
    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.optionalDependencies).toBeUndefined();
    expect(manifest.peerDependencies).toBeUndefined();
  });

  it('has no install lifecycle scripts', () => {
    for (const script of INSTALL_SCRIPTS) {
      expect(manifest.scripts[script]).withContext(script).toBeUndefined();
    }
  });

  it('pins every devDependency to an exact version', () => {
    for (const [name, version] of Object.entries(manifest.devDependencies)) {
      expect(version).withContext(name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('wires the build, test and lint scripts', () => {
    expect(manifest.scripts).toEqual({
      build: 'node scripts/build.mjs',
      prepack: 'yarn build',
      test: 'c8 jasmine',
      lint: 'eslint .'
    });
  });

  it('packs exactly the bin, the bundle, the README and the manifest', async () => {
    const { stdout } = await execFileAsync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      { cwd: CLI_DIR }
    );
    const files = JSON.parse(stdout)[0].files.map((file) => file.path).sort();

    expect(files).toEqual(['README.md', 'bin/arcanum', 'dist/arcanum.mjs', 'package.json']);
  });
});
