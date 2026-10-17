import type { On, RegisteredToolSpec } from 'claude-code'
import { mock, type Engine } from 'claude-code/testing'

export const TOOL = 'mcp__arcanum-next-step__handoff'

export const NOT_ARCANUM = 'handoff only runs arcanum skills'
export const NOT_MAIN_LOOP = 'handoff is only available on the main loop'
export const NOT_INTERACTIVE = 'handoff is only available in an interactive session'
export const CANCELLED = 'arcanum-next-step: handoff cancelled'

export const scheduled = (command: string) =>
  `scheduled: will /clear then run ${command} once this turn ends — end your turn now without further output`

/** The sibling folders of the mod that hold a SKILL.md in the fake install. */
export const SKILLS = ['discuss-issue', 'auto-resolve-issue', 'arcanum-check-config']

/** Siblings that are no arcanum skill: a folder without SKILL.md, a file. */
const OTHERS = [
  { name: 'core', kind: 'dir' as const },
  { name: 'arcanum-next-step', kind: 'dir' as const },
  { name: 'README.md', kind: 'file' as const },
]

export type RunCommand = { command: string; args: string }

export type World = {
  /** The tools `$.tool.register` received. */
  registered: RegisteredToolSpec[]
  /** The commands `$.command.run` ran, in order. */
  commands: RunCommand[]
  /** The toasts raised, in order. */
  toasts: string[]
  /** The mocked clock: `settle()` runs the handoff's `$.clock.after(0)`. */
  clock: ReturnType<typeof mock.clock>
  /** The mod's `$.state` values as the host holds them, by key. */
  state: Map<string, unknown>
}

export type WorldOptions = {
  /** A command whose `$.command.run` rejects with this error message. */
  failing?: { command: string; message: string }
  /**
   * The mod's `$.state` values the host already holds: a module loaded with
   * them and no `session.start` is a hot reload mid-session.
   */
  state?: Partial<Record<StateKey, unknown>>
}

export type StateKey = 'pending' | 'interactive'

/**
 * Stands for the engine beneath the mod: the install's skills folder, tool
 * registration, command runs, toasts, the clock and the events' bottoms.
 */
export const world = (on: On, options: WorldOptions = {}): World => {
  const registered: RegisteredToolSpec[] = []
  const commands: RunCommand[] = []
  const toasts: string[] = []
  const clock = mock.clock(on)
  const state = new Map<string, unknown>(Object.entries(options.state ?? {}))
  const versions = new Map<string, number>()

  on('state.get', ($, e) => ({
    value: { value: state.get(e.key), version: versions.get(e.key) ?? 0 },
  }))
  on('state.set', ($, e) => {
    const version = (versions.get(e.key) ?? 0) + 1
    state.set(e.key, e.value)
    versions.set(e.key, version)
    return { value: { isSet: true as const, version } }
  })

  on('fs.list', () => ({
    value: [...SKILLS.map(name => ({ name, kind: 'dir' as const })), ...OTHERS].map(entry => ({
      ...entry,
      size: 0,
      mtimeMs: 0,
      isLink: false,
    })),
  }))
  on('fs.exists', ($, e) => ({
    value: SKILLS.some(name => e.path.endsWith(`/${name}/SKILL.md`)),
  }))
  on('tool.register', ($, e) => {
    registered.push(e)
    return { value: { tool: `mcp__arcanum-next-step__${e.name}` } }
  })
  on('command.run', ($, e) => {
    commands.push({ command: e.command, args: e.args })
    if (options.failing?.command === e.command) throw new Error(options.failing.message)
    return { text: '' }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('prompt.submit', ($, e) => ({ text: e.text }))

  return { registered, commands, toasts, clock, state }
}

export const startSession = ($: Engine, isInteractive = true) =>
  $.session.start({ cwd: '/work', surface: isInteractive ? 'terminal' : null, isInteractive })

export const handoff = ($: Engine, command: unknown, agentId?: string) =>
  $.tool.call({ tool: TOOL, command, ...(agentId === undefined ? {} : { agentId }) })

export const endTurn = (
  $: Engine,
  reason: 'answer' | 'aborted' | 'error' = 'answer',
  agentId?: string,
) =>
  $.turn.complete({
    answer: '',
    durationMs: 1,
    isAborted: reason === 'aborted',
    turnId: 'turn-1',
    reason,
    ...(agentId === undefined ? {} : { agentId }),
  })

export const typePrompt = ($: Engine, text = 'never mind') =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
