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
}

export default Tags;
