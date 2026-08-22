// Preload module (meant to be loaded via `node --import
// <fileURL>`, before `core/bin/arcanum` itself is imported) that
// monkey-patches the global `fetch` so
// AutoFixAllReplyComment.js#_postComment's `POST
// https://api.github.com/.../comments` call never touches the real
// network — per the repo-wide "no real network calls in specs" rule.
// `AutoFixAllReplyComment`'s constructor default-parameters `fetchFn`
// to the global `fetch`, read at instantiation time (i.e. once
// `core/bin/arcanum` actually dispatches), which happens well after
// this preload module has already run — so the patched global is what
// ends up injected.
//
// Controlled by `ARCANUM_TEST_FAKE_FETCH`, mirroring the fake `gh`
// binary's (`fakeGhBin.js`) `FAKE_GH_*` env-var-driven control scheme
// so both the shell side (fake `gh pr comment`) and the native side
// (this fake `fetch`) can be steered from the same parity-spec
// scenario. Left inert (real `fetch` untouched) when unset.
const mode = process.env.ARCANUM_TEST_FAKE_FETCH;

if (mode === 'success') {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ html_url: 'https://github.com/darthjee/arcanum/pull/1#issuecomment-1' }), {
      status: 201
    });
} else if (mode === 'failure') {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Validation Failed' }), { status: 422 });
}
