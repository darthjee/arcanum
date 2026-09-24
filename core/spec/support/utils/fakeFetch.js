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

/**
 * Build a fake `fetch` implementation answering `GitHubLabelClient`'s
 * calls: `GET .../labels?per_page=N&page=P` serves `labels`, paginated;
 * `POST .../labels` and `PATCH .../labels/<name>` succeed.
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.labels] - the repo's label names.
 * @param {boolean} [opts.listFails] - whether every list GET fails.
 * @param {boolean} [opts.writeFails] - whether every POST/PATCH fails.
 * @returns {jasmine.Spy} a jasmine spy usable as `fetchFn`.
 */
export function fakeRepoLabelsFetch({ labels = [], listFails = false, writeFails = false } = {}) {
  return jasmine.createSpy('fetch').and.callFake(async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);

    if (options.method === undefined) {
      if (listFails) {
        return { ok: false };
      }

      const perPage = Number(url.searchParams.get('per_page'));
      const page = Number(url.searchParams.get('page'));
      const slice = labels.slice((page - 1) * perPage, page * perPage);

      return { ok: true, json: async () => slice.map((name) => ({ name })) };
    }

    if (options.method === 'POST' || options.method === 'PATCH') {
      return { ok: !writeFails, json: async () => ({}) };
    }

    throw new Error(`unexpected fetch call: ${rawUrl} ${JSON.stringify(options)}`);
  });
}
