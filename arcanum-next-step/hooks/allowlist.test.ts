import { describe, expect, test } from 'claude-code/testing'
import { NOT_ARCANUM, handoff, scheduled, startSession, world } from './test-support.ts'

describe('allowlist', () => {
  for (const command of ['/discuss-issue 797', '/arcanum-check-config next_step.auto', '/loop /auto-resolve-issue 796']) {
    test(`accepts ${command}`, async ($, on) => {
      world(on)
      await startSession($)

      expect(await handoff($, command)).toEqual({ result: scheduled(command) })
    })
  }

  const denied = [
    '/plugin install evil',
    '/config',
    '/permissions',
    '/clear',
    '/other-plugin:command',
    '/core',
    '/arcanum-next-step',
    '/loop /plugin install evil',
    '/loop /clear',
    '/loop discuss-issue',
    '/loop',
    'discuss-issue 797',
    '',
    '   ',
    '/',
  ]
  for (const command of denied) {
    test(`denies ${JSON.stringify(command)}`, async ($, on) => {
      const w = world(on)
      await startSession($)

      expect(await handoff($, command)).toEqual({ deny: NOT_ARCANUM })
      await w.clock.settle()
      await expect($.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })).resolves.toBeDefined()
      await w.clock.settle()
      expect(w.commands).toEqual([])
    })
  }

  test('denies a command that is not a string', async ($, on) => {
    world(on)
    await startSession($)

    expect(await handoff($, 42)).toEqual({ deny: NOT_ARCANUM })
  })

  test('trims, splits at the first whitespace run and keeps args verbatim', async ($, on) => {
    const w = world(on)
    await startSession($)

    expect(await handoff($, '  /loop  /auto-resolve-issue  796 ')).toEqual({
      result: scheduled('/loop  /auto-resolve-issue  796'),
    })
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
    await w.clock.settle()

    expect(w.commands).toEqual([
      { command: 'clear', args: '' },
      { command: 'loop', args: '/auto-resolve-issue  796' },
    ])
  })
})
