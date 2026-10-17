import type { EngineInterface, Register } from 'claude-code'
import type { ArcanumNextStepHandoff } from '../types/index.d.ts'

const TOOL_NAME = 'handoff'
const TOOL = 'mcp__arcanum-next-step__handoff'

const DESCRIPTION = [
  'Clears the conversation context (/clear) and then runs the given arcanum',
  'skill command, once this turn ends. Pass the exact command line, e.g.',
  '"/discuss-issue 797" or "/loop /auto-resolve-issue 796". Only arcanum',
  'skills (optionally wrapped in /loop) are accepted. After calling it, end',
  'your turn right away without further output: the handoff runs only when',
  'the turn ends.',
].join(' ')

const NOT_ARCANUM = 'handoff only runs arcanum skills'
const NOT_MAIN_LOOP = 'handoff is only available on the main loop'
const NOT_INTERACTIVE = 'handoff is only available in an interactive session'
const CANCELLED = 'arcanum-next-step: handoff cancelled'

const scheduled = (command: string) =>
  `scheduled: will /clear then run ${command} once this turn ends — end your turn now without further output`

const pending = { plugin: 'arcanum-next-step', key: 'pending' } as const

const interactive = { plugin: 'arcanum-next-step', key: 'interactive' } as const

/**
 * The arcanum skills of this install: the sibling folders of the mod's own
 * folder that hold a SKILL.md. Built at `session.start`, and again on the
 * first call after a hot reload (which runs no `session.start`).
 */
let skills: ReadonlySet<string> | undefined

const parentOf = (path: string): string =>
  path.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '')

const listSkills = async ($: EngineInterface): Promise<Set<string>> => {
  const parent = parentOf($.plugin.root)
  const entries = await $.fs.list(parent)
  const found = new Set<string>()

  for (const entry of entries) {
    if (entry.kind === 'file') continue
    if (await $.fs.exists(`${parent}/${entry.name}/SKILL.md`)) found.add(entry.name)
  }

  return found
}

/**
 * Splits a command line at its first whitespace run: `/name args`, the name
 * without its slash, the args verbatim. Undefined when it does not start
 * with `/` or names nothing.
 */
const split = (line: string): { name: string; args: string } | undefined => {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(line)
  if (!match || match[1] === undefined) return undefined
  return { name: match[1], args: match[2] ?? '' }
}

/**
 * Parses and allowlists a handoff command: an arcanum skill, or `/loop`
 * wrapping one. Undefined when the command is not accepted.
 */
export const parseHandoff = (
  command: unknown,
  allowed: ReadonlySet<string>,
): ArcanumNextStepHandoff | undefined => {
  if (typeof command !== 'string') return undefined

  const trimmed = command.trim()
  const parts = split(trimmed)
  if (!parts) return undefined

  const accepts = (name: string) => name !== 'clear' && allowed.has(name)

  if (parts.name === 'loop') {
    const inner = split(parts.args.trim())
    if (!inner || !accepts(inner.name)) return undefined
  } else if (!accepts(parts.name)) {
    return undefined
  }

  return { command: trimmed, name: parts.name, args: parts.args }
}

const failure = (text: string) => ({ deny: text })

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * The prompt's origins that are the person's own input: typed at the
 * terminal, sent through the Remote Control bridge, or the SDK host's turn.
 */
const USER_ORIGINS: ReadonlySet<string> = new Set(['composer', 'bridge', 'sdk'])

/**
 * Runs `/clear`, then the handoff's command, as if the person typed them.
 * A failure of either toasts the error and the command to re-type.
 */
const runHandoff = async ($: EngineInterface, handoff: ArcanumNextStepHandoff) => {
  try {
    await $.command.run({ command: 'clear' })
    await $.command.run({ command: handoff.name, args: handoff.args })
  } catch (error) {
    $.ui.toast(`arcanum-next-step: ${messageOf(error)} — run ${handoff.command} manually`)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A headless run (`claude -p`) may exit before the turn's end runs the
    // handoff, so the tool is offered only where a person is at the prompt.
    await $.state.set(interactive, e.isInteractive)
    if (!e.isInteractive) return next(e)

    skills = await listSkills($)

    await $.tool.register({
      name: TOOL_NAME,
      description: DESCRIPTION,
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    })
    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (e.agentId !== undefined) return failure(NOT_MAIN_LOOP)
    const { value: isInteractive = false } = await $.state.get(interactive)
    if (!isInteractive) return failure(NOT_INTERACTIVE)

    skills ??= await listSkills($)
    const handoff = parseHandoff(e.command, skills)
    if (!handoff) return failure(NOT_ARCANUM)

    const { value: current } = await $.state.get(pending)
    if (current) return failure(`a handoff is already pending: ${current.command}`)

    await $.state.set(pending, handoff)
    return { result: scheduled(handoff.command) }
  }).catch(($, e, next) =>
    next.called ? next(e) : failure(`${$.plugin.name}: handoff failed`),
  )

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result

    const { value: handoff } = await $.state.get(pending)
    if (!handoff) return result

    await $.state.set(pending, null)

    if (e.reason !== 'answer') {
      $.ui.toast(CANCELLED)
      return result
    }

    $.clock.after(0, () => {
      void runHandoff($, handoff)
    })
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    if (USER_ORIGINS.has(e.origin.kind)) {
      const { value: handoff } = await $.state.get(pending)
      if (handoff) {
        await $.state.set(pending, null)
        $.ui.toast(CANCELLED)
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}
