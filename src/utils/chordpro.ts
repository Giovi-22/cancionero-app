import { SongLineParsed, SongBlock, transposeChord, isMetadataLine } from './chordUtils';

/**
 * Valida si un string dentro de corchetes representa un acorde musical.
 */
export function isSingleChord(token: string): boolean {
  const chordRegex = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|v|i|[0-9]|sus|add|dim|aug|maj|min)*\d*(?:[b#+-]\d+)?(?:\([^)]+\))?(?:\/[A-G][b#]?)?$/i;
  return chordRegex.test(token.trim());
}

// ─── Directivas ChordPro estándar ────────────────────────────────────────────

interface ChordProDirective {
  key: string;
  value: string | null;
}

/**
 * Parsea una línea de directiva ChordPro: {key: value} o {key}
 * Devuelve null si la línea no es una directiva.
 */
function parseDirective(line: string): ChordProDirective | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  const inside = trimmed.slice(1, -1).trim();
  const colonIdx = inside.indexOf(':');
  if (colonIdx === -1) {
    return { key: inside.toLowerCase().trim(), value: null };
  }
  return {
    key: inside.slice(0, colonIdx).trim().toLowerCase(),
    value: inside.slice(colonIdx + 1).trim() || null,
  };
}

/**
 * Normaliza el nombre de la sección a partir del nombre de directiva.
 * {start_of_verse: VERSO 1} → [VERSO 1]
 * {start_of_chorus}         → [CORO]
 */
