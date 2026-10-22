import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ALLOWED_INPUT_DIRS, buildBundle, checkInputs, compareSemver, migrationVersions, nodeTarget
} from '../../scripts/build.mjs';
import { CLI_DIR, REPO_ROOT } from '../support/paths.js';

describe('scripts/build.mjs', () => {
  let tmp;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'arcanum-cli-build-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  /**
   * Writes `<tmp>/<version>/migrations.json` with the given content.
   * @param {string} version - the version directory name.
   * @param {unknown} content - raw text, or a value to serialize as JSON.
   */
  async function writeMigrations(version, content) {
    await mkdir(path.join(tmp, version), { recursive: true });
    await writeFile(
      path.join(tmp, version, 'migrations.json'),
      typeof content === 'string' ? content : JSON.stringify(content)
    );
  }

  describe('compareSemver', () => {
    it('compares numerically, not as strings', () => {
      expect(compareSemver('0.9.3', '0.13.0')).toBeLessThan(0);
      expect(compareSemver('1.0.0', '0.99.99')).toBeGreaterThan(0);
      expect(compareSemver('2.1.0', '2.1.0')).toBe(0);
    });
  });

  describe('nodeTarget', () => {
    it('derives the esbuild target from the engines floor', () => {
      expect(nodeTarget('>=22.13.0')).toBe('node22.13');
      expect(nodeTarget('>=22.13.1')).toBe('node22.13.1');
    });

    it('rejects anything but a plain >= floor', () => {
      expect(() => nodeTarget('^22.13.0')).toThrowError(/engines\.node/);
      expect(() => nodeTarget(undefined)).toThrowError(/engines\.node/);
    });
  });

  describe('migrationVersions', () => {
    it('lists each version under the scopes its entries apply to', async () => {
      await writeMigrations('0.13.0', [{ applies_to: 'local' }, { applies_to: 'repo' }]);
      await writeMigrations('0.15.0', [{ applies_to: 'global' }, { applies_to: 'global' }]);

      expect(await migrationVersions(tmp, '1.0.0')).toEqual({
        repo: ['0.13.0'],
        local: ['0.13.0'],
        global: ['0.15.0']
      });
    });

    it('skips next/ and non-semver directories', async () => {
      await writeMigrations('next', [{ applies_to: 'repo' }]);
      await writeMigrations('1.0', [{ applies_to: 'repo' }]);
      await writeMigrations('v1.0.0', [{ applies_to: 'repo' }]);
      await writeMigrations('0.14.0', [{ applies_to: 'repo' }]);
      await writeFile(path.join(tmp, '0.16.0'), 'a file, not a directory');

      expect(await migrationVersions(tmp, '1.0.0')).toEqual({ repo: ['0.14.0'], local: [], global: [] });
    });

    it('skips version directories without a migrations.json', async () => {
      await mkdir(path.join(tmp, '0.12.0'));
      await writeMigrations('0.13.0', [{ applies_to: 'repo' }]);

      expect((await migrationVersions(tmp, '1.0.0')).repo).toEqual(['0.13.0']);
    });

    it('sorts by semver', async () => {
      await writeMigrations('0.13.0', [{ applies_to: 'repo' }]);
      await writeMigrations('0.9.3', [{ applies_to: 'repo' }]);
      await writeMigrations('0.10.0', [{ applies_to: 'repo' }]);

      expect((await migrationVersions(tmp, '1.0.0')).repo).toEqual(['0.9.3', '0.10.0', '0.13.0']);
    });

    it('drops versions above the CLI version and keeps the CLI version itself', async () => {
      await writeMigrations('2.1.0', [{ applies_to: 'repo' }]);
      await writeMigrations('2.2.0', [{ applies_to: 'repo' }]);
      await writeMigrations('10.0.0', [{ applies_to: 'repo' }]);

      expect((await migrationVersions(tmp, '2.1.0')).repo).toEqual(['2.1.0']);
    });

    it('throws on a file that is not a JSON array', async () => {
      await writeMigrations('0.13.0', { applies_to: 'repo' });

      await expectAsync(migrationVersions(tmp, '1.0.0')).toBeRejectedWithError(/expected a JSON array/);
    });

    it('throws on invalid JSON', async () => {
      await writeMigrations('0.13.0', '[{');

      await expectAsync(migrationVersions(tmp, '1.0.0')).toBeRejectedWithError(/invalid JSON/);
    });

    it('throws on a missing applies_to', async () => {
      await writeMigrations('0.13.0', [{ id: '001' }]);

      await expectAsync(migrationVersions(tmp, '1.0.0')).toBeRejectedWithError(/entry 0 .*applies_to/);
    });

    it('throws on an invalid applies_to', async () => {
      await writeMigrations('0.13.0', [{ applies_to: 'repo' }, { applies_to: 'everywhere' }]);

      await expectAsync(migrationVersions(tmp, '1.0.0')).toBeRejectedWithError(/entry 1 .*"everywhere"/);
    });

    it('throws on a non-object entry', async () => {
      await writeMigrations('0.13.0', ['repo']);

      await expectAsync(migrationVersions(tmp, '1.0.0')).toBeRejectedWithError(/applies_to/);
    });

    it('validates files above the CLI version too', async () => {
      await writeMigrations('9.0.0', [{ applies_to: 'nowhere' }]);

      await expectAsync(migrationVersions(tmp, '1.0.0')).toBeRejectedWithError(/applies_to/);
    });

    it('propagates read errors other than a missing file', async () => {
      await mkdir(path.join(tmp, '0.13.0', 'migrations.json'), { recursive: true });

      await expectAsync(migrationVersions(tmp, '1.0.0')).toBeRejected();
    });

    it('succeeds on the real arcanum/migrations/repos', async () => {
      const manifest = JSON.parse(await readFile(path.join(CLI_DIR, 'package.json'), 'utf8'));
      const versions = await migrationVersions(path.join(REPO_ROOT, 'arcanum', 'migrations', 'repos'), manifest.version);

      expect(Object.keys(versions)).toEqual(['repo', 'local', 'global']);
      expect(versions.repo).toContain('0.13.0');
      expect(versions.global).toContain('0.15.0');
    });
  });

  describe('checkInputs', () => {
    const dirs = { workingDir: CLI_DIR, repoRoot: REPO_ROOT };

    it('allows cli/lib/ and core/lib/shared/ by default', () => {
      expect(ALLOWED_INPUT_DIRS).toEqual(['cli/lib/', 'core/lib/shared/']);
    });

    it('accepts cli/lib inputs, core/lib/shared inputs and define inputs', () => {
      const metafile = {
        inputs: {
          'lib/main.js': {},
          'lib/commands/config.js': {},
          '../core/lib/shared/config/KeyRegistry.js': {},
          '../core/lib/shared/config/keys.json': {},
          '../core/lib/shared/file/Lock.js': {},
          '<define:__ARCANUM_MIGRATION_VERSIONS__>': {}
        }
      };

      expect(checkInputs(metafile, dirs)).toEqual([
        'cli/lib/commands/config.js',
        'cli/lib/main.js',
        'core/lib/shared/config/KeyRegistry.js',
        'core/lib/shared/config/keys.json',
        'core/lib/shared/file/Lock.js'
      ]);
    });

    it('rejects an input outside cli/lib and core/lib/shared', () => {
      const metafile = {
        inputs: {
          'lib/main.js': {},
          '../core/lib/context/RepoContext.js': {},
          'scripts/build.mjs': {}
        }
      };

      expect(() => checkInputs(metafile, dirs)).toThrowError(
        'bundled inputs outside cli/lib/** and core/lib/shared/**: ' +
        'cli/scripts/build.mjs, core/lib/context/RepoContext.js'
      );
    });

    it('rejects an input at an old core/lib/utils surface path', () => {
      const metafile = { inputs: { '../core/lib/utils/config/ConfigChain.js': {} } };

      expect(() => checkInputs(metafile, dirs)).toThrowError(/core\/lib\/utils\/config\/ConfigChain\.js/);
    });

    it('rejects an input that only shares the folder name prefix', () => {
      const metafile = { inputs: { '../core/lib/shared-other/X.js': {} } };

      expect(() => checkInputs(metafile, dirs)).toThrowError(/core\/lib\/shared-other\/X\.js/);
    });

    it('takes the allowed folders as an option', () => {
      const metafile = { inputs: { 'lib/main.js': {}, '../core/lib/shared/config/ConfigChain.js': {} } };

      expect(() => checkInputs(metafile, { ...dirs, allowedDirs: ['cli/lib/'] }))
        .toThrowError(/outside cli\/lib\/\*\*: core\/lib\/shared\/config\/ConfigChain\.js/);
    });

    it('defaults to cli/ as the working directory', () => {
      expect(checkInputs({ inputs: { 'lib/main.js': {} } })).toEqual(['cli/lib/main.js']);
    });
  });

  describe('buildBundle', () => {
    it('writes a bundle carrying the version, the registry and the migration list', async () => {
      const outfile = path.join(tmp, 'dist', 'arcanum.mjs');
      const result = await buildBundle({ outfile });
      const bundle = await readFile(outfile, 'utf8');
      const manifest = JSON.parse(await readFile(path.join(CLI_DIR, 'package.json'), 'utf8'));

      expect(result.outfile).toBe(outfile);
      expect(result.version).toBe(manifest.version);
      expect(result.inputs).toContain('cli/lib/main.js');
      expect(result.inputs).toContain('core/lib/shared/config/keys.json');
      expect(bundle).toContain(`"${manifest.version}"`);
      expect(bundle).toContain('"engine.mode"');
      expect(bundle).toContain('"0.13.0"');
      expect(bundle).not.toContain('__ARCANUM_CLI_VERSION__ ===');
    });
  });
});
