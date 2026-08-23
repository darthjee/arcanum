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
}
