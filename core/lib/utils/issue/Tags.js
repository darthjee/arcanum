/**
 * Canonical tag <-> GitHub label mapping table, duplicated from
 * `arcanum/_lib/tags.sh`'s own table (see
 * docs/agents/plans/193-migrate-resolve-and-fetch-sh-to-a-native--node-js--implementation/plan.md's
 * "Shared contracts" section) — not shared with the shell side, per
 * docs/agents/architecture/script-engine.md's "no standalone `_lib`
 * migration" scope boundary. Exported (not module-private) so callers
 * that need the reverse (canonical tag name -> GitHub label name)
 * lookup — e.g. `AutoFixAllQueue.js`'s best-effort label mutation — can
 * invert this same table rather than hardcoding a second copy of it.
 * @type {Record<string, string>}
 */
export const LABEL_TO_TAG = {
  Created: 'created',
  'Ready for Work': 'ready_for_work',
  shipit: 'shipit',
  Working: 'working',
  Question: 'question',
  Fetched: 'fetched',
  Refined: 'refined',
  Ready: 'ready',
  Enqueued: 'enqueued',
  Idea: 'idea',
  Writting: 'writting',
  Enhancing: 'enhancing',
  PR: 'pr',
  Planning: 'planning',
  Split: 'split',
  Spawned: 'spawned'
};

/**
 * Reverse of `LABEL_TO_TAG` — resolves a canonical tag name to its
 * exact GitHub label name, computed once here so callers (e.g.
 * `IssueTagger.js`, `AutoFixAllQueue.js`) share a single inversion
 * instead of each re-deriving their own copy.
 * @type {Record<string, string>}
 */
export const TAG_TO_LABEL = Object.fromEntries(
  Object.entries(LABEL_TO_TAG).map(([label, tag]) => [tag, label])
);

/**
 * The tags that drive monitor-issues dispatch, in the fixed order
 * `arcanum/_lib/tag_actions.sh`'s `ACTIONABLE_TAGS` lists them.
 * @type {string[]}
 */
export const ACTIONABLE_TAGS = ['question', 'created', 'ready_for_work'];

/**
 * Maps GitHub issue label names to their canonical tag names.
 */
class Tags {
  /**
   * Map a list of GitHub issue label names to their canonical tag
   * names, ignoring unrecognized labels and deduplicating while
   * preserving first-occurrence order — mirrors
   * `arcanum/_lib/tags.sh`'s `extract_tags`.
   * @param {string[]} labelNames - the issue's GitHub label names.
   * @returns {string[]} the mapped, deduplicated canonical tag names.
   */
  static extractTags(labelNames) {
    const seen = new Set();
    const tags = [];

    for (const label of labelNames || []) {
      const tag = LABEL_TO_TAG[label];

      if (tag && !seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Native port of `arcanum/_lib/tag_actions.sh`'s `actionable_tags`:
   * the subset of `ACTIONABLE_TAGS` present among `labelNames` (via the
   * same label -> tag mapping as `extractTags`, i.e. `has_tag`), in
   * `ACTIONABLE_TAGS`' fixed order.
   * @param {string[]} labelNames - the issue's GitHub label names.
   * @returns {string[]} the actionable tags present, possibly empty.
   */
  static actionableTags(labelNames) {
    const tags = new Set(Tags.extractTags(labelNames));

    return ACTIONABLE_TAGS.filter((tag) => tags.has(tag));
  }
}

export default Tags;
