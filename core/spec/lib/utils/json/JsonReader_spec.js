import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JsonReader from '../../../../lib/utils/json/JsonReader.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('JsonReader', () => {
  let dir;
  let file;

  beforeEach(async () => {
    dir = await createTempDir();
    file = path.join(dir, 'state.json');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#read', () => {
    it('resolves to {} when the file does not exist', async () => {
      const reader = new JsonReader();

      await expectAsync(reader.read(file)).toBeResolvedTo({});
    });

    it('resolves to {} when the file is empty', async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, '');

      const reader = new JsonReader();

      await expectAsync(reader.read(file)).toBeResolvedTo({});
    });

    it('resolves to {} when the file contains only whitespace', async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, '   \n');

      const reader = new JsonReader();

      await expectAsync(reader.read(file)).toBeResolvedTo({});
    });

    it('resolves to {} when the file contains invalid JSON', async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, 'not json');

      const reader = new JsonReader();

      await expectAsync(reader.read(file)).toBeResolvedTo({});
    });

    it('resolves to the parsed content for a valid JSON file', async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ title: 'A Title' }));

      const reader = new JsonReader();

      await expectAsync(reader.read(file)).toBeResolvedTo({ title: 'A Title' });
    });
  });
});
