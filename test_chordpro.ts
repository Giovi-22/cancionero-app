import { legacyToChordPro } from './src/utils/legacyToChordPro';
import { parseChordPro, transposeChordPro } from './src/utils/chordpro';
import * as util from 'util';

const rawLegacyText = `Intro: C - F - G
Tono: C
BPM: 100
Compás: 4/4
Nota: -

A CRISTO CORONAD - H236

[VERSO 1]
G
Bendice Alma mía al Señor
                      C
Bendiga mi corazón tu santo nombre
         G
Tu santo nombre

[PRE CORO] x2
Am             C             G
Tu amor y tu misericordia no acabarán
Am             C             G
Tu gracia y tu bondad me seguirán`;

console.log("=== 1. CONVERTIR LEGACY A CHORDPRO ===");
const chordProText = legacyToChordPro(rawLegacyText);
console.log(chordProText);
console.log("\n======================================\n");

console.log("=== 2. PARSEAR CHORDPRO GENERADO ===");
const parsedChordPro = parseChordPro(chordProText);
console.log(util.inspect(parsedChordPro, { showHidden: false, depth: null, colors: true }));
console.log("\n======================================\n");

console.log("=== 3. TRANSPONER EN CHORDPRO ( +2 semitonos ) ===");
const transposedChordPro = transposeChordPro(chordProText, 2);
console.log(transposedChordPro);
console.log("\n======================================\n");

console.log("=== 4. PARSEAR CHORDPRO TRANSPUESTO ===");
const parsedTransposed = parseChordPro(transposedChordPro);
console.log(util.inspect(parsedTransposed, { showHidden: false, depth: null, colors: true }));
console.log("\n======================================\n");