function directiveToSectionLabel(key: string, value: string | null): string {
  const aliases: Record<string, string> = {
    start_of_verse:   'VERSO',
    sov:              'VERSO',
    start_of_chorus:  'CORO',
    soc:              'CORO',
    start_of_bridge:  'PUENTE',
    sob:              'PUENTE',
    start_of_tab:     'TABLATURA',
    sot:              'TABLATURA',
    start_of_grid:    'GRILLA',
    start_of_part:    'PARTE',
  };
  // Si el directivo trae el nombre (ej. "VERSO 1"), lo usamos directamente
  if (value) return `[${value}]`;
  // Si no trae nombre, usamos el alias (ej. start_of_chorus → CORO)
  const base = aliases[key] || key.replace('start_of_', '').toUpperCase();
  return `[${base}]`;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parsea un texto ChordPro (estándar o legacy) a la estructura de bloques
 * que consume la interfaz de la aplicación.
 *
 * Soporta:
 *  - Directivas estándar: {title}, {key}, {tempo}, {time}, {capo},
 *    {start_of_verse}, {start_of_chorus}, {start_of_bridge},
 *    {end_of_verse}, {end_of_chorus}, {end_of_bridge},
 *    {comment}, {c}
 *  - Secciones legacy entre corchetes: [VERSO 1], [CORO], [FINAL] X2
 *  - Acordes inline: [A]Texto [G]más texto
 */
export function parseChordPro(text: string): SongLineParsed[] {
  const normalizedText = (text || '').replace(/\r\n/g, '\n');
  const lines = normalizedText.split('\n');
  const result: SongLineParsed[] = [];

  // El título puede venir de {title:} o ser la primera línea de texto
  let titleEmitted = false;
  let inSection = false; // true cuando estamos entre start_of_* y end_of_*

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Línea vacía ────────────────────────────────────────────────────────
    if (!trimmed) {
      result.push({ type: 'text', blocks: [{ text: '' }] });
      continue;
    }

    // ── Directivas ChordPro {key: value} ──────────────────────────────────
    const directive = parseDirective(trimmed);
    if (directive) {
      const { key, value } = directive;

      // Directivas de título: no renderizar como texto en el cuerpo
      if (key === 'title' || key === 't') {
        titleEmitted = true;
        continue;
      }

      // Directiva de Tono ({key: A} o {k: A}): renderizar como Tono: [A] con acorde transponible
      if (key === 'key' || key === 'k') {
        const label = value ? `Tono: [${value}]` : 'Tono:';
        result.push({
          type: 'chords-lyrics',
          isMetadata: true,
          blocks: parseInlineChordLine(label)
        });
        continue;
      }
      if (key === 'tempo' || key === 'bpm') {
        result.push({ type: 'chords-lyrics', isMetadata: true, blocks: [{ text: `BPM: ${value || ''}` }] });
        continue;
      }
      if (key === 'time') {
        result.push({ type: 'chords-lyrics', isMetadata: true, blocks: [{ text: `Compás: ${value || ''}` }] });
        continue;
      }
      if (key === 'capo') {
        result.push({ type: 'chords-lyrics', isMetadata: true, blocks: [{ text: `Capo: ${value || ''}` }] });
        continue;
      }
      if (key === 'artist' || key === 'a') {
        result.push({ type: 'text', blocks: [{ text: value || '' }] });
        continue;
      }

      // Comentarios ({comment: ...} o {c: ...})
      if (key === 'comment' || key === 'c' || key === 'comment_italic' || key === 'ci' || key === 'comment_box' || key === 'cb') {
        const commentText = value || '';
        if (isMetadataLine(commentText)) {
          result.push({ type: 'chords-lyrics', isMetadata: true, blocks: parseInlineChordLine(commentText) });
        } else {
          result.push({
            type: 'section',
            blocks: [{ text: commentText.startsWith('[') ? commentText : `[${commentText}]` }]
          });
        }
        continue;
      }

      // Inicio de sección: start_of_verse, start_of_chorus, etc.
      if (key.startsWith('start_of_') || key === 'sov' || key === 'soc' || key === 'sob' || key === 'sot') {
        inSection = true;
        const label = directiveToSectionLabel(key, value);
        if (result.length > 0 && result[result.length - 1].blocks[0]?.text !== '') {
          result.push({ type: 'text', blocks: [{ text: '' }] });
        }
        result.push({ type: 'section', blocks: [{ text: label }] });
        continue;
      }

      // Fin de sección: end_of_verse, end_of_chorus, etc.
      if (key.startsWith('end_of_') || key === 'eov' || key === 'eoc' || key === 'eob' || key === 'eot') {
        inSection = false;
        if (result.length > 0 && result[result.length - 1].blocks[0]?.text !== '') {
          result.push({ type: 'text', blocks: [{ text: '' }] });
        }
        continue;
      }

      // Directivas ignoradas silenciosamente
      if (['subtitle', 'st', 'columns', 'col', 'new_page', 'np', 'new_song', 'ns',
           'pagetype', 'textfont', 'tf', 'textsize', 'ts', 'chordfont', 'cf',
           'chordsize', 'cs', 'no_grid', 'ng', 'grid', 'g'].includes(key)) {
        continue;
      }

      continue;
    }

    // ── Sección legacy [CORO], [VERSO 1], [FINAL] X2 ────────────────────
    if (trimmed.startsWith('[')) {
      const endBracketIdx = trimmed.indexOf(']');
      if (endBracketIdx !== -1) {
        const inside = trimmed.slice(1, endBracketIdx).trim();
        if (!isSingleChord(inside)) {
          if (result.length > 0 && result[result.length - 1].blocks[0]?.text !== '') {
            result.push({ type: 'text', blocks: [{ text: '' }] });
          }
          result.push({ type: 'section', blocks: [{ text: trimmed }] });
          continue;
        }
      }
    }

    // ── Marcar que el título ya fue procesado para no confundirlo ───
    if (!titleEmitted) {
      if (!isMetadataLine(line) && !trimmed.startsWith('[') && !trimmed.startsWith('{')) {
        titleEmitted = true;
      }
    }

    // ── Línea de metadatos (Intro:, Tono:, BPM:, etc.) ───────────────────
    if (isMetadataLine(line)) {
      result.push({
        type: 'chords-lyrics',
        isMetadata: true,
        blocks: parseInlineChordLine(line),
      });
      continue;
    }

    // ── Línea con acordes inline [A]texto [G]más texto ────────────────────
    const blocks = parseInlineChordLine(line);
    const hasChords = blocks.some(b => b.chord !== undefined);

    result.push({
      type: 'chords-lyrics',
      isMetadata: false,
      blocks,
    });
  }

  return result;
}

