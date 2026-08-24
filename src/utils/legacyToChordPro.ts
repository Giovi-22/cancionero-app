import { cleanSongText, isChordLine, isMetadataLine } from './chordUtils';
import { isSingleChord, extractTitleFromChordPro } from './chordpro';

/**
 * Normaliza y convierte canciones legacy a ChordPro.
 *
 * Responsabilidades:
 * - Preservar canciones que ya están en ChordPro.
 * - Convertir canciones legacy de dos líneas:
 *      A        F#       B
 *      Yo te alabo Señor
 * - Convertir líneas de acordes solas.
 * - Convertir metadatos legacy (Tono, BPM).
 * - Agregar {title: ...} cuando sea necesario.
 *
 * IMPORTANTE:
 * La conversión específica de Google Docs se realiza antes,
 * en el conversor de Google Docs. Esta función no depende
 * de Google Docs.
 */
export function legacyToChordPro(
  rawText: string,
  fallbackTitle?: string
): string {
  if (!rawText) {
    return fallbackTitle
      ? `{title: ${cleanTitle(fallbackTitle)}}\n`
      : '';
  }

  const text = normalizeInput(rawText);

  // ---------------------------------------------------------
  // 1. Ya es ChordPro
  // ---------------------------------------------------------

  if (isChordPro(text)) {
    return ensureTitle(text, fallbackTitle);
  }

  // ---------------------------------------------------------
  // 2. Convertir formato legacy
  // ---------------------------------------------------------

  const lines = text.split('\n');
  const result: string[] = [];

  let titleFound = false;

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const trimmed = currentLine.trim();

    // Línea vacía
    if (!trimmed) {
      result.push('');
      continue;
    }

    // -------------------------------------------------------
    // Título legacy
    // -------------------------------------------------------

    if (
      !titleFound &&
      i === 0 &&
      !isChordLine(currentLine) &&
      !isMetadataLine(currentLine) &&
      !trimmed.startsWith('[')
    ) {
      result.push(`{title: ${trimmed}}`);
      titleFound = true;
      continue;
    }

    // -------------------------------------------------------
    // Secciones legacy
    // Ej: [VERSO 1], [CORO], [FINAL] X2
    // -------------------------------------------------------

    if (isLegacySection(trimmed)) {
      result.push(trimmed);
      continue;
    }

    // -------------------------------------------------------
    // Metadatos
    // -------------------------------------------------------

    if (isMetadataLine(currentLine)) {
      result.push(convertMetadataLineToChordPro(currentLine));
      continue;
    }

    // -------------------------------------------------------
    // Línea de acordes
    // -------------------------------------------------------

    if (isChordLine(currentLine)) {
      const nextLineIndex = findNextContentLine(lines, i + 1);
      const nextLine = nextLineIndex !== -1
        ? lines[nextLineIndex]
        : undefined;

      // Acordes + letra
      if (
        nextLine !== undefined &&
        !isChordLine(nextLine) &&
        !isMetadataLine(nextLine) &&
        !nextLine.trim().startsWith('[')
      ) {
        result.push(
          mergeLineToChordPro(currentLine, nextLine)
        );

        i = nextLineIndex;
        continue;
      }

      // Línea formada solamente por acordes
      result.push(
        formatChordsOnlyToChordPro(currentLine)
      );

      continue;
    }

    // -------------------------------------------------------
    // Texto normal
    // -------------------------------------------------------

    result.push(currentLine);
  }

  // ---------------------------------------------------------
  // 3. Asegurar título
  // ---------------------------------------------------------

  if (!titleFound && fallbackTitle) {
    const title = cleanTitle(fallbackTitle);

    if (!result.some(line => /^\{\s*title\s*:/i.test(line))) {
      result.unshift(`{title: ${title}}`);
    }
  }

  return cleanSongText(result.join('\n'));
}

/**
 * Normaliza saltos de línea y espacios exteriores.
 */
function normalizeInput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Determina si el contenido ya está en formato ChordPro.
 *
 * Consideramos ChordPro si contiene:
 * - Una directiva ChordPro válida.
 * - O al menos un acorde entre corchetes.
 */
