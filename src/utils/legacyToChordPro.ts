import { cleanSongText, isChordLine, isMetadataLine } from './chordUtils';
import { isSingleChord, extractTitleFromChordPro } from './chordpro';

/**
 * Convierte cualquier formato (legacy 2 líneas, Google Docs, etc.) a formato ChordPro estándar.
 * Si el texto ya es ChordPro válido con acordes en corchetes [Acorde] o directivas {...},
 * se preserva la estructura ChordPro y se asegura de incluir la directiva {title: ...} si falta.
 */
export function legacyToChordPro(rawText: string, fallbackTitle?: string): string {
  if (!rawText) return fallbackTitle ? `{title: ${fallbackTitle}}\n` : '';

  const normalizedText = rawText.replace(/\r\n/g, '\n').trim();

  // 1. Normalizar etiquetas legacy como [TITULO] a {title: ...}
  let text = normalizedText.replace(/^\[TITULO\]\s*(.*)$/gmi, '{title: $1}');

  // 2. Verificar si ya contiene directivas ChordPro o acordes entre corchetes
  const hasDirectives = /\{\s*(title|t|key|k|tempo|bpm|start_of_\w+|sov|soc|sob)\s*[:\}]/i.test(text);
  const hasBracketedChords = /\[[A-G][b#]?[^\]]*\]/.test(text);

  if (hasDirectives || hasBracketedChords) {
    // Ya es un documento ChordPro.
    // Verificamos si tiene {title: ...}. Si no lo tiene y se pasó fallbackTitle, lo agregamos arriba.
    const existingTitle = extractTitleFromChordPro(text);
    if (!existingTitle && fallbackTitle) {
      const cleanTitle = fallbackTitle.replace(/\.(chordpro|pro|cho|chopro|crd|txt)$/i, '');
      text = `{title: ${cleanTitle}}\n\n` + text;
    }
    return cleanSongText(text);
  }

  // 3. Si es formato Legacy de 2 líneas (Línea de acordes + Línea de letras):
  const lines = text.split('\n');
  const result: string[] = [];

  let titleFound = false;

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const trimmed = currentLine.trim();

    if (!trimmed) {
      result.push('');
      continue;
    }

    // Si es la primera línea no vacía y no es ni acorde ni sección ni metadato,
    // y no hemos registrado título aún
    if (!titleFound && i === 0 && !isChordLine(currentLine) && !isMetadataLine(currentLine) && !trimmed.startsWith('[')) {
      result.push(`{title: ${trimmed}}`);
      titleFound = true;
      continue;
    }

    // Secciones entre corchetes [VERSO 1], [CORO]
    if (trimmed.startsWith('[')) {
      result.push(trimmed);
      continue;
    }

    // Metadatos (Tono: C, BPM: 120, etc.)
    if (isMetadataLine(currentLine)) {
      const metadataFormatted = convertMetadataLineToChordPro(currentLine);
      result.push(metadataFormatted);
      continue;
    }

    // Línea de acordes sueltos
    if (isChordLine(currentLine)) {
      // Buscar siguiente línea de letra
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
        result.push(mergeLineToChordPro(currentLine, potentialLyricLine));
        i = lyricLineIndex;
        continue;
      }

      // Si no hay letra siguiente, formatear solo los acordes como [Acorde1] [Acorde2]
      result.push(formatChordsOnlyToChordPro(currentLine));
      continue;
    }

    // Línea de texto plano
    result.push(currentLine);
  }

  // Si no se encontró título en el contenido pero viene fallbackTitle, añadirlo al inicio
  if (!titleFound && fallbackTitle && !result.some(l => l.startsWith('{title:'))) {
    const cleanTitle = fallbackTitle.replace(/\.(chordpro|pro|cho|chopro|crd|txt)$/i, '');
    result.unshift(`{title: ${cleanTitle}}\n`);
  }

  return cleanSongText(result.join('\n'));
}

function convertMetadataLineToChordPro(line: string): string {
  const keyMatch = line.match(/^Tono:\s*([A-G][b#]?[m]?)/i);
  if (keyMatch) {
    return `{key: ${keyMatch[1]}}`;
  }
  const bpmMatch = line.match(/^BPM:\s*(\d+)/i);
  if (bpmMatch) {
    return `{tempo: ${bpmMatch[1]}}`;
  }
  return line.replace(/\S+/g, (token) => {
    if (token.includes(':') || /^[xX]\d+$/.test(token)) return token;
    if (isSingleChord(token)) return `[${token}]`;
    return token;
  });
}

function formatChordsOnlyToChordPro(line: string): string {
  const chordRegex = /\S+/g;
  let match;
  let result = '';
  let lastIndex = 0;
  while ((match = chordRegex.exec(line)) !== null) {
    const spaceBefore = line.substring(lastIndex, match.index);
    result += `${spaceBefore}[${match[0]}]`;
    lastIndex = match.index + match[0].length;
  }
  return result;
}

function mergeLineToChordPro(chordLine: string, lyricLine: string): string {
  const chordRegex = /\S+/g;
  let match;
  const chords: { chord: string; index: number }[] = [];
  while ((match = chordRegex.exec(chordLine)) !== null) {
    chords.push({ chord: match[0], index: match.index });
  }

  if (chords.length === 0) return lyricLine;

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
