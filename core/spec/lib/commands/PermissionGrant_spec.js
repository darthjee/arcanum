import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Lock from '../../../lib/utils/file/Lock.js';
import PermissionGrant from '../../../lib/commands/PermissionGrant.js';
import ClaudeContext from '../../../lib/context/ClaudeContext.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

describe('PermissionGrant', () => {
  let dir;
  let file;
  let claudeContext;

  beforeEach(async () => {
    dir = await createTempDir();
    file = path.join(dir, '.claude', 'settings.json');
    claudeContext = new ClaudeContext({ repoPath: dir });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#run', () => {
    describe('an unrecognized or missing action', () => {
      it('rejects with the usage message for an unrecognized action', async () => {
        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await expectAsync(permissionGrant.run('remove', file, 'Bash(git push:*)')).toBeRejectedWithError(
          'Usage: permission_grant.sh add <file> <pattern>'
        );
      });

      it('rejects with the usage message for a missing action', async () => {
        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await expectAsync(permissionGrant.run(undefined, file, 'Bash(git push:*)')).toBeRejectedWithError(
          'Usage: permission_grant.sh add <file> <pattern>'
        );
      });
    });

    describe('the "add" action', () => {
      it('creates the file (starting from {}) when it does not exist yet', async () => {
        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await permissionGrant.run('add', file, 'Bash(git push:*)');

        const written = JSON.parse(await readFile(file, 'utf8'));

        expect(written).toEqual({ permissions: { allow: ['Bash(git push:*)'] } });
      });

      it('resolves a repo-relative file against the context anchor, not process.cwd()', async () => {
        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await permissionGrant.run('add', '.claude/settings.json', 'Bash(git push:*)');

        const written = JSON.parse(await readFile(file, 'utf8'));

        expect(written).toEqual({ permissions: { allow: ['Bash(git push:*)'] } });
      });

      it('leaves every other top-level key (and other permissions.* keys) untouched', async () => {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(
          file,
          JSON.stringify({
            hooks: { PreToolUse: [] },
            permissions: { deny: ['Bash(rm -rf /:*)'], allow: ['Bash(git status:*)'] }
          })
        );

        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await permissionGrant.run('add', file, 'Bash(git push:*)');

        const written = JSON.parse(await readFile(file, 'utf8'));

        expect(written).toEqual({
          hooks: { PreToolUse: [] },
          permissions: {
            deny: ['Bash(rm -rf /:*)'],
            allow: ['Bash(git push:*)', 'Bash(git status:*)']
          }
        });
      });

      it('dedupes when the pattern is already present', async () => {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify({ permissions: { allow: ['Bash(git push:*)'] } }));

        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await permissionGrant.run('add', file, 'Bash(git push:*)');

        const written = JSON.parse(await readFile(file, 'utf8'));

        expect(written).toEqual({ permissions: { allow: ['Bash(git push:*)'] } });
      });

      it('treats missing/invalid JSON in an existing file as {}', async () => {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, 'not json');

        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await permissionGrant.run('add', file, 'Bash(git push:*)');

        const written = JSON.parse(await readFile(file, 'utf8'));

        expect(written).toEqual({ permissions: { allow: ['Bash(git push:*)'] } });
      });

      it('treats an existing but empty file as {}', async () => {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, '');

        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await permissionGrant.run('add', file, 'Bash(git push:*)');

        const written = JSON.parse(await readFile(file, 'utf8'));

        expect(written).toEqual({ permissions: { allow: ['Bash(git push:*)'] } });
      });

      it('degrades silently (stderr warning, no throw) when the parent directory cannot be created', async () => {
        const blocker = path.join(dir, 'blocker');

        await writeFile(blocker, 'i am a file, not a directory');

        const blockedFile = path.join(blocker, 'nested', 'settings.json');
        const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        spyOn(process.stderr, 'write');

        await permissionGrant.run('add', blockedFile, 'Bash(git push:*)');

        expect(process.stderr.write).toHaveBeenCalledWith(
          `Warning: could not create the parent directory for ${blockedFile} — permission pattern 'Bash(git push:*)' was not written.\n`
        );
      });

      it('acquires and releases the lock file around the write', async () => {
        const lock = new Lock({ sleepMs: 5 });

        spyOn(lock, 'acquire').and.callThrough();
        spyOn(lock, 'release').and.callThrough();

        const permissionGrant = new PermissionGrant(claudeContext, { lock });

        await permissionGrant.run('add', file, 'Bash(git push:*)');

        expect(lock.acquire).toHaveBeenCalledWith(`${file}.lock`);
        expect(lock.release).toHaveBeenCalledWith(`${file}.lock`);
      });

      it('does not corrupt the file under two near-simultaneous writes', async () => {
        const permissionGrantA = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });
        const permissionGrantB = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

        await Promise.all([
          permissionGrantA.run('add', file, 'Bash(git push:*)'),
          permissionGrantB.run('add', file, 'Bash(git status:*)')
        ]);

        const written = JSON.parse(await readFile(file, 'utf8'));

        expect(written.permissions.allow).toContain('Bash(git push:*)');
        expect(written.permissions.allow.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
