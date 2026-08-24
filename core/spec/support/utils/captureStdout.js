/**
 * Some entrypoint methods (e.g. `AutoFixAllQueue#save`/`#push`) write
 * directly to `process.stdout` rather than returning a string — capture
 * everything written to `process.stdout` for the duration of `fn`, so
 * specs can assert on it the same way parity specs assert on a
 * subprocess's captured stdout.
 * @param {Function} fn - a zero-argument function (sync or async) to
 *   run while `process.stdout.write` is captured.
 * @returns {Promise<{result: *, stdout: string}>} `fn`'s own resolved
 *   value, plus everything written to `process.stdout` meanwhile.
 */
export async function captureStdout(fn) {
  const chunks = [];
  const spy = spyOn(process.stdout, 'write').and.callFake((chunk) => {
    chunks.push(chunk);

    return true;
  });

  const result = await fn();

  spy.and.callThrough();

  return { result, stdout: chunks.join('') };
}
