/**
 * Escapes `text` for literal use inside a `RegExp` source.
 * @param {string} text - the literal text.
 * @returns {string} the escaped regex source.
 */
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Fills `%%NAME%%` placeholders in `template` in a single pass. Only the
 * keys of `values` are recognized; every occurrence of each is replaced
 * by its value, inserted byte-for-byte via a replacer function (so
 * `$&`, `` $` ``, `$'`, `$$`, `$<n>`, `&` and `\` are never
 * interpreted). Inserted values are never re-scanned, so a value that
 * itself contains `%%OTHER%%` keeps it literally. Unknown `%%NAME%%`
 * markers are left untouched.
 * @param {string} template - the template text.
 * @param {{[key: string]: string}} values - placeholder name (without the
 *   `%%` delimiters) to replacement value.
 * @returns {string} the filled template.
 */
const fillTemplate = (template, values) => {
  const names = Object.keys(values);

  if (names.length === 0) {
    return template;
  }

  const pattern = new RegExp(`%%(${names.map(escapeRegExp).join('|')})%%`, 'g');

  return template.replace(pattern, (_match, name) => values[name]);
};

export { fillTemplate };
