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
} else if (mode === 'auto-fix-issue-github') {
  // Drives every REST/GraphQL call `AutoFixIssueGithub.js` makes (issue
  // #430): `GET /repos/{repo}` (`GitHubClient#createPr`'s own
  // default-branch lookup), `POST /repos/{repo}/pulls` (`createPr`
  // itself), `GET /repos/{repo}/pulls?head=...&state=all` (`getPr`, used
  // by `pr-view`/`pr-ready`), and `POST https://api.github.com/graphql`
  // (`markPrReady`). Env vars mirror `fakeGhBin.js`'s own `FAKE_GH_*`
  // names (as `FAKE_FETCH_*`) so the same scenario seeds both sides of a
  // parity comparison identically.
  const defaultBranch = process.env.FAKE_FETCH_DEFAULT_BRANCH || 'main';
  const prCreateFail = process.env.FAKE_FETCH_PR_CREATE_FAIL === '1';
  const prCreateUrl = process.env.FAKE_FETCH_PR_CREATE_URL || 'https://github.com/example/repo/pull/99';
  const prNumber = process.env.FAKE_FETCH_PR_NUMBER || '';
  const prUrl = process.env.FAKE_FETCH_PR_URL || `https://github.com/example/repo/pull/${prNumber}`;
  const prNodeId = process.env.FAKE_FETCH_PR_NODE_ID || 'PR_fakeNodeId';
  const prDraft = process.env.FAKE_FETCH_PR_DRAFT === '1';
  const markReadyFail = process.env.FAKE_FETCH_MARK_READY_FAIL === '1';

  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = typeof rawUrl === 'string' ? rawUrl : rawUrl.toString();

    if (options.method === 'POST' && /\/pulls$/.test(url)) {
      if (prCreateFail) {
        return new Response(JSON.stringify({ message: 'Validation Failed' }), { status: 422 });
      }

      return new Response(JSON.stringify({ html_url: prCreateUrl }), { status: 201 });
    }

    if (url.includes('/pulls?head=')) {
      if (!prNumber) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      return new Response(
        JSON.stringify([{ number: Number(prNumber), html_url: prUrl, draft: prDraft, node_id: prNodeId }]),
        { status: 200 }
      );
    }

    if (options.method === 'POST' && url === 'https://api.github.com/graphql') {
      if (markReadyFail) {
        return new Response(JSON.stringify({ errors: [{ message: 'not found' }] }), { status: 200 });
      }

      return new Response(
        JSON.stringify({ data: { markPullRequestReadyForReview: { pullRequest: { id: prNodeId } } } }),
        { status: 200 }
      );
    }

    if (options.method === undefined && /\/repos\/[^/]+\/[^/]+$/.test(url)) {
      return new Response(JSON.stringify({ default_branch: defaultBranch }), { status: 200 });
    }

    return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
  };
} else if (mode === 'monitor-pr') {
  // Drives every REST/GraphQL call `PrMonitor.js`/`AutoMonitorPrMonitorPr.js`
  // make (issue #436): `GET /repos/{repo}/pulls/{prNumber}` (`getPrState`,
  // matching `monitor_pr_shell.sh`'s `gh pr view --json state,comments,reviews`'s
  // `.state` field), `GET /repos/{repo}/pulls/{prNumber}/reviews`
  // (`getPrReviews`, matching that same call's `.reviews` field), `GET
  // /repos/{repo}/issues/{prNumber}/comments` (`getIssueComments`,
  // matching that call's `.comments` field), `GET
  // /repos/{repo}/pulls/{prNumber}/comments` (`getPrReviewComments`,
  // matching `monitor_pr_shell.sh`'s separate inline-review-comments
  // `gh api` call), and `POST https://api.github.com/graphql`
  // (`addReaction`/`removeReaction`, always tolerated). Env vars mirror
  // `fakeGhBin.js`'s own `FAKE_GH_*` names (as `FAKE_FETCH_*`) so the
  // same scenario seeds both sides of a parity comparison identically —
  // except `FAKE_FETCH_MONITOR_PR_FAIL`, which has no shell-side
  // counterpart (the shell simulates a transient `gh` error by leaving
  // `FAKE_GH_PR_NUMBER` unset, which already fails every `gh pr view`
  // case unconditionally; native has no equivalent single point of
  // failure, since `getPrState`/`getPrReviews`/`getIssueComments`/
  // `getPrReviewComments` are 4 independent REST calls, so this flag
  // fails all 4 at once instead).
  const prState = process.env.FAKE_FETCH_PR_STATE || 'open';
  const prMerged = process.env.FAKE_FETCH_PR_MERGED === '1';
  const reviewsJson = process.env.FAKE_FETCH_PR_REVIEWS_JSON || '[]';
  const commentsJson = process.env.FAKE_FETCH_PR_COMMENTS_JSON || '[]';
  const reviewCommentsJson = process.env.FAKE_FETCH_PR_REVIEW_COMMENTS_JSON || '[]';
  const fail = process.env.FAKE_FETCH_MONITOR_PR_FAIL === '1';

  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = typeof rawUrl === 'string' ? rawUrl : rawUrl.toString();
    const notFound = () => new Response(JSON.stringify({ message: 'not found' }), { status: 404 });

    if (fail) {
      return notFound();
    }

    if (options.method === 'POST' && url === 'https://api.github.com/graphql') {
      return new Response('{}', { status: 200 });
    }

    if (/\/pulls\/\d+\/reviews/.test(url)) {
      return new Response(reviewsJson, { status: 200 });
    }

    if (/\/pulls\/\d+\/comments/.test(url)) {
      return new Response(reviewCommentsJson, { status: 200 });
    }

    if (/\/issues\/\d+\/comments/.test(url)) {
      return new Response(commentsJson, { status: 200 });
    }

    if (/\/pulls\/\d+$/.test(url)) {
      return new Response(
        JSON.stringify({ state: prState, merged: prMerged, merged_at: prMerged ? '2024-01-01T00:00:00Z' : null }),
        { status: 200 }
      );
    }

    return notFound();
  };
}
