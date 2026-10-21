// Spec-support parser for the shell static scan (issue #777, layer 2 of
// docs/agents/specs/arcanum-cli/key-registry.md's "Enforcing 'a new key
// means a registry entry'"). It finds `config_chain_read`,
// `repo_config_read|write` and `global_config_read|write` calls in shell
// source, builds the dotted key(s) each one touches, and honours
// `# config-key: <key>` annotations, following the parsing rules in
// docs/agents/plans/777-shared-config-key-registry/plan.md's shared
// contracts. Not shipped code.

const HELPERS = ['config_chain_read', 'repo_config_read', 'repo_config_write', 'global_config_read', 'global_config_write'];

// Index of the namespace argument and of the first key argument, per
// helper; `config_chain_read` takes every argument from there on as a key.
const ARG_LAYOUT = {
  config_chain_read: { ns: 1, key: 2, variadic: true },
  repo_config_read: { ns: 2, key: 3, variadic: false },
  repo_config_write: { ns: 2, key: 3, variadic: false },
  global_config_read: { ns: 1, key: 2, variadic: false },
  global_config_write: { ns: 1, key: 2, variadic: false }
};

const CALL_PATTERN = new RegExp(`(?<![\\w-])(${HELPERS.join('|')})(?![\\w-])`, 'g');
const ANNOTATION_PATTERN = /^\s*#\s*config-key:\s*(\S+)\s*$/;
const WHOLE_VARIABLE_PATTERN = /^\$(\{[^}]+\}|[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])$/;
const VARIABLE_PATTERN = /\$(\{([A-Za-z0-9_]+)[^}]*\}|([A-Za-z_][A-Za-z0-9_]*|[0-9]))/;
const TERMINATORS = new Set([')', ';', '|', '&', '\n', '`']);

/**
 * Joins backslash-continued lines, remembering each logical line's
 * first physical line number.
 * @param {string} source - the shell source.
 * @returns {Array<{line: number, text: string}>} the logical lines.
 */
function logicalLines(source) {
  const physical = source.split('\n');
  const lines = [];

  for (let index = 0; index < physical.length; index += 1) {
    const start = index;
    let text = physical[index];

    while (text.endsWith('\\') && index + 1 < physical.length) {
      index += 1;
      text = `${text.slice(0, -1)} ${physical[index]}`;
    }

    lines.push({ line: start + 1, text });
  }

  return lines;
}

/**
 * @param {string} text - shell text.
 * @param {number} start - index right after an opening `$(`.
 * @returns {number} the index right after the matching `)`.
 */
function skipCommandSubstitution(text, start) {
  let depth = 1;
  let index = start;

  while (index < text.length && depth > 0) {
    const char = text[index];

    if (char === '\\') {
      index += 2;
      continue;
    }

    if (char === '\'') {
      index = text.indexOf('\'', index + 1);
      index = index === -1 ? text.length : index + 1;
      continue;
    }

    if (char === '"') {
      index = skipDoubleQuoted(text, index + 1).end;
      continue;
    }

    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }

    index += 1;
  }

  return index;
}

/**
 * @param {string} text - shell text.
 * @param {number} start - index right after an opening `"`.
 * @returns {{value: string, end: number, substitution: boolean}} the
 *   unquoted content (with `$...` kept verbatim), the index after the
 *   closing quote, and whether it holds a command substitution.
 */
function skipDoubleQuoted(text, start) {
  let index = start;
  let value = '';
  let substitution = false;

  while (index < text.length && text[index] !== '"') {
    if (text[index] === '\\') {
      value += text[index + 1] ?? '';
      index += 2;
    } else if (text.startsWith('$(', index)) {
      const end = skipCommandSubstitution(text, index + 2);

      value += text.slice(index, end);
      substitution = true;
      index = end;
    } else {
      value += text[index];
      index += 1;
    }
  }

  return { value, end: index + 1, substitution };
}

/**
 * Reads one shell word starting at `start`.
 * @param {string} text - shell text.
 * @param {number} start - the word's first character.
 * @returns {{value: string, end: number, substitution: boolean}} the word.
 */
function readWord(text, start) {
  let index = start;
  let value = '';
  let substitution = false;

  while (index < text.length && !/\s/.test(text[index]) && !TERMINATORS.has(text[index])) {
    const char = text[index];

    if (char === '"') {
      const quoted = skipDoubleQuoted(text, index + 1);

      value += quoted.value;
      substitution ||= quoted.substitution;
      index = quoted.end;
    } else if (char === '\'') {
      const end = text.indexOf('\'', index + 1);
      const close = end === -1 ? text.length : end;

      value += text.slice(index + 1, close);
      index = close + 1;
    } else if (text.startsWith('$(', index)) {
      const end = skipCommandSubstitution(text, index + 2);

      value += text.slice(index, end);
      substitution = true;
      index = end;
    } else if (text.startsWith('${', index)) {
      const end = text.indexOf('}', index);
      const close = end === -1 ? text.length : end + 1;

      value += text.slice(index, close);
      index = close;
    } else if (char === '\\') {
      value += text[index + 1] ?? '';
      index += 2;
    } else {
      value += char;
      index += 1;
    }
  }

  return { value, end: index, substitution };
}

