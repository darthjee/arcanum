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

const pending = { plugin: 'arcanum-next-step', key: 'pending' } as const

/**
 * The arcanum skills of this install: the sibling folders of the mod's own
 * folder that hold a SKILL.md. Rebuilt on every load, at `session.start`.
 */
let skills: ReadonlySet<string> = new Set()

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
  allowed: ReadonlySet<string> = skills,
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
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

    const handoff = parseHandoff(e.command)
    if (!handoff) return failure(NOT_ARCANUM)

    const { value: current } = await $.state.get(pending)
    if (current) return failure(`a handoff is already pending: ${current.command}`)

    return failure('handoff scheduling is not implemented yet')
  }).catch(($, e, next) =>
    next.called ? next(e) : failure(`${$.plugin.name}: handoff failed`),
  )
}
