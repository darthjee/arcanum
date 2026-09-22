/**
 * Shared example: PR merge-body resolution across every
 * `merge_body_mode` (`empty`/`full`/`coauthors`), exercised identically
 * regardless of which layer actually computes the result —
 * `MergeBodyResolver#buildBody`'s direct `{ included, body }` return
 * value, or `PrOperations#prMerge`'s `githubClient.mergePr` call args
 * mapped to that same shape. Registers flat `it`s (no `describe` wrapper
 * of its own — callers invoke this from whichever `describe` block they
 * want the scenarios grouped under), covering the `empty`/`full` modes
 * plus every `coauthors` mode scenario (dedup, sort, merger/model/
 * remove_coauthors exclusions, fail-open merger lookup, and the
 * empty-list fallback to `full` mode's behavior).
 *
 * A scenario that needs to force the merger-login lookup to fail (the
 * "fails open" scenario) signals this via a `mergerLookupFails: true`
 * key on `configValues` — a synthetic marker that is not a real
 * `git.*` config key, so callers that cannot honor it (e.g. a layer
 * whose collaborators always resolve the current user successfully)
 * may safely ignore it; the scenario's fixture is chosen so its
 * expected outcome holds either way.
 * @param {(fixture: {commits: Array<object>, configValues: object, modelEmail?: string}) => Promise<{included: boolean, body: string}>} resolveMergeBody -
 *   resolves the merge body for a given scenario's fixture and returns
 *   the outcome in the `{ included, body }` shape shared by both
 *   layers.
 * @returns {void}
 */
export function registerMergeBodyResolverSharedExamples(resolveMergeBody) {
  it('returns an included empty body in "empty" mode', async () => {
    const result = await resolveMergeBody({ commits: [], configValues: { merge_body_mode: 'empty' } });

    expect(result).toEqual({ included: true, body: '' });
  });

  it('returns an excluded body in "full" mode', async () => {
    const result = await resolveMergeBody({ commits: [], configValues: { merge_body_mode: 'full' } });

    expect(result).toEqual({ included: false, body: '' });
  });

  it('builds a deduped, email-sorted Co-authored-by block from the PR commits', async () => {
    const commits = [
      { commit: { author: { name: 'Bob', email: 'bob@x.com' } }, author: { login: 'bob' } },
      { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
    ];

    const result = await resolveMergeBody({ commits, configValues: { merge_body_mode: 'coauthors' } });

    expect(result).toEqual({
      included: true,
      body: 'Co-authored-by: Alice <alice@x.com>\nCo-authored-by: Bob <bob@x.com>\n'
    });
  });

  it('dedupes by email, keeping one entry per address', async () => {
    const commits = [
      { commit: { author: { name: 'Bob', email: 'bob@x.com' } }, author: { login: 'bob' } },
      { commit: { author: { name: 'Bob Again', email: 'bob@x.com' } }, author: { login: 'bob' } }
    ];

    const result = await resolveMergeBody({ commits, configValues: { merge_body_mode: 'coauthors' } });

    expect(result.body).toEqual('Co-authored-by: Bob <bob@x.com>\n');
  });

  it('excludes the entry matching the merger\'s own GitHub login', async () => {
    const commits = [
      { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'fake-merger' } },
      { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
    ];

    const result = await resolveMergeBody({ commits, configValues: { merge_body_mode: 'coauthors' } });

    expect(result.body).toEqual('Co-authored-by: Alice <alice@x.com>\n');
  });

  it('fails open (skips only the merger exclusion) when the merger-login lookup fails', async () => {
    const commits = [
      { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
    ];

    const result = await resolveMergeBody({
      commits,
      configValues: { merge_body_mode: 'coauthors', mergerLookupFails: true }
    });

    expect(result.body).toEqual('Co-authored-by: Alice <alice@x.com>\n');
  });

  it('excludes modelEmail\'s entry only when omit_model_coauthor is true AND modelEmail is given', async () => {
    const commits = [
      { commit: { author: { name: 'Model', email: 'model@x.com' } }, author: { login: 'model-bot' } },
      { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } }
    ];

    const result = await resolveMergeBody({
      commits,
      configValues: { merge_body_mode: 'coauthors', omit_model_coauthor: true },
      modelEmail: 'model@x.com'
    });

    expect(result.body).toEqual('Co-authored-by: Alice <alice@x.com>\n');
  });

  it('does not exclude modelEmail\'s entry when omit_model_coauthor is not set', async () => {
    const commits = [
      { commit: { author: { name: 'Model', email: 'model@x.com' } }, author: { login: 'model-bot' } }
    ];

    const result = await resolveMergeBody({
      commits,
      configValues: { merge_body_mode: 'coauthors' },
      modelEmail: 'model@x.com'
    });

    expect(result.body).toEqual('Co-authored-by: Model <model@x.com>\n');
  });

  it('excludes any entry whose email is in the remove_coauthors config list', async () => {
    const commits = [
      { commit: { author: { name: 'Alice', email: 'alice@x.com' } }, author: { login: 'alice' } },
      { commit: { author: { name: 'Removed', email: 'removed@x.com' } }, author: { login: 'removed' } }
    ];

    const result = await resolveMergeBody({
      commits,
      configValues: { merge_body_mode: 'coauthors', remove_coauthors: ['removed@x.com'] }
    });

    expect(result.body).toEqual('Co-authored-by: Alice <alice@x.com>\n');
  });

  it('falls back to "full" mode\'s behavior (excluded) when the resulting list is empty', async () => {
    const commits = [
      { commit: { author: { name: 'Merger', email: 'merger@x.com' } }, author: { login: 'fake-merger' } }
    ];

    const result = await resolveMergeBody({ commits, configValues: { merge_body_mode: 'coauthors' } });

    expect(result).toEqual({ included: false, body: '' });
  });
}
