import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import KeyRegistry from '../../../../../shared/lib/config/KeyRegistry.js';
import { checkShellSource, findConfigCalls } from '../../../support/utils/shellConfigKeys.js';

// Shell static scan (issue #777, layer 2 of
// docs/agents/specs/arcanum-cli/key-registry.md's "Enforcing 'a new key
// means a registry entry'"): every config helper call in a tracked *.sh
// must touch a key registered in shared/lib/config/keys.json, or
// carry `# config-key: <key>` annotations when its key can't be read
// statically.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

// The helper definitions themselves forward `$namespace` / `$key`.
const EXEMPT_FILES = new Set([
  'arcanum/_lib/config_chain.sh',
  'arcanum/_lib/repo_config.sh',
  'arcanum/_lib/global_config.sh'
]);

async function trackedShellFiles() {
  const { stdout } = await execFileAsync('git', ['ls-files', '-z', '--', '*.sh'], { cwd: REPO_ROOT });

  return stdout
    .split('\0')
    .filter((file) => file.length > 0)
    .filter((file) => !file.split('/').includes('node_modules'))
    .filter((file) => !file.startsWith('core/spec/support/fixtures/'))
    .filter((file) => !EXEMPT_FILES.has(file));
}

describe('shell config key static scan', () => {
  const registry = new KeyRegistry();

  it('finds every shell config key in keys.json', async () => {
    const problems = [];

    for (const file of await trackedShellFiles()) {
      let source;

      try {
        source = await readFile(path.join(REPO_ROOT, file), 'utf8');
      } catch {
        // Tracked but deleted in the working tree.
        continue;
      }

      problems.push(...checkShellSource(file, source, registry));
    }

    expect(problems).toEqual([]);
  });

  it('scans a non-trivial number of calls', async () => {
    let count = 0;

    for (const file of await trackedShellFiles()) {
      try {
        count += findConfigCalls(await readFile(path.join(REPO_ROOT, file), 'utf8')).length;
      } catch {
        continue;
      }
    }

    expect(count).toBeGreaterThan(20);
  });

  describe('parser', () => {
    function keysOf(source) {
      return findConfigCalls(source).map((call) => call.keys);
    }

    function check(source) {
      return checkShellSource('x.sh', source, registry);
    }

    it('reads literal config_chain_read keys, one per key argument', () => {
      expect(keysOf('v=$(config_chain_read "." "git" "agents.node" "email")\n')).toEqual([
        ['git.agents.node', 'git.email']
      ]);
    });

    it('reads unquoted arguments', () => {
      expect(keysOf('mode=$(cd "$r" && config_chain_read "$r" engine mode)\n')).toEqual([['engine.mode']]);
    });

    it('reads repo_config_* <new> <legacy> <ns> <key> calls', () => {
      expect(keysOf('repo_config_write ".claude/state/x.json" "" "git" "safe_branch" "\\"${v}\\""\n')).toEqual([
        ['git.safe_branch']
      ]);
    });

    it('reads global_config_* <repo> <ns> <key> calls', () => {
      expect(keysOf('global_config_write "" "git" "merge_body_mode" \'"full"\'\n')).toEqual([['git.merge_body_mode']]);
    });

    it('stops at a redirection', () => {
      expect(keysOf('v="$(config_chain_read "$R" next_step "auto.x" 2>/dev/null || true)"\n')).toEqual([
        ['next_step.auto.x']
      ]);
    });

    it('turns a ${var} segment into a wildcard segment', () => {
      expect(keysOf('config_chain_read "." "git" "agents.${agent}"\n')).toEqual([['git.agents.<agent>']]);
    });

    it('turns a $var segment into a wildcard segment', () => {
      expect(keysOf('config_chain_read "." next_step auto.$skill\n')).toEqual([['next_step.auto.<skill>']]);
    });

    it('accepts a wildcard key that matches a registry entry', () => {
      expect(check('config_chain_read "." "git" "agents.${agent}"\n')).toEqual([]);
    });

    it('treats a variable namespace as unparseable', () => {
      expect(keysOf('repo_config_read "$f" "" "$NAMESPACE" "clear_context"\n')).toEqual([null]);
    });

    it('treats a variable as the whole key argument as unparseable', () => {
      expect(keysOf('repo_config_read "$f" "" auto-fix-all "$KEY"\n')).toEqual([null]);
    });

    it('treats a command substitution argument as unparseable', () => {
      expect(keysOf('config_chain_read "." git "$(pick_key)"\n')).toEqual([null]);
    });

    it('treats a call missing its key as unparseable', () => {
      expect(keysOf('global_config_read "." "git"\n')).toEqual([null]);
    });

    it('fails an unparseable call without an annotation', () => {
      expect(check('x\nrepo_config_read "$f" "" "$NAMESPACE" "$KEY"\n')).toEqual([
        'x.sh:2: repo_config_read call has no statically readable key; add a # config-key: annotation above it'
      ]);
    });

    it('fails an unregistered literal key', () => {
      expect(check('config_chain_read "." "git" "nope"\n')).toEqual(['x.sh:1: git.nope matches no keys.json entry']);
    });

    it('accepts a call with a single annotation', () => {
      expect(check('# config-key: auto-fix-all.clear_context\nrepo_config_read "$f" "" "$NS" "$KEY"\n')).toEqual([]);
    });

    it('accepts a call with several consecutive annotations', () => {
      const source = [
        '  # config-key: auto-fix-all.clear_context',
        '  # config-key: auto-fix-all.finish_on_empty_queue',
        '  VALUE=$(repo_config_read "$(_new "$KEY")" "$(_legacy "$KEY")" "$NAMESPACE" "$KEY")',
        ''
      ].join('\n');

      expect(findConfigCalls(source)[0].annotations).toEqual([
        'auto-fix-all.clear_context',
        'auto-fix-all.finish_on_empty_queue'
      ]);
      expect(check(source)).toEqual([]);
    });

    it('accepts an annotation in wildcard syntax', () => {
      expect(check('# config-key: next_step.auto.<skill>\nglobal_config_write "" "$NS" "auto.${s}" "$v"\n')).toEqual([]);
    });

    it('lets annotations replace parsing', () => {
      expect(check('# config-key: git.email\nconfig_chain_read "." "git" "nope"\n')).toEqual([]);
    });

    it('fails an annotation that matches no registry entry', () => {
      expect(check('# config-key: foo.bar\nrepo_config_read "$f" "" "$NS" "$KEY"\n')).toEqual([
        'x.sh:2: foo.bar (annotated) matches no keys.json entry'
      ]);
    });

    it('does not apply an annotation separated from the call', () => {
      expect(check('# config-key: git.email\n\nrepo_config_read "$f" "" "$NS" "$KEY"\n').length).toBe(1);
    });

    it('skips comment lines', () => {
      expect(keysOf('# repo_config_read "$f" "" "$NAMESPACE" "$KEY"\n  # config_chain_read . git nope\n')).toEqual([]);
    });

    it('skips helper definitions', () => {
      expect(keysOf('config_chain_read() {\n  :\n}\n')).toEqual([]);
    });

    it('reads a backslash-continued call, reporting its first line', () => {
      const [call] = findConfigCalls('x\nconfig_chain_read "." \\\n  "git" "email"\n');

      expect(call).toEqual({ line: 2, helper: 'config_chain_read', keys: ['git.email'], annotations: [] });
    });
  });
});
