const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const METADATA_LABELS = 'Intro|Solo|Outro|Puente|Bridge|Instrumental|Tono|BPM|Compás|NOTA|Note|Final|Interludio|Estrofa|Coro|Chorus|Verse|Acordes|Key|Tempo|Capo';
const METADATA_REGEX = new RegExp(`^(${METADATA_LABELS}):\\s*`, 'i');

export interface SongBlock {
  chord?: string;
  text: string;
}

export interface SongLineParsed {
  type: 'chords-lyrics' | 'text' | 'section';
  blocks: SongBlock[];
  isMetadata?: boolean;
}

function getNoteIndex(note: string): number {
  const normalizedNote = note.charAt(0).toUpperCase() + note.slice(1);
  let index = NOTES_SHARP.indexOf(normalizedNote);
  if (index === -1) {
    index = NOTES_FLAT.indexOf(normalizedNote);
  }
  return index;
}

export function transposeChord(chord: string, semitones: number): string {

  // Soporta:
  // C
  // Cmaj7
  // C/E
  // Cmaj7/E
  // F#m7b5/A
  const match = chord.match(
    /^([A-G][b#]?)([^\/]*)(?:\/([A-G][b#]?))?$/
  );

  if (!match) return chord;

  const [, rootNote, suffix, bassNote] = match;

  const transposedRoot = transposeNote(rootNote, semitones);

  if (bassNote) {

    const transposedBass = transposeNote(bassNote, semitones);

    return `${transposedRoot}${suffix}/${transposedBass}`;
  }

  return `${transposedRoot}${suffix}`;
}

function transposeNote(note: string, semitones: number): string {
  const index = getNoteIndex(note);
  if (index === -1) return note;

  let newIndex = (index + semitones) % 12;
  if (newIndex < 0) newIndex += 12;

  return note.includes('b') ? NOTES_FLAT[newIndex] : NOTES_SHARP[newIndex];
}

/**
 * Normaliza notaciones no estándar: "Cm#" -> "C#m", "Gm#" -> "G#m".
 * Es la ÚNICA definición; usarla en todos los módulos que lean acordes.
 */
export function normalizeChord(token: string): string {
  return token.replace(/^([A-G])(m|min)([#b])/, '$1$3$2');
}

export function isMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return METADATA_REGEX.test(trimmed);
}

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Lines starting with '[' are section headers, never chord lines
  if (trimmed.startsWith('[')) return false;

  const chordRegex = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|v|i|[0-9]|sus|add|dim|aug|maj|min)*\d*(?:[b#+-]\d+)?(?:\([^)]+\))?(?:\/[A-G][b#]?)?$/i;

  const cleanTrimmed = trimmed.replace(METADATA_REGEX, '');
  if (!cleanTrimmed) return false;

  const tokens = cleanTrimmed.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  let totalEvaluated = 0;

  for (const token of tokens) {
    if (/^[:|/\\-]{1,4}$/.test(token)) {
      chordCount++;
      totalEvaluated++;
      continue;
    }

    if (token.includes('-')) {
      const subTokens = token.split(/-+/).filter(Boolean);
      for (const sub of subTokens) {
        totalEvaluated++;
        if (chordRegex.test(normalizeChord(sub))) {
          chordCount++;
        }
      }
      continue;
    }

    totalEvaluated++;
    if (chordRegex.test(normalizeChord(token))) {
      chordCount++;
    }
  }

  return totalEvaluated > 0 && chordCount / totalEvaluated >= 0.5;
}

export function cleanSongText(text: string): string {
  if (!text) return '';

  let cleaned = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => {
      // Expansión dinámica de tabulaciones (tab stops cada 8 caracteres)
      let result = '';
      let col = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '\t') {
          const spaces = 8 - (col % 8);
          result += ' '.repeat(spaces);
          col += spaces;
        } else {
          result += line[i];
          col++;
        }
      }
      return result.trimEnd();
    })
    .join('\n');

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  const lines = cleaned.split('\n');
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isSectionHeader = line.trim().startsWith('[');

    if (isSectionHeader && i > 0 && resultLines[resultLines.length - 1] !== '') {
      resultLines.push('');
    }

    resultLines.push(line);
  }

  return resultLines.join('\n').trim();
}
