import { Readable } from 'node:stream';
import LineReader from '../../../../lib/utils/io/LineReader.js';

describe('LineReader', () => {
  /**
   * @param {Array<string|Buffer>} chunks - the stream's chunks.
   * @returns {LineReader} a reader over them.
   */
  function readerFor(chunks) {
    return new LineReader({ stream: Readable.from(chunks) });
  }

  it('returns newline-terminated lines, untrimmed, across chunk boundaries', async () => {
    const reader = readerFor(['  a', 'b \r\nc', '\n']);

    expect(await reader.readLine()).toEqual('  ab \r');
    expect(await reader.readLine()).toEqual('c');
    expect(await reader.readLine()).toBeNull();
  });

  it('treats a final unterminated chunk as EOF', async () => {
    const reader = readerFor(['y\n', 'yes']);

    expect(await reader.readLine()).toEqual('y');
    expect(await reader.readLine()).toBeNull();
  });

  it('returns null at once for an empty stream', async () => {
    expect(await readerFor([]).readLine()).toBeNull();
  });

  it('decodes multi-byte characters split across Buffer chunks', async () => {
    const bytes = Buffer.from('é\n');
    const reader = readerFor([bytes.subarray(0, 1), bytes.subarray(1)]);

    expect(await reader.readLine()).toEqual('é');
  });

  it('stops reading after close', async () => {
    const reader = readerFor(['a\n', 'b\n']);

    expect(await reader.readLine()).toEqual('a');
    await reader.close();
    await reader.close();

    expect(await reader.readLine()).toBeNull();
  });

  it('closes cleanly before any read', async () => {
    const reader = readerFor(['a\n']);

    await expectAsync(reader.close()).toBeResolved();
  });
});
