// The three tier files: where they live and how the CLI reads them (see
// docs/agents/architecture/arcanum-cli.md#missing-and-malformed-tier-files).
// The paths match `ConfigChain`'s (`shared/lib/config/ConfigChain.js`),
// which a spec cross-checks, so the CLI and the skills read the same files.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FileError } from './exitCodes.js';

/** The tiers in resolution order: local → repo → global. */
export const TIERS = ['local', 'repo', 'global'];

/** The repo tier file, relative to the repo root. */
export const REPO_CONFIG_FILE = path.join('.claude', 'configuration', 'arcanum-repo-config.json');

/** The local tier file, relative to the repo root. */
export const LOCAL_CONFIG_FILE = path.join('.claude', 'state', 'arcanum-config.json');

/** The global tier file, relative to the Claude config directory. */
export const GLOBAL_CONFIG_FILE = 'arcanum-config.json';

/** The malformed read states: the tier reads as empty, with a warning, and writes refuse. */
export const MALFORMED_STATES = ['invalid_json', 'not_object', 'unreadable', 'not_utf8'];

const BOM = '﻿';

/**
 * @param {string} tier - `local`, `repo` or `global`.
 * @param {{account: {dir: (string|null)}, repo: {root: (string|null)}}} targets - the resolved targets.
 * @returns {(string|null)} the tier file's absolute path, or `null` when
 *   the tier has no target (no repo, unresolved account).
 */
export function tierFile(tier, { account, repo }) {
  if (tier === 'global') {
    return account.dir ? path.join(account.dir, GLOBAL_CONFIG_FILE) : null;
  }

  if (!repo.root) {
    return null;
  }

  return path.join(repo.root, tier === 'repo' ? REPO_CONFIG_FILE : LOCAL_CONFIG_FILE);
}

/**
 * Reads and parses a tier file without ever throwing. A UTF-8 BOM is
 * stripped; any other encoding is malformed.
 * @param {(string|null)} file - the tier file's path (`null`: no target).
 * @returns {Promise<{state: string, data: object, error: (string|null)}>}
 *   `state` is `ok`, `missing`, `empty`, or a malformed state
 *   (`invalid_json`, `not_object`, `unreadable`, `not_utf8`); `data` is
 *   the parsed object, or `{}` for anything but `ok`; `error` describes
 *   a malformed state.
 */
export async function readTier(file) {
  if (file === null) {
    return { state: 'missing', data: {}, error: null };
  }

  let bytes;

  try {
    bytes = await readFile(file);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { state: 'missing', data: {}, error: null };
    }

    return { state: 'unreadable', data: {}, error: error && error.code ? error.code : String(error) };
  }

  let text;

  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return { state: 'not_utf8', data: {}, error: 'not UTF-8' };
  }

  if (text.startsWith(BOM)) {
    text = text.slice(BOM.length);
  }

  if (text.trim() === '') {
    return { state: 'empty', data: {}, error: null };
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { state: 'invalid_json', data: {}, error: jsonErrorLocation(error, text) };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { state: 'not_object', data: {}, error: Array.isArray(parsed) ? 'array' : JSON.stringify(parsed) };
  }

  return { state: 'ok', data: parsed, error: null };
}

/**
 * @param {Error} error - a `JSON.parse` error.
 * @param {string} text - the text that failed to parse.
 * @returns {string} where it failed, e.g. `line 3`.
 */
function jsonErrorLocation(error, text) {
  const line = /\(line (\d+)/.exec(error.message);

  if (line) {
    return `line ${line[1]}`;
  }

  const position = /at position (\d+)/.exec(error.message);

  if (position) {
    return `line ${text.slice(0, Number(position[1])).split('\n').length}`;
  }

  return error.message;
}

/**
 * @param {string} state - a read state.
 * @returns {boolean} whether it is malformed.
 */
export function isMalformed(state) {
  return MALFORMED_STATES.includes(state);
}

/**
 * @param {string} file - the tier file's path.
 * @param {{state: string, error: (string|null)}} read - its `readTier` result.
 * @returns {string} why the file is malformed, naming it.
 */
export function malformedReason(file, { state, error }) {
  switch (state) {
  case 'invalid_json':
    return `${file} is not valid JSON (${error})`;
  case 'not_object':
    return `${file} is not a JSON object (got ${error})`;
  case 'not_utf8':
    return `${file} is not UTF-8`;
  default:
    return `${file} is unreadable (${error})`;
  }
}

/**
 * Reads a tier for a read command: a malformed file prints a stderr
 * warning naming it and reads as an empty tier.
 * @param {(string|null)} file - the tier file's path.
 * @param {(message: string) => void} warn - prints a stderr warning.
 * @returns {Promise<{state: string, data: object, error: (string|null)}>} the `readTier` result.
 */
export async function readTierTolerant(file, warn) {
  const read = await readTier(file);

  if (isMalformed(read.state)) {
    warn(`${malformedReason(file, read)}; ignoring it`);
  }

  return read;
}

/**
 * Reads a tier for a write command: a malformed file is refused, so the
 * CLI never overwrites data it cannot parse.
 * @param {string} file - the tier file's path.
 * @returns {Promise<{state: string, data: object, error: (string|null)}>} the `readTier` result.
 * @throws {FileError} (exit `7`) when the file is malformed.
 */
export async function readTierForWrite(file) {
  const read = await readTier(file);

  if (isMalformed(read.state)) {
    throw new FileError(`${malformedReason(file, read)}; refusing to overwrite it`, { hint: 'fix or remove the file' });
  }

  return read;
}

/**
 * Resolves a dotted key in a tier's parsed content. A `null` value
 * counts as unset, like `ConfigChain`.
 * @param {object} data - the tier's parsed content.
 * @param {string} key - the dotted key.
 * @returns {{set: boolean, value: unknown}} the value, when set.
 */
export function lookupKey(data, key) {
  let current = data;

  for (const segment of key.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current) || !Object.hasOwn(current, segment)) {
      return { set: false, value: null };
    }

    current = current[segment];
  }

  return current === null || current === undefined ? { set: false, value: null } : { set: true, value: current };
}
