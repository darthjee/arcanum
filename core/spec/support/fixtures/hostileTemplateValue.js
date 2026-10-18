/**
 * The "hostile" substitution value shared by issue #801's specs (native
 * unit and shell-vs-native parity): every `String#replace` replacement
 * pattern (`$&`, `` $` ``, `$'`, `$$`, `$1`), bash ≥ 5.2
 * `patsub_replacement` metacharacters (`&`, `\`, `\\`) and stray
 * placeholders from both template sets. A correct renderer inserts it
 * byte-for-byte. One line, no trailing newline.
 */
const HOSTILE_VALUE = 'a $& b $` c $\' d $$ e $1 f & g \\ h \\\\ i %%SOLUTION%% j %%BODY%%';

export { HOSTILE_VALUE };
