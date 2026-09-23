const DEFAULT_TIMEOUT_MS = 30000;
const API_URL = 'https://api.github.com';
const GRAPHQL_URL = 'https://api.github.com/graphql';

/**
 * The single home for GitHub connection mechanics shared by
 * `GitHubClient` and `IssueClient`: API base URL, repo/token resolution,
 * auth and JSON content-type headers, timeout signal, and REST/GraphQL
 * request issuing. Every non-best-effort helper maps a rejected fetch
 * (network error, timeout), a non-ok response, and unparseable JSON to
 * the caller-supplied `failure()` error, so domain methods only state
 * their endpoint, payload, shape validation, and error message.
 *
 * The repo-scoped helpers (`repoRequest`, `repoRequestJson`,
 * `repoRequestArray`) additionally resolve the repo identity and build
 * the path and failure message from it. Use them when the only
 * repo-dependent parts of a method are its path and failure message;
 * methods with post-response validation keep calling `repo()` once plus
 * the base request methods.
 */
class GitHubTransport {
  /**
   * @param {object} deps - the transport's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context, for `repo`/`repoRef`/`token`
   *   resolution.
   * @param {typeof fetch} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - each request's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   */
  constructor({ context, fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this._context = context;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
  }

  /**
   * Resolve the bound repo's identity.
   * @returns {Promise<object>} `{ repo, repoRef, ... }` from
   *   `context.resolveWithRef()`.
   */
  async repo() {
    return this._context.resolveWithRef();
  }

  /**
   * Issue a REST request against the GitHub API.
   * @param {string} path - the path under the API base URL (e.g.
   *   `/repos/<owner>/<name>/pulls`).
   * @param {object} opts - request options.
   * @param {string} [opts.method] - the HTTP method (`GET` by default,
   *   omitted from the fetch init when it is the default).
   * @param {object} [opts.body] - a JSON payload; when given, it is
   *   serialized and `Content-Type: application/json` is added.
   * @param {() => Error} opts.failure - builds the error to throw.
   * @returns {Promise<object>} the ok response.
   * @throws {Error} whatever `failure()` builds, on a rejected fetch or
   *   a non-ok response.
   */
  async request(path, { method = 'GET', body, failure }) {
    const init = method === 'GET' ? {} : { method };

    return this._send(`${API_URL}${path}`, init, body, failure);
  }

  /**
   * `request`, then parse the response body as JSON.
   * @param {string} path - the path under the API base URL.
   * @param {object} opts - same as `request`'s.
   * @returns {Promise<unknown>} the parsed JSON body.
   * @throws {Error} whatever `opts.failure()` builds, on any `request`
   *   failure or unparseable JSON.
   */
  async requestJson(path, opts) {
    const response = await this.request(path, opts);

    return this._parse(response, opts.failure);
  }

  /**
   * `requestJson`, normalizing a non-array body to `[]`.
   * @param {string} path - the path under the API base URL.
   * @param {object} opts - same as `request`'s.
   * @returns {Promise<Array>} the parsed array, or `[]` when malformed.
   * @throws {Error} whatever `opts.failure()` builds, on any
   *   `requestJson` failure.
   */
  async requestArray(path, opts) {
    const body = await this.requestJson(path, opts);

    return Array.isArray(body) ? body : [];
  }

  /**
   * Resolve the repo identity, then `request` the path built from it.
   * Repo-resolution failures propagate unmapped.
   * @param {(ids: object) => string} pathFn - builds the path under the
   *   API base URL from the resolved identity (`{ repo, repoRef, ... }`).
   * @param {object} opts - request options.
   * @param {string} [opts.method] - the HTTP method (`GET` by default).
   * @param {object} [opts.body] - a JSON payload, if any.
   * @param {(ids: object) => string} opts.message - builds the failure
   *   message from the resolved identity; only invoked on failure.
   * @returns {Promise<object>} the ok response.
   * @throws {Error} with `message(ids)`, on any `request` failure.
   */
  async repoRequest(pathFn, opts) {
    return this._repoScoped(pathFn, opts, (path, requestOpts) => this.request(path, requestOpts));
  }

  /**
   * `repoRequest`, then parse the response body as JSON.
   * @param {(ids: object) => string} pathFn - same as `repoRequest`'s.
   * @param {object} opts - same as `repoRequest`'s.
   * @returns {Promise<unknown>} the parsed JSON body.
   * @throws {Error} with `opts.message(ids)`, on any `requestJson`
   *   failure.
   */
  async repoRequestJson(pathFn, opts) {
    return this._repoScoped(pathFn, opts, (path, requestOpts) => this.requestJson(path, requestOpts));
  }

  /**
   * `repoRequestJson`, normalizing a non-array body to `[]`.
   * @param {(ids: object) => string} pathFn - same as `repoRequest`'s.
   * @param {object} opts - same as `repoRequest`'s.
   * @returns {Promise<Array>} the parsed array, or `[]` when malformed.
   * @throws {Error} with `opts.message(ids)`, on any `requestArray`
   *   failure.
   */
  async repoRequestArray(pathFn, opts) {
    return this._repoScoped(pathFn, opts, (path, requestOpts) => this.requestArray(path, requestOpts));
  }

  /**
   * POST a GraphQL query to the GitHub GraphQL endpoint.
   * @param {string} query - the GraphQL query/mutation document.
   * @param {object} variables - the query variables.
   * @param {object} opts - request options.
   * @param {() => Error} opts.failure - builds the error to throw.
   * @returns {Promise<object>} the parsed GraphQL payload.
   * @throws {Error} whatever `failure()` builds, on a rejected fetch, a
   *   non-ok response, unparseable JSON, or a non-empty `errors` array.
   */
  async graphql(query, variables, { failure }) {
    const response = await this._send(GRAPHQL_URL, { method: 'POST' }, { query, variables }, failure);
    const payload = await this._parse(response, failure);

    if (payload && Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw failure();
    }

    return payload;
  }

  /**
   * Run `fn` and swallow any failure, including repo/token resolution
   * errors — for best-effort calls that must never throw.
   * @param {() => Promise<unknown>} fn - the async operation to run.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async bestEffort(fn) {
    try {
      await fn();
    } catch {
      // best-effort — tolerate any failure.
    }
  }

  /**
   * Resolve the repo identity (unmapped on rejection), then run `send`
   * with the built path and a lazy `failure` built from `message`.
   * @param {(ids: object) => string} pathFn - builds the request path.
   * @param {object} opts - request options.
   * @param {string} [opts.method] - the HTTP method.
   * @param {object} [opts.body] - a JSON payload, if any.
   * @param {(ids: object) => string} opts.message - builds the failure
   *   message from the resolved identity.
   * @param {(path: string, opts: object) => Promise<unknown>} send - the
   *   base request method to delegate to.
   * @returns {Promise<unknown>} whatever `send` resolves to.
   */
  async _repoScoped(pathFn, { method, body, message }, send) {
    const ids = await this.repo();
    const failure = () => new Error(message(ids));

    return send(pathFn(ids), { method, body, failure });
  }

  /**
   * Resolve the token, attach headers/body/timeout signal to `init`,
   * and fetch `url`.
   * @param {string} url - the absolute request URL.
   * @param {object} init - the base fetch init (e.g. `{ method }`).
   * @param {object} [body] - a JSON payload, if any.
   * @param {() => Error} failure - builds the error to throw.
   * @returns {Promise<object>} the ok response.
   * @throws {Error} whatever `failure()` builds, on a rejected fetch or
   *   a non-ok response.
   */
  async _send(url, init, body, failure) {
    const token = await this._context.getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const options = { ...init, headers };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    options.signal = AbortSignal.timeout(this._timeoutMs);

    let response;

    try {
      response = await this._fetch(url, options);
    } catch {
      throw failure();
    }

    if (!response.ok) {
      throw failure();
    }

    return response;
  }

  /**
   * Parse `response`'s body as JSON.
   * @param {object} response - the fetch response.
   * @param {() => Error} failure - builds the error to throw.
   * @returns {Promise<unknown>} the parsed JSON body.
   * @throws {Error} whatever `failure()` builds, on unparseable JSON.
   */
  async _parse(response, failure) {
    try {
      return await response.json();
    } catch {
      throw failure();
    }
  }
}

export default GitHubTransport;
