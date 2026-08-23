// Preload module (meant to be loaded via `node --import
// <fileURL>`, before `core/bin/arcanum` itself is imported) that
// monkey-patches the global `fetch` so
// AutoFixAllReplyComment.js#_postComment's `POST
// https://api.github.com/.../comments` call (and, in `wait-ci` mode,
// AutoFixAllWaitCi.js's GET calls) never touches the real network — per
// the repo-wide "no real network calls in specs" rule. Both modules
// default-parameter `fetchFn` to the global `fetch`, read at
// instantiation time (i.e. once `core/bin/arcanum` actually dispatches),
// which happens well after this preload module has already run — so the
// patched global is what ends up injected.
//
// Controlled by `ARCANUM_TEST_FAKE_FETCH`, mirroring the fake `gh`
// binary's (`fakeGhBin.js`) `FAKE_GH_*` env-var-driven control scheme
// so both the shell side (fake `gh pr comment`/`gh pr view`/`gh api`)
// and the native side (this fake `fetch`) can be steered from the same
// parity-spec scenario. Left inert (real `fetch` untouched) when unset.
const mode = process.env.ARCANUM_TEST_FAKE_FETCH;

if (mode === 'success') {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ html_url: 'https://github.com/darthjee/arcanum/pull/1#issuecomment-1' }), {
      status: 201
    });
} else if (mode === 'failure') {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Validation Failed' }), { status: 422 });
} else if (mode === 'wait-ci') {
  // `FAKE_FETCH_PR_NUMBER` (unset/empty -> "no pull request found"),
  // `FAKE_FETCH_HEAD_SHA` (default `fake-head-sha`), and
  // `FAKE_FETCH_CHECK_RUNS_JSON` (a JSON-encoded check-run array,
  // default `[]`) drive AutoFixAllWaitCi.js's three GET calls, mirroring
  // fakeGhBin.js's own `FAKE_GH_PR_NUMBER`/`FAKE_GH_HEAD_SHA`/
  // `FAKE_GH_CHECK_RUNS_JSON` so the same scenario seeds both sides of a
  // parity comparison identically.
  const prNumber = process.env.FAKE_FETCH_PR_NUMBER || '';
  const headSha = process.env.FAKE_FETCH_HEAD_SHA || 'fake-head-sha';
  const checkRuns = process.env.FAKE_FETCH_CHECK_RUNS_JSON || '[]';

  globalThis.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('/pulls?head=')) {
      const body = prNumber ? [{ number: Number(prNumber) }] : [];

      return new Response(JSON.stringify(body), { status: 200 });
    }

    if (typeof url === 'string' && /\/pulls\/\d+$/.test(url)) {
      return new Response(JSON.stringify({ head: { sha: headSha } }), { status: 200 });
    }

    if (typeof url === 'string' && url.includes('/check-runs')) {
      return new Response(JSON.stringify({ check_runs: JSON.parse(checkRuns) }), { status: 200 });
    }

    return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
  };
} else if (mode === 'queue') {
  // Drives `AutoFixAllQueue.js`'s best-effort label mutation (`GET
  // .../issues/<id>`, `POST .../issues/<id>/labels`, `DELETE
  // .../issues/<id>/labels/<label>`), mirroring fakeGhBin.js's own
  // `FAKE_GH_ISSUE_LABELS`/`FAKE_GH_ISSUE_VIEW_FAIL`/
  // `FAKE_GH_ISSUE_EDIT_FAIL` so the same scenario seeds both sides of
  // a parity comparison identically. `FAKE_FETCH_ISSUE_LABELS` is a
  // newline-separated list of the issue's current label names.
  const labels = (process.env.FAKE_FETCH_ISSUE_LABELS || '').split('\n').filter(Boolean);
  const viewFail = process.env.FAKE_FETCH_ISSUE_VIEW_FAIL === '1';
  const editFail = process.env.FAKE_FETCH_ISSUE_EDIT_FAIL === '1';

  globalThis.fetch = async (url, options = {}) => {
    if (options.method === undefined) {
      if (viewFail) {
        return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
      }

      return new Response(JSON.stringify({ labels: labels.map((name) => ({ name })) }), { status: 200 });
    }

    if (options.method === 'POST' || options.method === 'DELETE') {
      return new Response('{}', { status: editFail ? 422 : 200 });
    }

    return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
  };
} else if (mode === 'wait-ci-and-merge') {
  // Drives AutoFixAllWaitCiAndMerge.js (issue #266): the union of
  // `wait-ci` mode's three GET calls (`AutoFixAllWaitCi#run`'s PR
  // lookup, head-sha fetch, and check-runs fetch) plus `github` mode's
  // merge calls (`AutoFixAllGithub#prMerge`'s PR lookup — reusing the
  // same `/pulls?head=` handler, richer than wait-ci's own but a
  // superset of the fields either caller reads — `PUT .../merge`, and
  // `DELETE .../git/refs/heads/<branch>`). `git.merge_body_mode`
  // defaults to `'empty'` (see AutoFixAllGithub.js#mergeBodyMode), so
  // no `/pulls/<number>/commits` or `https://api.github.com/user` call
  // is ever made in this mode — those two `github`-mode-only endpoints
  // are intentionally left unhandled here. Env vars mirror `wait-ci`/
  // `github` modes' own `FAKE_FETCH_*` names.
  const prNumber = process.env.FAKE_FETCH_PR_NUMBER || '';
  const prTitle = process.env.FAKE_FETCH_PR_TITLE || 'Fake PR title';
  const prUrl = process.env.FAKE_FETCH_PR_URL || `https://github.com/example/repo/pull/${prNumber}`;
  const headSha = process.env.FAKE_FETCH_HEAD_SHA || 'fake-head-sha';
  const checkRuns = process.env.FAKE_FETCH_CHECK_RUNS_JSON || '[]';
  const mergeFail = process.env.FAKE_FETCH_MERGE_FAIL === '1';

  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = typeof rawUrl === 'string' ? rawUrl : rawUrl.toString();

    if (url.includes('/pulls?head=')) {
      if (!prNumber) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      return new Response(
        JSON.stringify([{ number: Number(prNumber), title: prTitle, html_url: prUrl }]),
        { status: 200 }
      );
    }

    if (/\/pulls\/\d+$/.test(url)) {
      return new Response(JSON.stringify({ head: { sha: headSha } }), { status: 200 });
    }

    if (url.includes('/check-runs')) {
      return new Response(JSON.stringify({ check_runs: JSON.parse(checkRuns) }), { status: 200 });
    }

    if (options.method === 'PUT' && /\/pulls\/\d+\/merge$/.test(url)) {
      return new Response('{}', { status: mergeFail ? 405 : 200 });
    }

    if (options.method === 'DELETE' && url.includes('/git/refs/heads/')) {
      return new Response('', { status: 204 });
    }

    return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
  };
} else if (mode === 'github') {
  // Drives every REST call `AutoFixAllGithub.js` makes (issue #265):
  // `GET .../pulls?head=...&state=all` (pr-number/pr-state/pr-merge's PR
  // lookup), `GET .../pulls/<number>/commits` (coauthors mode), `GET
  // https://api.github.com/user` (coauthors mode's merger-login lookup),
  // `PUT .../pulls/<number>/merge`, `DELETE .../git/refs/heads/<branch>`
  // (pr-merge's post-merge branch delete), and the same issue-labels GET/
  // POST/DELETE trio `queue` mode above already drives (has-shipit-label/
  // add-tag/remove-tag). Env vars mirror fakeGhBin.js's own `FAKE_GH_*`
  // names (as `FAKE_FETCH_*`) so the same scenario seeds both sides of a
  // parity comparison identically.
  const prNumber = process.env.FAKE_FETCH_PR_NUMBER || '';
  const prTitle = process.env.FAKE_FETCH_PR_TITLE || 'Fake PR title';
  const prUrl = process.env.FAKE_FETCH_PR_URL || `https://github.com/example/repo/pull/${prNumber}`;
  const prState = process.env.FAKE_FETCH_PR_STATE || 'open';
  const prMerged = process.env.FAKE_FETCH_PR_MERGED === '1';
  const prCommitsJson = process.env.FAKE_FETCH_PR_COMMITS_JSON || '[]';
  const userLogin = process.env.FAKE_FETCH_USER_LOGIN || 'fake-merger';
  const userFail = process.env.FAKE_FETCH_USER_FAIL === '1';
  const mergeFail = process.env.FAKE_FETCH_MERGE_FAIL === '1';
  const labels = (process.env.FAKE_FETCH_ISSUE_LABELS || '').split('\n').filter(Boolean);
  const issueViewFail = process.env.FAKE_FETCH_ISSUE_VIEW_FAIL === '1';
  const issueEditFail = process.env.FAKE_FETCH_ISSUE_EDIT_FAIL === '1';

  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = typeof rawUrl === 'string' ? rawUrl : rawUrl.toString();

    if (url.includes('/pulls?head=')) {
      if (!prNumber) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      return new Response(
        JSON.stringify([{
          number: Number(prNumber),
          title: prTitle,
          html_url: prUrl,
          state: prState,
          merged: prMerged,
          merged_at: prMerged ? '2024-01-01T00:00:00Z' : null
        }]),
        { status: 200 }
      );
    }

    if (/\/pulls\/\d+\/commits/.test(url)) {
      return new Response(prCommitsJson, { status: 200 });
    }

    if (options.method === 'PUT' && /\/pulls\/\d+\/merge$/.test(url)) {
      return new Response('{}', { status: mergeFail ? 405 : 200 });
    }

    if (url === 'https://api.github.com/user') {
      if (userFail) {
        return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
      }

      return new Response(JSON.stringify({ login: userLogin }), { status: 200 });
    }

    if (options.method === 'DELETE' && url.includes('/git/refs/heads/')) {
      return new Response('', { status: 204 });
    }

    if (options.method === undefined && /\/issues\/[^/]+$/.test(url)) {
      if (issueViewFail) {
        return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
      }

      return new Response(JSON.stringify({ labels: labels.map((name) => ({ name })) }), { status: 200 });
    }

    if ((options.method === 'POST' || options.method === 'DELETE') && url.includes('/labels')) {
      return new Response('{}', { status: issueEditFail ? 422 : 200 });
    }

    return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
  };
}
