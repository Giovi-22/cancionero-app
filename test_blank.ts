import { parseSongToBlocks } from './src/utils/chordUtils';
import * as util from 'util';

const text = `[PRE CORO]
Am             C             G

Tu amor y tu misericordia no acabarán`;

const parsed = parseSongToBlocks(text);
console.log(util.inspect(parsed, { showHidden: false, depth: null, colors: true }));
