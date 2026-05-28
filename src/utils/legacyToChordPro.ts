import { cleanSongText, isChordLine, isMetadataLine } from './chordUtils';
import { isSingleChord } from './chordpro';

/**
 * Convierte texto legacy (acordes en línea superior) a ChordPro semántico.
 * Si el texto ya tiene formato ChordPro, lo devuelve sin alteraciones.
 */
export function legacyToChordPro(legacyText: string): string {
  // Evitar doble conversión si ya tiene formato ChordPro básico con acordes reales
  let hasBracketedChords = false;
  const bracketMatches = legacyText.match(/\[([^\]]+)\]/g);
  if (bracketMatches) {
    for (const m of bracketMatches) {
      const inside = m.slice(1, -1).trim();
      if (isSingleChord(inside)) {
        hasBracketedChords = true;
        break;
      }
    }
  }
  if (hasBracketedChords) {
    return legacyText;
  }

  const cleaned = cleanSongText(legacyText);
  const lines = cleaned.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];

    // Si es una línea de metadatos (Intro, Tono, BPM, etc.)
    if (isMetadataLine(currentLine)) {
      result.push(convertMetadataLineToChordPro(currentLine));
      continue;
    }

    if (isChordLine(currentLine)) {
      // Intentar encontrar la línea de letra siguiente, salteando líneas vacías
      let lyricLineIndex = i + 1;
      while (lyricLineIndex < lines.length && lines[lyricLineIndex].trim() === '') {
        lyricLineIndex++;
      }

      const potentialLyricLine = lines[lyricLineIndex];

      if (
        potentialLyricLine !== undefined &&
        !isChordLine(potentialLyricLine) &&
        !isMetadataLine(potentialLyricLine) &&
        !potentialLyricLine.trim().startsWith('[')
      ) {
        // Combinamos la línea de acordes y la de letra
        result.push(mergeLineToChordPro(currentLine, potentialLyricLine));
        i = lyricLineIndex; // Saltamos hasta la línea de letra
        continue;
      }

      // Si no hay línea de letra válida, procesamos solo los acordes
      result.push(mergeLineToChordPro(currentLine, ''));
      continue;
    }

    // Si es cabecera de sección, directiva o texto plano, dejar intacto
    result.push(currentLine);
  }

  return result.join('\n');
}

/**
 * Convierte una línea de metadatos (como Intro, Tono, BPM, Compás, Nota) a ChordPro
 * envolviendo únicamente los acordes válidos en corchetes y dejando el resto como texto plano.
 */
function convertMetadataLineToChordPro(line: string): string {
  return line.replace(/\S+/g, (token) => {
    // Si el token contiene símbolos de acorde pero tiene caracteres como ":" (ej. "Intro:"), no es un acorde
    if (token.includes(':')) {
      return token;
    }
    
    // Si el token es un acorde válido (como C, F#m, G/B), lo encerramos en corchetes
    if (isSingleChord(token)) {
      return `[${token}]`;
    }
    
    // De lo contrario lo dejamos como texto plano (como -, 4/4, 100, etc.)
    return token;
  });
}

/**
 * Une una línea de acordes con una línea de letra en formato ChordPro posicionando
 * cada acorde en su índice exacto.
 */
function mergeLineToChordPro(chordLine: string, lyricLine: string): string {
  const chordRegex = /\S+/g;
  let match;
  const chords: { chord: string; index: number }[] = [];
  while ((match = chordRegex.exec(chordLine)) !== null) {
    chords.push({ chord: match[0], index: match.index });
  }

  if (chords.length === 0) {
    return lyricLine;
  }

  // Ordenar acordes de atrás hacia adelante para que las inserciones no alteren los índices previos
  chords.sort((a, b) => b.index - a.index);

  let result = lyricLine;
  for (const c of chords) {
    if (c.index > result.length) {
      result = result + ' '.repeat(c.index - result.length);
    }
    result = result.substring(0, c.index) + `[${c.chord}]` + result.substring(c.index);
  }

  return result;
}
