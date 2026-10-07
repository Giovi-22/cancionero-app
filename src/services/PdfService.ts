import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { parseChordPro } from '../utils/chordpro';
import type { SongLineParsed, SongBlock } from '../utils/chordUtils';

export interface PdfOptions {
  transpose?: number;
  capo?: number;
  fontSize?: number;
  viewMode?: 'all' | 'lyrics';
  bpm?: number;
  theme?: any;
  /** Nombre del tono en el que suena la canción (ej. "G"). Opcional. */
  keyName?: string;
}

/** Fragmento de una palabra; si lleva acorde, se dibuja encima. */
interface Piece {
  chord?: string;
  text: string;
}

/**
 * Una línea se reduce a palabras y espacios. Así el HTML puede evitar
 * cortes de línea en medio de una palabra (aunque tenga un acorde a la mitad)
 * y no hace falta ningún "padding" para simular espacios.
 */
type Token =
  | { kind: 'space'; text: string }
  | { kind: 'word'; parts: Piece[] };

interface Group {
  title?: string;
  lines: string[];
}

// A4 en puntos (expo-print usa Letter por defecto).
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

// Líneas de metadatos que nunca se imprimen: "BPM: 72", "Tempo: 72", "Compás: 4/4".
const HIDDEN_LABELS = /^\s*(bpm|tempo|comp[aá]s)\s*:/i;

// Líneas de metadatos que se omiten solo si el encabezado ya muestra ese dato.
const COVERED_LABELS = /^\s*(tono|key|capo)\s*:/i;

// Texto que quedó pegado al final de canciones antiguas; se oculta.
const LEGACY_FOOTER = 'ministerio de alabanza icbs';

export class PdfService {
  /**
   * Genera un PDF con el formato de la canción y abre el diálogo nativo de compartir.
   */
  static async generateAndShareSongPdf(
    title: string,
    content: string,
    options: PdfOptions = {}
  ): Promise<void> {
    const parsedLines = parseChordPro(content);

    return this.generateAndShare(
      title,
      parsedLines,
      options.viewMode || 'all',
      options.transpose ?? 0,
      options.capo ?? 0,
      options.bpm,
      options.keyName
    );
  }

