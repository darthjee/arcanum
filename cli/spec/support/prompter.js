import { Interrupted } from '../../lib/prompter.js';

/** A scripted answer that stops the wizard as Ctrl-D would. */
export const EOF = Symbol('EOF');

/** A scripted answer that stops the wizard as Ctrl-C would. */
export const SIGINT = Symbol('SIGINT');

/**
 * A fake prompter answering from a script. Running out of answers is
 * EOF.
 * @param {Array<(string|symbol|((question: string) => unknown))>} answers - the answers in
 *   order: a line, `EOF`, `SIGINT`, or a function called with the
 *   question that returns one of those (or a promise of one).
 * @returns {{ask: (question: string) => Promise<string>, close: () => void, questions: string[], closed: () => boolean}}
 *   the prompter, with the questions it was asked.
 */
export function scriptedPrompter(answers) {
  const queue = [...answers];
  const questions = [];
  let closed = false;

  return {
    questions,
    closed: () => closed,
    async ask(question) {
      questions.push(question);

      let answer = queue.length === 0 ? EOF : queue.shift();

      if (typeof answer === 'function') {
        answer = await answer(question);
      }

      if (answer === EOF) {
        throw new Interrupted('eof');
      }

      if (answer === SIGINT) {
        throw new Interrupted('sigint');
      }

      return answer;
    },
    close() {
      closed = true;
    }
  };
}
