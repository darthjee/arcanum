import { fillTemplate } from '../../../../lib/utils/template/TemplateFiller.js';
import { HOSTILE_VALUE } from '../../../support/fixtures/hostileTemplateValue.js';

describe('fillTemplate', () => {
  it('replaces every known placeholder with its value', () => {
    expect(fillTemplate('%%A%% and %%B%%', { A: 'one', B: 'two' })).toEqual('one and two');
  });

  it('replaces every occurrence of a repeated placeholder', () => {
    expect(fillTemplate('%%A%%-%%A%%', { A: 'x' })).toEqual('x-x');
  });

  it('inserts values verbatim, never interpreting $ patterns, & or \\', () => {
    expect(fillTemplate('[%%A%%]', { A: HOSTILE_VALUE })).toEqual(`[${HOSTILE_VALUE}]`);
  });

  it('never re-scans inserted values, so placeholders inside a value stay literal', () => {
    expect(fillTemplate('%%A%% %%B%%', { A: '%%B%%', B: 'b' })).toEqual('%%B%% b');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(fillTemplate('%%A%% %%OTHER%%', { A: 'a' })).toEqual('a %%OTHER%%');
  });

  it('treats regex metacharacters in placeholder names literally', () => {
    expect(fillTemplate('%%A.B%% %%AxB%%', { 'A.B': 'dot' })).toEqual('dot %%AxB%%');
  });

  it('returns the template unchanged when no values are given', () => {
    expect(fillTemplate('%%A%%', {})).toEqual('%%A%%');
  });
});