/**
 * Reads a call's arguments, stopping at the end of the simple command
 * (`)`, `;`, `|`, `&`, a redirection, or the end of the line).
 * @param {string} text - the logical line.
 * @param {number} start - index right after the helper name.
 * @returns {Array<{value: string, substitution: boolean}>} the arguments.
 */
function readArguments(text, start) {
  const args = [];
  let index = start;

  for (;;) {
    while (index < text.length && /[ \t]/.test(text[index])) {
      index += 1;
    }

    if (index >= text.length || TERMINATORS.has(text[index]) || /^\d*[<>]/.test(text.slice(index))) {
      return args;
    }

    const word = readWord(text, index);

    args.push({ value: word.value, substitution: word.substitution });
    index = word.end;
  }
}

/**
 * @param {{value: string, substitution: boolean}} arg - a parsed argument.
 * @returns {boolean} whether it can't be read statically: a command
 *   substitution or a variable as the whole argument.
 */
function isDynamic(arg) {
  return arg.substitution || WHOLE_VARIABLE_PATTERN.test(arg.value);
}

/**
 * Builds `<ns>.<key>`, turning every segment holding a variable into a
 * `<name>` wildcard segment.
 * @param {string} namespace - the namespace argument.
 * @param {string} key - one key argument.
 * @returns {string} the dotted key pattern.
 */
function buildKey(namespace, key) {
  return `${namespace}.${key}`
    .split('.')
    .map((segment) => {
      const match = VARIABLE_PATTERN.exec(segment);

      return match ? `<${match[2] || match[3]}>` : segment;
    })
    .join('.');
}

/**
 * @param {string} helper - the helper name.
 * @param {Array<{value: string, substitution: boolean}>} args - its arguments.
 * @returns {string[]|null} the dotted keys, or `null` when unparseable.
 */
function keysFor(helper, args) {
  const layout = ARG_LAYOUT[helper];
  const namespace = args[layout.ns];
  const keyArgs = layout.variadic ? args.slice(layout.key) : args.slice(layout.key, layout.key + 1);

  if (!namespace || keyArgs.length === 0 || isDynamic(namespace) || keyArgs.some(isDynamic)) {
    return null;
  }

  return keyArgs.map((arg) => buildKey(namespace.value, arg.value));
}

/**
 * Finds every config helper call in shell source.
 * @param {string} source - the shell source.
 * @returns {Array<{line: number, helper: string, keys: (string[]|null), annotations: string[]}>}
 *   one entry per call: `keys` as parsed (`null` when unparseable) and
 *   the `# config-key:` annotations directly above it (which, when
 *   present, replace parsing).
 */
export function findConfigCalls(source) {
  const lines = logicalLines(source);
  const calls = [];

  lines.forEach(({ line, text }, index) => {
    if (/^\s*#/.test(text)) {
      return;
    }

    const annotations = [];

    for (let above = index - 1; above >= 0; above -= 1) {
      const match = ANNOTATION_PATTERN.exec(lines[above].text);

      if (!match) {
        break;
      }

      annotations.unshift(match[1]);
    }

    for (const match of text.matchAll(CALL_PATTERN)) {
      const after = match.index + match[0].length;

      if (/^\s*\(\s*\)/.test(text.slice(after))) {
        continue;
      }

      const helper = match[1];

      calls.push({ line, helper, keys: keysFor(helper, readArguments(text, after)), annotations });
    }
  });

  return calls;
}

/**
 * Checks every config call of one file against the registry.
 * @param {string} file - the file's repo-relative path, for messages.
 * @param {string} source - the shell source.
 * @param {{lookupPattern: Function}} registry - a `KeyRegistry`.
 * @returns {string[]} `file:line: ...` problems; empty when clean.
 */
export function checkShellSource(file, source, registry) {
  const problems = [];

  for (const call of findConfigCalls(source)) {
    const where = `${file}:${call.line}`;

    if (call.annotations.length > 0) {
      for (const key of call.annotations) {
        if (!registry.lookupPattern(key)) {
          problems.push(`${where}: ${key} (annotated) matches no keys.json entry`);
        }
      }

      continue;
    }

    if (call.keys === null) {
      problems.push(`${where}: ${call.helper} call has no statically readable key; add a # config-key: annotation above it`);

      continue;
    }

    for (const key of call.keys) {
      if (!registry.lookupPattern(key)) {
        problems.push(`${where}: ${key} matches no keys.json entry`);
      }
    }
  }

  return problems;
}
