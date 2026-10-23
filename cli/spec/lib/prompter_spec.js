import { PassThrough } from 'node:stream';
import { Interrupted, createPrompter } from '../../lib/prompter.js';

describe('prompter', () => {
  let input;
  let written;
  let prompter;

  beforeEach(() => {
    input = new PassThrough();
    written = [];
    prompter = createPrompter({ input, output: { write: (text) => written.push(text) } });
  });

  afterEach(() => prompter.close());

  it('writes the question and resolves the typed line', async () => {
    const answer = prompter.ask('name? ');

    input.write('node\n');

    expect(await answer).toBe('node');
    expect(written.join('')).toBe('name? ');
  });

  it('queues lines typed before the question', async () => {
    input.write('one\ntwo\n');
    await new Promise((resolve) => setImmediate(resolve));

    expect(await prompter.ask('a? ')).toBe('one');
    expect(await prompter.ask('b? ')).toBe('two');
    expect(written.join('')).toBe('a? b? ');
  });

  it('rejects with Interrupted (eof) when the input ends', async () => {
    const answer = prompter.ask('name? ');

    input.end();

    await expectAsync(answer).toBeRejectedWith(jasmine.objectContaining({ name: 'Interrupted', reason: 'eof' }));
    await expectAsync(prompter.ask('again? ')).toBeRejectedWithError(Interrupted, 'input closed');
  });

  it('rejects with Interrupted (sigint) when interrupted', async () => {
    const answer = prompter.ask('name? ');

    prompter.interrupt();

    await expectAsync(answer).toBeRejectedWithError(Interrupted, 'interrupted');
  });

  it('rejects with Interrupted (sigint) on the readline SIGINT', async () => {
    const tty = new PassThrough();
    const terminal = createPrompter({ input: tty, output: new PassThrough(), terminal: true });
    const answer = terminal.ask('name? ');

    tty.write('\x03');

    await expectAsync(answer).toBeRejectedWith(jasmine.objectContaining({ reason: 'sigint' }));
    terminal.close();
  });

  it('owns the process SIGINT only while a question is open', async () => {
    const handlers = new Set();
    const signals = { on: (signal, handler) => handlers.add(handler), off: (signal, handler) => handlers.delete(handler) };
    const owned = createPrompter({ input: new PassThrough(), output: new PassThrough(), signals });
    const answer = owned.ask('name? ');

    expect(handlers.size).toBe(1);
    [...handlers][0]();

    await expectAsync(answer).toBeRejectedWith(jasmine.objectContaining({ reason: 'sigint' }));
    expect(handlers.size).toBe(0);
    owned.close();
  });

  it('releases the process SIGINT once answered', async () => {
    const input = new PassThrough();
    const handlers = new Set();
    const signals = { on: (signal, handler) => handlers.add(handler), off: (signal, handler) => handlers.delete(handler) };
    const owned = createPrompter({ input, output: new PassThrough(), signals });
    const answer = owned.ask('name? ');

    input.write('x\n');

    expect(await answer).toBe('x');
    expect(handlers.size).toBe(0);
    owned.close();
  });
});
