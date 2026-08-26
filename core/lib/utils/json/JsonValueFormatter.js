/**
 * Formats an arbitrary JSON-compatible value the way `jq -r
 * '.[$field] // empty'` would print it.
 */
class JsonValueFormatter {
  /**
   * `null`/`undefined`/`false` print nothing, strings print raw,
   * anything else prints as 2-space-indented JSON.
   * @param {*} value - the raw value to format.
   * @returns {string} the formatted value.
   */
  format(value) {
    if (value === undefined || value === null || value === false) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value, null, 2);
  }
}

export default JsonValueFormatter;
