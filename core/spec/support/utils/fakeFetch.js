/**
 * Build a fake `fetch` implementation answering the 3 REST calls
 * `IssueTagger`'s label mutation makes per tag: `GET .../issues/<id>`
 * (current labels), `POST .../issues/<id>/labels` (add), `DELETE
 * .../issues/<id>/labels/<label>` (remove).
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.existingLabels] - the labels every issue
 *   fetch reports as already present.
 * @param {boolean} [opts.getFails] - whether the labels GET fails.
 * @param {boolean} [opts.mutateFails] - whether every POST/DELETE fails.
 * @returns {Function} a jasmine spy usable as `fetchFn`.
 */
export function fakeFetch({ existingLabels = ['Ready for Work', 'Created'], getFails = false, mutateFails = false } = {}) {
  return jasmine.createSpy('fetch').and.callFake(async (url, options = {}) => {
    if (options.method === undefined) {
      if (getFails) {
        return { ok: false };
      }

      return { ok: true, json: async () => ({ labels: existingLabels.map((name) => ({ name })) }) };
    }

    if (options.method === 'POST' || options.method === 'DELETE') {
      return { ok: !mutateFails };
    }

    throw new Error(`unexpected fetch call: ${url} ${JSON.stringify(options)}`);
  });
}