function isChordPro(text: string): boolean {
  const hasDirective =
    /\{\s*(title|t|subtitle|st|artist|a|key|k|tempo|bpm|time|capo|comment|c|start_of_\w+|end_of_\w+|sov|soc|eov|eoc)\b/i
      .test(text);

  const hasBracketedChord =
    /\[[A-G][b#]?(?:m|maj|min|dim|aug|sus|add)?(?:\d+)?(?:\/[A-G][b#]?)?\]/i
      .test(text);

  return hasDirective || hasBracketedChord;
}

/**
 * Agrega un título únicamente cuando no existe.
 */
function ensureTitle(
  text: string,
  fallbackTitle?: string
): string {
  if (!fallbackTitle) {
    return cleanSongText(text);
  }

  const existingTitle = extractTitleFromChordPro(text);

  if (existingTitle) {
    return cleanSongText(text);
  }

  const title = cleanTitle(fallbackTitle);

  return cleanSongText(
    `{title: ${title}}\n\n${text}`
  );
}

/**
 * Limpia el nombre utilizado como título.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\.(chordpro|pro|cho|chopro|crd|txt)$/i, '')
    .trim();
}

/**
 * Determina si una línea legacy es una sección.
 *
 * No considera [A], [F#m], etc. como sección.
 */
function isLegacySection(line: string): boolean {
  if (!line.startsWith('[')) return false;

  const endBracket = line.indexOf(']');

  if (endBracket === -1) return false;

  const inside = line
    .slice(1, endBracket)
    .trim();

  return !isSingleChord(inside);
}

/**
 * Busca la siguiente línea con contenido.
 */
function findNextContentLine(
  lines: string[],
  startIndex: number
): number {
  for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].trim()) {
      return i;
    }
  }

  return -1;
}

/**
 * Convierte metadatos legacy a ChordPro.
 *
 * Ej:
 *   Tono: C      → {key: C}
 *   BPM: 120     → {tempo: 120}
 */
function convertMetadataLineToChordPro(
  line: string
): string {
  const keyMatch = line.match(
    /^Tono:\s*([A-G][b#]?[m]?)/i
  );

  if (keyMatch) {
    return `{key: ${keyMatch[1]}}`;
  }

  const bpmMatch = line.match(
    /^BPM:\s*(\d+)/i
  );

  if (bpmMatch) {
    return `{tempo: ${bpmMatch[1]}}`;
  }

  return line.replace(/\S+/g, token => {
    if (
      token.includes(':') ||
      /^[xX]\d+$/.test(token)
    ) {
      return token;
    }

    if (isSingleChord(token)) {
      return `[${token}]`;
    }

    return token;
  });
}

/**
 * Convierte una línea que contiene únicamente acordes
 * a ChordPro.
 *
 * Ej:
 *   A - F# - B
 *
 * → [A] - [F#] - [B]
 */
function formatChordsOnlyToChordPro(
  line: string
): string {
  return line.replace(
    /\S+/g,
    token => `[${token}]`
  );
}

/**
 * Fusiona una línea de acordes con la línea de letra
 * respetando la posición horizontal de cada acorde.
 *
 * Ej:
 *
 *   A       F#      B
 *   Yo      te      alabo
 *
 * →
 *
 *   [A]Yo  [F#]te  [B]alabo
 */
function mergeLineToChordPro(
  chordLine: string,
  lyricLine: string
): string {
  const chordRegex = /\S+/g;

  const chords: Array<{
    chord: string;
    index: number;
  }> = [];

  let match: RegExpExecArray | null;

  while ((match = chordRegex.exec(chordLine)) !== null) {
    chords.push({
      chord: match[0],
      index: match.index,
    });
  }

  if (chords.length === 0) {
    return lyricLine;
  }

  // Insertamos desde el final para no alterar
  // las posiciones de los acordes anteriores.
  chords.sort((a, b) => b.index - a.index);

  let result = lyricLine;

  for (const chord of chords) {
    if (chord.index > result.length) {
      result += ' '.repeat(
        chord.index - result.length
      );
    }

    let insertAt = chord.index;

    // Si el acorde cae dentro de una palabra,
    // retrocedemos hasta el comienzo de esa palabra.
    if (
      insertAt < result.length &&
      result[insertAt] !== ' '
    ) {
      while (
        insertAt > 0 &&
        result[insertAt - 1] !== ' '
      ) {
        insertAt--;
      }
    }

    result =
      result.substring(0, insertAt) +
      `[${chord.chord}]` +
      result.substring(insertAt);
  }

  return result;
}