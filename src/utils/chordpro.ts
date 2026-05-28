import { SongLineParsed, SongBlock, transposeChord, isMetadataLine } from './chordUtils';

/**
 * Valida si un string dentro de corchetes representa un acorde musical.
 */
export function isSingleChord(token: string): boolean {
  const chordRegex = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|v|i|[0-9]|sus|add|dim|aug|maj|min)*\d*(?:[b#+-]\d+)?(?:\([^)]+\))?(?:\/[A-G][b#]?)?$/i;
  return chordRegex.test(token.trim());
}

/**
 * Parsea un texto ChordPro a la estructura de bloques que consume la interfaz de la aplicación.
 */
export function parseChordPro(text: string): SongLineParsed[] {
  const normalizedText = (text || '').replace(/\r\n/g, '\n');
  const lines = normalizedText.split('\n');
  const result: SongLineParsed[] = [];
  let isFirstNonEmpty = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      result.push({
        type: 'text',
        blocks: [{ text: '' }]
      });
      continue;
    }

    // 1. Detectar si es el título (primera línea con texto que no sea sección/directiva/acorde/metadato)
    if (isFirstNonEmpty) {
      if (isMetadataLine(line)) {
        // Los metadatos no son el título, seguimos buscando la primera línea con texto real
      } else if (!trimmed.startsWith('[') && !trimmed.startsWith('{') && !line.includes('[')) {
        isFirstNonEmpty = false;
        result.push({
          type: 'section',
          blocks: [{ text: `[TITULO] ${trimmed}` }]
        });
        continue;
      } else {
        // Si el primer bloque real con texto empieza con corchetes o llaves, ya no hay título en texto plano
        isFirstNonEmpty = false;
      }
    }

    // 2. Detectar cabecera de sección legacy o comentarios que empiezan con corchetes: [CORO], [VERSO 1], [CORO] x2
    if (trimmed.startsWith('[')) {
      const endBracketIdx = trimmed.indexOf(']');
      if (endBracketIdx !== -1) {
        const inside = trimmed.slice(1, endBracketIdx).trim();
        if (!isSingleChord(inside)) {
          result.push({
            type: 'section',
            blocks: [{ text: line.trim() }]
          });
          continue;
        }
      }
    }

    // 3. Detectar directivas estándar de ChordPro ({comment: Coro} o {c: Coro})
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inside = trimmed.slice(1, -1).trim();
      const colonIdx = inside.indexOf(':');
      if (colonIdx !== -1) {
        const key = inside.slice(0, colonIdx).trim().toLowerCase();
        const value = inside.slice(colonIdx + 1).trim();
        
        if (key === 'comment' || key === 'c') {
          result.push({
            type: 'section',
            blocks: [{ text: `[${value.toUpperCase()}]` }]
          });
          continue;
        }
      }
    }

    // 4. Parsear acordes y letras incrustados: "Hola [C]mundo [G]"
    const blocks: SongBlock[] = [];
    const chordRegex = /\[([^\]]+)\]/g;
    let match;
    const matches: { chord: string; index: number; length: number }[] = [];

    while ((match = chordRegex.exec(line)) !== null) {
      matches.push({
        chord: match[1],
        index: match.index,
        length: match[0].length
      });
    }

    // Si no contiene acordes en corchetes
    if (matches.length === 0) {
      if (isMetadataLine(line)) {
        result.push({
          type: 'chords-lyrics',
          isMetadata: true,
          blocks: [{ text: line }]
        });
      } else {
        result.push({
          type: 'text',
          blocks: [{ text: line }]
        });
      }
      continue;
    }

    // Agregar texto plano inicial si existe antes del primer acorde
    if (matches[0].index > 0) {
      blocks.push({
        text: line.substring(0, matches[0].index)
      });
    }

    // Procesar cada acorde y el texto que lo acompaña
    for (let j = 0; j < matches.length; j++) {
      const current = matches[j];
      const startOfText = current.index + current.length;
      const endOfText = (j + 1 < matches.length) ? matches[j + 1].index : line.length;
      
      const blockText = line.substring(startOfText, endOfText);
      blocks.push({
        chord: current.chord,
        // Espacio preventivo para que no colapse visualmente el rendering si está vacío
        text: blockText || ' ' 
      });
    }

    result.push({
      type: 'chords-lyrics',
      isMetadata: isMetadataLine(line),
      blocks
    });
  }

  return result;
}

/**
 * Transpone todos los acordes en una cadena en formato ChordPro.
 */
export function transposeChordPro(chordProText: string, semitones: number): string {
  if (semitones === 0) return chordProText;

  return chordProText.replace(/\[([^\]]+)\]/g, (match, chord) => {
    if (isSingleChord(chord)) {
      return `[${transposeChord(chord, semitones)}]`;
    }
    return match;
  });
}