/**
 * Parsea una línea con acordes inline [A]texto [G]más texto
 * en un array de SongBlock.
 */
function parseInlineChordLine(line: string): SongBlock[] {
  const blocks: SongBlock[] = [];
  const chordRegex = /\[([^\]]+)\]/g;
  let match;
  const matches: { chord: string; index: number; length: number }[] = [];

  while ((match = chordRegex.exec(line)) !== null) {
    matches.push({ chord: match[1], index: match.index, length: match[0].length });
  }

  if (matches.length === 0) {
    return [{ text: line }];
  }

  // Texto antes del primer acorde
  if (matches[0].index > 0) {
    blocks.push({ text: line.substring(0, matches[0].index) });
  }

  for (let j = 0; j < matches.length; j++) {
    const current = matches[j];
    const startOfText = current.index + current.length;
    const endOfText = j + 1 < matches.length ? matches[j + 1].index : line.length;
    const blockText = line.substring(startOfText, endOfText);
    blocks.push({
      chord: current.chord,
      text: blockText || ' ',
    });
  }

  return blocks;
}

// ─── Transpose ───────────────────────────────────────────────────────────────

export function transposeChordPro(chordProText: string, semitones: number): string {
  if (semitones === 0) return chordProText;

  const lines = chordProText.split('\n');
  return lines.map(line => {
    // No transponemos líneas de metadatos NOTA/TONO/KEY
    const isNoteMetadata = /^(NOTA|TONO|KEY):\s*/i.test(line.trim());
    if (isNoteMetadata) return line;

    // No transponemos directivas de key ({key: C})
    const directive = parseDirective(line.trim());
    if (directive && (directive.key === 'key' || directive.key === 'k')) return line;

    return line.replace(/\[([^\]]+)\]/g, (matchStr, chord) => {
      if (isSingleChord(chord)) {
        return `[${transposeChord(chord, semitones)}]`;
      }
      return matchStr;
    });
  }).join('\n');
}

// ─── Extracción de metadatos desde texto ChordPro ────────────────────────────

/**
 * Extrae el título de un texto ChordPro.
 * Busca primero la directiva {title:}, luego la primera línea de texto.
 */
export function extractTitleFromChordPro(text: string): string | null {
  if (!text) return null;

  // 1. Buscar {title: ...}
  const titleMatch = text.match(/\{\s*(?:title|t)\s*:\s*([^}]+)\}/i);
  if (titleMatch) return titleMatch[1].trim();

  // 2. Buscar primera línea de texto que no sea directiva ni sección
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('{') || t.startsWith('[')) continue;
    if (isMetadataLine(t)) continue;
    return t;
  }

  return null;
}

/**
 * Extrae el valor de la directiva {key:} o la línea "Tono: X".
 */
export function extractKeyFromChordPro(text: string): string | null {
  if (!text) return null;
  const m = text.match(/\{\s*(?:key|k)\s*:\s*([^}]+)\}/i)
    || text.match(/^\s*(?:TONO|KEY):\s*\[?([A-G][b#]?[m]?)\]?/mi);
  return m ? m[1].trim() : null;
}

/**
 * Reconstruye un texto ChordPro limpio a partir de la estructura SongLineParsed[].
 */
export function rebuildChordProFromParsedLines(parsedLines: SongLineParsed[]): string {
  const resultLines: string[] = [];
  if (!Array.isArray(parsedLines)) return '';

  for (const line of parsedLines) {
    if (!line) {
      resultLines.push('');
      continue;
    }

    if (line.type === 'section') {
      const sectionText = (line.blocks || []).map(b => b ? b.text : '').join('').trim();
      if (sectionText) {
        resultLines.push(sectionText.startsWith('[') ? sectionText : `[${sectionText}]`);
      } else {
        resultLines.push('');
      }
      continue;
    }

    let lineStr = '';
    for (const block of (line.blocks || [])) {
      if (!block) continue;
      if (block.chord) {
        lineStr += `[${block.chord}]${block.text || ''}`;
      } else {
        lineStr += block.text || '';
      }
    }
    resultLines.push(lineStr);
  }

  return resultLines.join('\n');
}
