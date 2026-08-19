import { cleanSongText, isChordLine, isMetadataLine } from './chordUtils';
import { isSingleChord } from './chordpro';

// Regex to detect repetition markers like X2, x3, etc.
const REPEAT_MARKER_REGEX = /^[xX]\d+$/;

/**
 * Normaliza directivas de ChordPro con llaves {...} a texto plano limpio o etiquetas legacy:
 * {title: A QUIÉN IRÉ} -> [TITULO] A QUIÉN IRÉ
 * {key: C} -> Tono: C
 * {tempo: 68} -> BPM: 68
 * {time: 4/4} -> Compás: 4/4
 * {start_of_verse: VERSO 1 X2} -> [VERSO 1 X2]
 * {end_of_verse} -> (eliminado)
 */
function normalizeDirectives(text: string): string {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inside = trimmed.slice(1, -1).trim();
      const colonIdx = inside.indexOf(':');
      let key = inside.toLowerCase();
      let val = '';
      if (colonIdx !== -1) {
        key = inside.slice(0, colonIdx).trim().toLowerCase();
        val = inside.slice(colonIdx + 1).trim();
      }

      if (key === 'title' || key === 't') {
        if (val) result.push(`[TITULO] ${val}`);
        continue;
      }
      if (key === 'key' || key === 'k') {
        if (val) result.push(`Tono: ${val}`);
        continue;
      }
      if (key === 'tempo' || key === 'bpm') {
        if (val) result.push(`BPM: ${val}`);
        continue;
      }
      if (key === 'time') {
        const noteMatch = val.match(/^(.*?)(Nota:.*)$/i);
        if (noteMatch) {
          result.push(`Compás: ${noteMatch[1].trim()}`);
          result.push(`NOTA: ${noteMatch[2].replace(/^Nota:\s*/i, '').trim()}`);
        } else {
          result.push(`Compás: ${val}`);
        }
        continue;
      }
      if (key === 'capo') {
        if (val) result.push(`Capo: ${val}`);
        continue;
      }
      if (key === 'comment' || key === 'c') {
        if (val) result.push(val);
        continue;
      }
      if (key.startsWith('start_of_') || ['sov', 'soc', 'sob', 'sot'].includes(key)) {
        let label = val;
        if (!label) {
          const sectionMap: Record<string, string> = {
            start_of_verse: 'VERSO', sov: 'VERSO',
            start_of_chorus: 'CORO', soc: 'CORO',
            start_of_bridge: 'PUENTE', sob: 'PUENTE',
            start_of_tab: 'TABLATURA', sot: 'TABLATURA'
          };
          label = sectionMap[key] || key.replace('start_of_', '').toUpperCase();
        }
        result.push(label.startsWith('[') ? label : `[${label}]`);
        continue;
      }
      if (key.startsWith('end_of_') || ['eov', 'eoc', 'eob', 'eot'].includes(key)) {
        // Ignorar cierres de sección para que no agreguen ruido visual ni llaves
        continue;
      }
      // Ignorar directivas de formato no deseadas silenciosamente
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Convierte texto legacy o ChordPro con llaves a un formato ChordPro limpio y unificado,
 * garantizando que los acordes queden posicionados sobre la letra y se mantenga la estética original.
 */
export function legacyToChordPro(legacyText: string): string {
  if (!legacyText) return '';

  // 1. Limpiar y normalizar cualquier directiva {key: ...} a formato legible
  const textNormalized = normalizeDirectives(legacyText);

  const cleaned = cleanSongText(textNormalized);
  const lines = cleaned.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];

    // Si la línea contiene una etiqueta de sección '[...]' opcionalmente seguida por repetición 'X2'
    const sectionTagMatch = currentLine.trim().match(/^(\[[^\]]+\])(.*)$/);
    if (sectionTagMatch) {
      const tag = sectionTagMatch[1]; // ej. [FINAL]
      const remainder = sectionTagMatch[2].trim(); // ej. X2
      if (remainder && REPEAT_MARKER_REGEX.test(remainder)) {
        result.push(`${tag} ${remainder}`);
      } else if (remainder) {
        result.push(`${tag} ${remainder}`);
      } else {
        result.push(tag);
      }
      continue;
    }

    // Si es una línea de metadatos (Intro, Tono, BPM, Compás, NOTA)
    if (isMetadataLine(currentLine)) {
      result.push(convertMetadataLineToChordPro(currentLine));
      continue;
    }

    // Si es una línea de acordes sin corchetes
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

    // Si es texto plano o línea con acordes en corchetes [C], dejar intacto
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
    if (token.includes(':')) {
      return token;
    }
    if (REPEAT_MARKER_REGEX.test(token)) {
      return token;
    }
    if (isSingleChord(token)) {
      return `[${token}]`;
    }
    return token;
  });
}

/**
 * Une una línea de acordes con una línea de letra en formato ChordPro posicionando
 * cada acorde en su índice de columna. Si el índice cae en medio de una palabra,
 * el acorde se desplaza hacia atrás hasta el inicio de esa palabra para no partirla.
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

  chords.sort((a, b) => b.index - a.index);

  let result = lyricLine;
  for (const c of chords) {
    if (c.index > result.length) {
      result = result + ' '.repeat(c.index - result.length);
    }
    let insertAt = c.index;
    if (insertAt < result.length && result[insertAt] !== ' ') {
      while (insertAt > 0 && result[insertAt - 1] !== ' ') {
        insertAt--;
      }
    }
    result = result.substring(0, insertAt) + `[${c.chord}]` + result.substring(insertAt);
  }

  return result;
}
