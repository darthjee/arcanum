/**
 * Await `promise` and capture a rejection instead of letting it
 * propagate, so specs can assert on the thrown error without a
 * hand-rolled `let thrown; try {...} catch {...}` block.
 * @param {Promise} promise - the promise to await and capture a
 *   rejection from.
 * @returns {Promise<Error|undefined>} the rejection, or `undefined` if
 *   the promise resolved.
 */
export async function captureRejection(promise) {
  try {
    await promise;

    return undefined;
  } catch (error) {
    return error;
  }
}
