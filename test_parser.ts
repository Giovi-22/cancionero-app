import { parseSongToBlocks } from './src/utils/chordUtils';
import * as util from 'util';

const text = `[VERSO 1]
G
Bendice Alma mía al Señor
                          C
Bendiga mi corazón tu santo nombre
         G
Tu santo nombre

[PRE CORO]
Am             C             G
Tu amor y tu misericordia no acabarán
Am             C             G
Tu gracia y tu bondad me seguirán`;

const parsed = parseSongToBlocks(text);
console.log(util.inspect(parsed, { showHidden: false, depth: null, colors: true }));
