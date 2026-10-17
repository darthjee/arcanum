import { describe, expect, test } from 'claude-code/testing'
import { CANCELLED, NOT_MAIN_LOOP, endTurn, handoff, scheduled, startSession, typePrompt, world } from './test-support.ts'

describe('timing', () => {
  test('runs nothing during the call, then /clear and the command once the turn ends', async ($, on) => {
    const w = world(on)
    await startSession($)

    expect(await handoff($, '/discuss-issue 797')).toEqual({ result: scheduled('/discuss-issue 797') })
    await w.clock.settle()
    expect(w.commands).toEqual([])
    expect(w.state.get('pending')).toEqual({
      command: '/discuss-issue 797',
      name: 'discuss-issue',
      args: '797',
    })

    await endTurn($)
    await w.clock.settle()

    expect(w.commands).toEqual([
      { command: 'clear', args: '' },
      { command: 'discuss-issue', args: '797' },
    ])
    expect(w.toasts).toEqual([])
    expect(w.state.get('pending')).toBeNull()
  })

  test('runs a handoff once only', async ($, on) => {
    const w = world(on)
    await startSession($)

    await handoff($, '/discuss-issue 797')
    await endTurn($)
    await endTurn($)
    await w.clock.settle()

    expect(w.commands.length).toBe(2)
  })

  test('does nothing at a turn end with no handoff pending', async ($, on) => {
    const w = world(on)
    await startSession($)

    await endTurn($)
    await endTurn($, 'aborted')
    await w.clock.settle()

    expect(w.commands).toEqual([])
    expect(w.toasts).toEqual([])
  })
})

describe('cancellations', () => {
  for (const reason of ['aborted', 'error'] as const) {
    test(`drops the handoff on a turn that ended ${reason}`, async ($, on) => {
      const w = world(on)
      await startSession($)

      await handoff($, '/discuss-issue 797')
      await endTurn($, reason)
      await w.clock.settle()

      expect(w.commands).toEqual([])
      expect(w.toasts).toEqual([CANCELLED])
      expect(w.state.get('pending')).toBeNull()
    })
  }

  test('drops the handoff on a turn that ended in a refusal', async ($, on) => {
    const w = world(on)
    await startSession($)

    await handoff($, '/discuss-issue 797')
    await $.turn.complete({
      answer: '',
      durationMs: 1,
      isAborted: false,
      turnId: 'turn-1',
      reason: 'refusal',
      refusal: { category: null, explanation: null },
    })
    await w.clock.settle()

    expect(w.commands).toEqual([])
    expect(w.toasts).toEqual([CANCELLED])
  })

  test('drops the handoff when the person submits a prompt while it is pending', async ($, on) => {
    const w = world(on)
    await startSession($)

    await handoff($, '/discuss-issue 797')
    expect(await typePrompt($, 'wait, one more thing')).toEqual({ text: 'wait, one more thing' })
    await endTurn($)
    await w.clock.settle()

    expect(w.commands).toEqual([])
    expect(w.toasts).toEqual([CANCELLED])
  })

  test('leaves a prompt alone when nothing is pending', async ($, on) => {
    const w = world(on)
    await startSession($)

    expect(await typePrompt($, 'hello')).toEqual({ text: 'hello' })
    expect(w.toasts).toEqual([])
  })

  test('keeps the handoff on a prompt that is not the person\'s', async ($, on) => {
    const w = world(on)
    await startSession($)

    await handoff($, '/discuss-issue 797')
    await $.prompt.submit({ text: 'task done', wait: false, origin: { kind: 'task-notification' } })
    await endTurn($)
    await w.clock.settle()

    expect(w.commands.map(c => c.command)).toEqual(['clear', 'discuss-issue'])
  })

  test('rejects a second call and keeps the first', async ($, on) => {
    const w = world(on)
    await startSession($)

    await handoff($, '/discuss-issue 797')
    expect(await handoff($, '/auto-resolve-issue 796')).toEqual({
      deny: 'a handoff is already pending: /discuss-issue 797',
    })
    await endTurn($)
    await w.clock.settle()

    expect(w.commands).toEqual([
      { command: 'clear', args: '' },
      { command: 'discuss-issue', args: '797' },
    ])
  })

  test('denies a call from a subagent', async ($, on) => {
    const w = world(on)
    await startSession($)

    expect(await handoff($, '/discuss-issue 797', 'agent-1')).toEqual({ deny: NOT_MAIN_LOOP })
    await endTurn($)
    await w.clock.settle()

    expect(w.commands).toEqual([])
  })

  test('ignores a subagent\'s turn end and fires on the main loop\'s', async ($, on) => {
    const w = world(on)
    await startSession($)

    await handoff($, '/discuss-issue 797')
    await endTurn($, 'answer', 'agent-1')
    await endTurn($, 'aborted', 'agent-1')
    await w.clock.settle()
    expect(w.commands).toEqual([])
    expect(w.toasts).toEqual([])
    expect(w.state.get('pending')).not.toBeNull()

    await endTurn($)
    await w.clock.settle()
    expect(w.commands.map(c => c.command)).toEqual(['clear', 'discuss-issue'])
  })
})

describe('failure', () => {
  test('toasts the error and the command to re-type when the command fails', async ($, on) => {
    const w = world(on, { failing: { command: 'discuss-issue', message: 'Unknown skill: discuss-issue' } })
    await startSession($)

    await handoff($, '/discuss-issue 797')
    await endTurn($)
    await w.clock.settle()

    expect(w.commands.map(c => c.command)).toEqual(['clear', 'discuss-issue'])
    expect(w.toasts.length).toBe(1)
    expect(w.toasts[0]).toMatch(/^arcanum-next-step: .+ — run \/discuss-issue 797 manually$/)
    expect(w.state.get('pending')).toBeNull()
  })

  test('does not run the command when /clear fails', async ($, on) => {
    const w = world(on, { failing: { command: 'clear', message: 'clear failed' } })
    await startSession($)

    await handoff($, '/discuss-issue 797')
    await endTurn($)
    await w.clock.settle()

    expect(w.commands.map(c => c.command)).toEqual(['clear'])
    expect(w.toasts.length).toBe(1)
    expect(w.toasts[0]).toMatch(/^arcanum-next-step: .+ — run \/discuss-issue 797 manually$/)
  })
})
