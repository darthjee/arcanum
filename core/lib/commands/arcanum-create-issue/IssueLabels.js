const EPIC = 'epic';
const SHIPIT = 'shipit';
const EPIC_COLOR = 'fbca04';
const DEFAULT_COLOR = 'ededed';

/**
 * Label rules for `arcanum-create-issue-publish` (see "Label rules" and
 * "Edge cases" in docs/agents/specs/arcanum-create-issue.md): validation,
 * case-insensitive dedupe, `Epic`/`shipit` detection, and matching the
 * requested labels against the repo's GitHub labels — reusing the
 * existing spelling and creating any missing label (`Epic` → `fbca04`,
 * anything else → `ededed`) before the issue is created.
 */
class IssueLabels {
  /**
   * @param {string} label - a requested label.
   * @returns {boolean} whether it is well-formed: not blank, no comma,
   *   no newline/carriage return.
   */
  static isValid(label) {
    return label.trim() !== '' && !/[,\n\r]/.test(label);
  }

  /**
   * @param {string[]} labels - the requested labels.
   * @returns {string[]} the labels, trimmed, with case-insensitive
   *   duplicates removed (first spelling wins), in request order.
   */
  static dedupe(labels) {
    const seen = new Set();
    const unique = [];

    for (const label of labels.map((name) => name.trim())) {
      const key = label.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(label);
      }
    }

    return unique;
  }

  /**
   * @param {string[]} labels - label names.
   * @returns {boolean} whether `Epic` (any case) is among them.
   */
  static hasEpic(labels) {
    return labels.some((label) => label.toLowerCase() === EPIC);
  }

  /**
   * @param {string[]} labels - label names.
   * @returns {boolean} whether `shipit` (any case) is among them.
   */
  static hasShipit(labels) {
    return labels.some((label) => label.toLowerCase() === SHIPIT);
  }

  /**
   * @param {string[]} labels - label names.
   * @returns {string[]} the labels without `shipit` (any case).
   */
  static withoutShipit(labels) {
    return labels.filter((label) => label.toLowerCase() !== SHIPIT);
  }

  /**
   * @param {object} client - the repo's label client.
   * @param {() => Promise<string[]>} client.listLabelNames - lists the
   *   repo's label names.
   * @param {(name: string, color: string) => Promise<void>} client.createLabel -
   *   creates a label.
   */
  constructor(client) {
    this._client = client;
  }

  /**
   * Map each requested label to the repo's existing spelling, creating
   * missing ones first (so the single issue-create call can apply every
   * label at once).
   * @param {string[]} labels - the deduped requested labels.
   * @param {string[]} warnings - collects one `created label <name>`
   *   note per created label (mutated, so notes survive a later failure).
   * @returns {Promise<string[]>} the labels to apply, in request order.
   * @throws {Error} when listing or creating a label fails.
   */
  async resolve(labels, warnings) {
    if (labels.length === 0) {
      return [];
    }

    const existing = new Map();

    for (const name of await this._client.listLabelNames()) {
      if (!existing.has(name.toLowerCase())) {
        existing.set(name.toLowerCase(), name);
      }
    }

    const applied = [];

    for (const label of labels) {
      const match = existing.get(label.toLowerCase());

      if (match) {
        applied.push(match);
        continue;
      }

      await this._client.createLabel(label, label.toLowerCase() === EPIC ? EPIC_COLOR : DEFAULT_COLOR);
      warnings.push(this.createdWarning(label));
      applied.push(label);
    }

    return applied;
  }

  /**
   * @param {string} label - the created label.
   * @returns {string} the `WARNING=` note (suggesting `/arcanum-migrate`
   *   for `Epic`).
   */
  createdWarning(label) {
    if (label.toLowerCase() === EPIC) {
      return `created label ${label} (run /arcanum-migrate to set up the Epic label)`;
    }

    return `created label ${label}`;
  }
}

export default IssueLabels;