  /**
   * `_bpm` se mantiene por compatibilidad con quien ya llama a esta función,
   * pero el PDF no muestra BPM ni compás.
   */
  static async generateAndShare(
    title: string,
    parsedLines: SongLineParsed[],
    viewMode: 'all' | 'lyrics',
    transpose: number,
    capo: number,
    _bpm?: number,
    keyName?: string
  ): Promise<void> {
    try {
      const html = this.generateHtml(
        title,
        parsedLines,
        viewMode,
        transpose,
        capo,
        keyName
      );

      const { uri } = await Print.printToFileAsync({
        html,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Compartir canción: ${title}`,
        UTI: 'com.adobe.pdf', // iOS
      });
    } catch (error) {
      console.error('Error generating/sharing PDF:', error);
      throw new Error(
        'No se pudo generar o compartir el PDF. Intenta nuevamente.'
      );
    }
  }

  // ───────────────────────────────────────────────────────────────
  // HTML
  // ───────────────────────────────────────────────────────────────

  private static generateHtml(
    title: string,
    parsedLines: SongLineParsed[],
    viewMode: 'all' | 'lyrics',
    transpose: number,
    capo: number,
    keyName?: string
  ): string {
    const showChords = viewMode === 'all';

    // Datos que el encabezado ya muestra (a partir de lo que el usuario tiene
    // en la app). Las líneas equivalentes del texto de la canción se omiten
    // para no repetirlas ni contradecirlas.
    const covered = new Set<string>();
    if (keyName) covered.add('tono');
    if (capo > 0) covered.add('capo');

    const groups = this.buildGroups(parsedLines, showChords, covered);

    const meta = this.buildMeta(transpose, capo, keyName);
    const metaHtml = meta.length
      ? `<p class="meta">${meta.map(m => this.escapeHtml(m)).join(' · ')}</p>`
      : '';

    const bodyHtml = groups
      .filter(g => g.title !== undefined || g.lines.length > 0)
      .map(g =>
        g.title !== undefined
          ? `<section class="sec"><h3>${this.escapeHtml(g.title)}</h3>${g.lines.join('')}</section>`
          : `<section class="pre">${g.lines.join('')}</section>`
      )
      .join('');

    return (
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>${this.escapeHtml(title)}</title>` +
      `<style>${STYLES}</style></head><body>` +
      `<header class="hd"><h1>${this.escapeHtml(title)}</h1>${metaHtml}</header>` +
      `<main>${bodyHtml}</main>` +
      `<footer class="ft">Cancionero App</footer>` +
      `</body></html>`
    );
  }

  /** Datos del encabezado: solo lo que realmente aporta información. */
  private static buildMeta(
    transpose: number,
    capo: number,
    keyName?: string
  ): string[] {
    const items: string[] = [];

    if (keyName) {
      items.push(`Tono ${keyName}`);
    } else if (transpose !== 0) {
      items.push(`Transpuesta ${transpose > 0 ? '+' : ''}${transpose}`);
    }

    if (capo > 0) items.push(`Capo traste ${capo}`);

    return items;
  }

  /**
   * Agrupa las líneas por sección ([VERSO], [CORO]...) para que cada sección
   * viaje junta en una misma página, y colapsa las líneas en blanco repetidas.
   */
  private static buildGroups(
    parsedLines: SongLineParsed[],
    showChords: boolean,
    covered: Set<string>
  ): Group[] {
    const groups: Group[] = [{ lines: [] }];
    let pendingGap = false;

    for (const rawLine of parsedLines) {
      const line = this.stripLegacyFooter(rawLine);
      const first = line.blocks[0]?.text ?? '';

      if (line.type === 'section') {
        // El título ya se imprime en el encabezado.
        if (first.trim().toUpperCase().startsWith('[TITULO]')) continue;

        groups.push({ title: first.replace(/[[\]]/g, '').trim(), lines: [] });
        pendingGap = false;
        continue;
      }

      const hasChords = line.blocks.some(b => !!b.chord);

      if (line.isMetadata) {
        // BPM / tempo / compás no se muestran en el PDF.
        if (HIDDEN_LABELS.test(first)) continue;

        // "Tono:" y "Capo:" ya están en el encabezado.
        const label = first.match(COVERED_LABELS)?.[1].toLowerCase();
        if (label && covered.has(label === 'key' ? 'tono' : label)) continue;

        // En modo "solo letra", "Intro: [G] [D]" no aporta nada.
        if (!showChords && hasChords) continue;
      }

      const visibleText = line.blocks.map(b => b.text || '').join('').trim();

      // Línea en blanco → a lo sumo un espacio entre líneas de la misma sección.
      // En modo "solo letra", las líneas que solo tenían acordes también cuentan así.
      if (!visibleText && (!hasChords || !showChords)) {
        pendingGap = true;
        continue;
      }

      const current = groups[groups.length - 1];
      if (pendingGap && current.lines.length > 0) {
        current.lines.push('<div class="gap"></div>');
      }
      pendingGap = false;

      const tokens = this.tokenize(line.blocks, showChords);

      // Línea que solo tiene acordes (intro, interludio): sin fila de letra vacía.
      const chordsOnly =
        !line.isMetadata &&
        tokens.some(t => t.kind === 'word') &&
        tokens.every(
          t =>
            t.kind === 'space' ||
            t.parts.every(p => !!p.chord && !/\S/.test(p.text))
        );

      const cls = line.isMetadata
        ? 'line meta-line'
        : chordsOnly
          ? 'line co'
          : 'line';

      current.lines.push(
        `<div class="${cls}">${this.renderTokens(
          tokens,
          !!line.isMetadata
        )}</div>`
      );
    }

    return groups;
  }

  /** Deja en blanco el texto de la línea si es el pie legacy (conserva sus acordes). */
  private static stripLegacyFooter(line: SongLineParsed): SongLineParsed {
    const text = line.blocks
      .map(b => b.text || '')
      .join('')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (!text.includes(LEGACY_FOOTER)) return line;

    return { ...line, blocks: line.blocks.map(b => ({ ...b, text: ' ' })) };
  }

  /**
   * Convierte los bloques { acorde, texto } en palabras y espacios.
   * El acorde queda sobre la primera palabra del bloque (o sobre los espacios,
   * si el bloque no tiene texto, como en una línea de solo acordes).
   */
  private static tokenize(
    blocks: SongBlock[],
    showChords: boolean
  ): Token[] {
    const tokens: Token[] = [];
    let word: Piece[] = [];

    const closeWord = () => {
      if (word.length > 0) {
        tokens.push({ kind: 'word', parts: word });
        word = [];
      }
    };

    for (const block of blocks) {
      const text = block.text || '';
      const chord = showChords ? block.chord : undefined;

      // "  Hola mundo " → ["  ", "Hola", " ", "mundo", " "]
      const pieces = text.split(/(\s+)/).filter(Boolean);
      const hasWords = pieces.some(p => /\S/.test(p));

      // Acorde sin texto, o sobre espacios: unidad propia.
      if (chord && !hasWords) {
        closeWord();
        tokens.push({ kind: 'word', parts: [{ chord, text }] });
        continue;
      }

      let pendingChord = chord;

      for (const piece of pieces) {
        if (/^\s+$/.test(piece)) {
          closeWord();
          tokens.push({ kind: 'space', text: piece });
        } else {
          // Si la palabra ya venía abierta (acorde a mitad de palabra),
          // este fragmento se suma a ella.
          word.push({ chord: pendingChord, text: piece });
          pendingChord = undefined;
        }
      }
    }

    closeWord();
    return tokens;
  }

  /**
   * @param inlineChords true en líneas de metadatos ("Tono: [G]", "Intro: [G] [D]"):
   *   los acordes van en la misma fila que el texto, no encima.
   */
  private static renderTokens(
    tokens: Token[],
    inlineChords = false
  ): string {
    return tokens
      .map(token => {
        if (token.kind === 'space') return this.escapeHtml(token.text);

        const hasChord = token.parts.some(p => !!p.chord);

        if (!hasChord) {
          return this.escapeHtml(token.parts.map(p => p.text).join(''));
        }

        if (inlineChords) {
          return token.parts
            .map(p =>
              (p.chord
                ? `<span class="ci">${this.escapeHtml(p.chord)}</span>`
                : '') + this.escapeHtml(p.text)
            )
            .join('');
        }

        const inner = token.parts
          .map(p => {
            if (!p.chord) return this.escapeHtml(p.text);

            // Acorde sobre espacios (línea de solo acordes): el espacio se
            // mide con la tipografía del acorde para respetar la separación.
            const onSpaces = p.text !== '' && !/\S/.test(p.text);

            return (
              `<span class="s"><span class="c">${this.escapeHtml(p.chord)}</span>` +
              `<span class="l${onSpaces ? ' sp' : ''}">${this.escapeHtml(p.text)}</span></span>`
            );
          })
          .join('');

        return `<span class="w">${inner}</span>`;
      })
      .join('');
  }

  private static escapeHtml(unsafe: string): string {
    return String(unsafe ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ───────────────────────────────────────────────────────────────
// Estilos
//
// - Sin fuentes remotas: tipografías del sistema (no depende de internet).
// - Márgenes de página (60px 50px 30px 50px) definidos solo con @page;
//   el body no agrega padding propio.
// - Cada acorde es un inline-block (acorde arriba, sílaba abajo) alineado
//   por la base con el texto normal que lo rodea.
// ───────────────────────────────────────────────────────────────

const STYLES = `
@page{size:A4;margin:60px 50px 30px 50px}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  font-size:14px;
  color:#1f2937;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}

.hd{
  text-align:center;
  margin:0 0 18px;
  padding-bottom:12px;
  border-bottom:1px solid #e5e7eb;
}
h1{
  margin:0;
  font-size:24px;
  line-height:1.2;
  letter-spacing:-.3px;
  color:#111827;
}
.meta{
  margin:8px 0 0;
  font-size:12px;
  font-weight:600;
  color:#4b5563;
}

.sec,.pre{
  margin-top:16px;
  break-inside:avoid;
  page-break-inside:avoid;
}
.pre{margin-top:0}
h3{
  margin:0 0 6px;
  padding-bottom:3px;
  border-bottom:1px solid #f3f4f6;
  font-size:11px;
  letter-spacing:1px;
  text-transform:uppercase;
  color:#b45309;
  break-after:avoid;
  page-break-after:avoid;
}

.line{
  margin:0 0 2px;
  line-height:22px;
  white-space:pre-wrap;
}
.meta-line{font-weight:600;color:#4b5563}
.gap{height:10px}

.w{white-space:nowrap}
.s{display:inline-block;vertical-align:bottom}
.c{
  display:block;
  padding-right:6px;
  font-family:ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace;
  font-size:12px;
  font-weight:700;
  line-height:14px;
  white-space:pre;
  color:#1d4ed8;
}
.l{
  display:block;
  min-height:22px;
  line-height:22px;
  white-space:pre;
}
/* Línea de solo acordes: la fila de letra se colapsa (conserva el ancho de los espacios) */
.co .l{min-height:0;height:0;line-height:0;overflow:hidden}
.co .c{margin-bottom:4px}
.sp{font-family:ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:12px}
.ci{
  font-family:ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace;
  font-size:13px;
  font-weight:700;
  color:#1d4ed8;
}

.ft{
  margin-top:28px;
  padding-top:8px;
  border-top:1px solid #f3f4f6;
  text-align:center;
  font-size:10px;
  color:#9ca3af;
}
`;
