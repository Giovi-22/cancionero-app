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

export function isMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return METADATA_REGEX.test(trimmed);
}

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const chordRegex = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|v|i|[0-9]|sus|add|dim|aug|maj|min)*\d*(?:[b#+-]\d+)?(?:\([^)]+\))?(?:\/[A-G][b#]?)?$/i;

  const cleanTrimmed = trimmed.replace(METADATA_REGEX, '');
  if (!cleanTrimmed) return false;

  const tokens = cleanTrimmed.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const token of tokens) {
    if (chordRegex.test(token) || /^[:|/\\-]{1,4}$/.test(token)) {
      chordCount++;
    }
  }

  return chordCount / tokens.length >= 0.5;
}

export function transposeText(text: string, semitones: number): string {
  if (semitones === 0) return text;

  const lines = text.split('\n');
  const transposedLines = lines.map(line => {
    if (isChordLine(line)) {
      const labelMatch = line.match(METADATA_REGEX);
      let prefix = '';
      let rest = line;

      if (labelMatch) {
        prefix = labelMatch[0];
        rest = line.substring(labelMatch[0].length);
      }

      const parts = rest.split(/(\s+)/);
      const transposedRest = parts.map(part => {
        if (part.trim() && /^[A-G][b#]?[^\s]*$/i.test(part.trim())) {
          return transposeChord(part.trim(), semitones);
        }
        return part;
      }).join('');

      return prefix + transposedRest;
    }
    return line;
  });

  return transposedLines.join('\n');
}

export function trimCommonIndentation(text: string): string {
  const lines = text.split('\n');
  const minIndent = lines.reduce((min, line) => {
    if (line.trim().length === 0) return min;
    const match = line.match(/^\s*/);
    const indent = match ? match[0].length : 0;
    return Math.min(min, indent);
  }, Infinity);

  if (minIndent === Infinity || minIndent === 0) return text;

  return lines
    .map(line => line.length >= minIndent ? line.substring(minIndent) : line.trim())
    .join('\n');
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

export function parseSongToBlocks(text: string): SongLineParsed[] {
  const lines = text.split('\n');
  const result: SongLineParsed[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];

    if (i === 0 && currentLine.trim() !== '' && !isChordLine(currentLine) && !currentLine.trim().startsWith('[')) {
      result.push({
        type: 'section',
        blocks: [{ text: `[TITULO] ${currentLine.trim()}` }]
      });
      continue;
    }

    if (isChordLine(currentLine)) {
      // Look ahead to find the lyric line, skipping empty lines
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
        result.push(parseChordsAndLyrics(currentLine, potentialLyricLine));
        i = lyricLineIndex; // Skip the blank lines and the lyric line
        continue;
      }

      // If no valid lyric line was found, treat it as chords only
      result.push({
        type: 'chords-lyrics',
        isMetadata: isMetadataLine(currentLine),
        blocks: parseChordsOnly(currentLine)
      });
      continue;
    }

    if (currentLine.trim().startsWith('[')) {
      result.push({
        type: 'section',
        blocks: [{ text: currentLine.trim() }]
      });
      continue;
    }

    result.push({
      type: 'text',
      blocks: [{ text: currentLine }]
    });
  }

  return result;
}

function parseChordsAndLyrics(chordLine: string, lyricLine: string): SongLineParsed {
  const blocks: SongBlock[] = [];
  const chordRegex = /\S+/g;
  let match;
  const chords: { chord: string; index: number }[] = [];
  while ((match = chordRegex.exec(chordLine)) !== null) {
    chords.push({ chord: match[0], index: match.index });
  }

  if (chords.length === 0) {
    return { type: 'text', blocks: [{ text: lyricLine }] };
  }

  // 1. Identificar bloques de palabras en la línea de letra
  const wordBlocks: { text: string; start: number; end: number; chords: { chord: string; relIndex: number }[] }[] = [];
  
  // Agregar espacios iniciales como un bloque si existen
  const leadingSpacesMatch = lyricLine.match(/^\s+/);
  if (leadingSpacesMatch) {
    wordBlocks.push({
      text: leadingSpacesMatch[0],
      start: 0,
      end: leadingSpacesMatch[0].length,
      chords: []
    });
  }

  const wordRegex = /\S+\s*/g;
  while ((match = wordRegex.exec(lyricLine)) !== null) {
    wordBlocks.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      chords: []
    });
  }

  if (wordBlocks.length === 0) {
    wordBlocks.push({
      text: lyricLine || ' ',
      start: 0,
      end: Math.max(1, lyricLine.length),
      chords: []
    });
  }

  // 2. Asignar cada acorde a su bloque de palabra correspondiente
  for (const c of chords) {
    let assigned = false;
    
    for (const w of wordBlocks) {
      if (c.index >= w.start && c.index < w.end) {
        w.chords.push({ chord: c.chord, relIndex: c.index - w.start });
        assigned = true;
        break;
      }
    }
    
    if (!assigned) {
      const lastBlock = wordBlocks[wordBlocks.length - 1];
      if (c.index >= lastBlock.end) {
        const extraSpaces = c.index - lastBlock.end;
        lastBlock.text += " ".repeat(extraSpaces);
        lastBlock.end = c.index;
      }
      lastBlock.chords.push({ chord: c.chord, relIndex: c.index - lastBlock.start });
    }
  }

  // 3. Crear los SongBlocks finales
  for (const w of wordBlocks) {
    if (w.chords.length === 0) {
      blocks.push({ text: w.text });
      continue;
    }

    w.chords.sort((a, b) => a.relIndex - b.relIndex);

    let combinedChord = "";
    let lastChordEnd = 0;

    for (let j = 0; j < w.chords.length; j++) {
      const c = w.chords[j];
      const gap = c.relIndex - lastChordEnd;
      if (gap > 0) {
        combinedChord += " ".repeat(gap);
      }
      combinedChord += c.chord;
      lastChordEnd = c.relIndex + c.chord.length;
    }

    blocks.push({
      chord: combinedChord,
      text: w.text
    });
  }

  return { type: 'chords-lyrics', blocks };
}

function parseChordsOnly(line: string): SongBlock[] {
  const blocks: SongBlock[] = [];
  const labelMatch = line.match(METADATA_REGEX);
  let processLine = line;

  if (labelMatch) {
    blocks.push({ text: labelMatch[0] });
    processLine = line.substring(labelMatch[0].length);
  }

  const chordRegex = /[^\s]+/g;
  let match;
  const chords: { chord: string; index: number }[] = [];

  while ((match = chordRegex.exec(processLine)) !== null) {
    chords.push({ chord: match[0], index: match.index });
  }

  if (chords.length === 0) return blocks;

  // Add spacing before first chord to the label block if it exists
  if (chords[0].index > 0) {
    const initialSpace = processLine.substring(0, chords[0].index);
    if (blocks.length > 0) {
      blocks[0].text += initialSpace;
    } else {
      blocks.push({ text: initialSpace });
    }
  }

  for (let i = 0; i < chords.length; i++) {
    const current = chords[i];
    const next = chords[i + 1];
    let spaceCount = 1;
    if (next) {
      spaceCount = next.index - (current.index + current.chord.length);
    }
    blocks.push({
      chord: current.chord,
      // text length must be at least chord length + spaceCount to ensure enough width for the next block
      text: ' '.repeat(current.chord.length + Math.max(1, spaceCount))
    });
  }

  return blocks;
}
