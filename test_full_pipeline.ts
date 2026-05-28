import { trimCommonIndentation, transposeText, cleanSongText, parseSongToBlocks } from './src/utils/chordUtils';
import * as util from 'util';

// Simular exactamente lo que llega de Google Docs con tabs
// Un Tab (\t) antes de "C" para posicionarla visualmente
const rawText = `[VERSO 1]
G
Bendice Alma mía al Señor
\t\t\t\tC
Bendiga mi corazón tu santo nombre
\t\t\tG
Tu santo nombre`;

console.log("=== TEXTO ORIGINAL (con \\t visible) ===");
console.log(rawText.replace(/\t/g, '[TAB]'));
console.log();

const cleaned = cleanSongText(rawText);
console.log("=== DESPUES DE cleanSongText ===");
cleaned.split('\n').forEach((line, i) => console.log(`[${i}] "${line}"`));
console.log();

const transposed = transposeText(cleaned, 0);
const trimmed = trimCommonIndentation(transposed);
console.log("=== DESPUES DE trimCommonIndentation ===");
trimmed.split('\n').forEach((line, i) => console.log(`[${i}] "${line}"`));
console.log();

const parsed = parseSongToBlocks(trimmed);
console.log("=== BLOQUES PARSEADOS ===");
console.log(util.inspect(parsed, { showHidden: false, depth: null, colors: true }));
