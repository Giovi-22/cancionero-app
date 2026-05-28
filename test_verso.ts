import { parseSongToBlocks } from './src/utils/chordUtils';
import * as util from 'util';

const text = `[VERSO 1]
G
Bendice Alma mía al Señor
                          C
Bendiga mi corazón tu santo nombre
         G
Tu santo nombre`;

const parsed = parseSongToBlocks(text);
console.log(util.inspect(parsed, { showHidden: false, depth: null, colors: true }));
