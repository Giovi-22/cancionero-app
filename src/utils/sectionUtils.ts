/**
 * sectionUtils
 *
 * Helpers para trabajar con las líneas de tipo 'section' de parsedLines.
 * Los usan tanto SongContent (para dibujar) como useSongSections (para navegar),
 * así los dos coinciden siempre en qué es "el título" y qué es una sección.
 */

import { SongLineParsed } from './chordUtils';

export interface SongSection {
    /** Índice de la línea (en parsedLines) donde está la etiqueta. */
    line: number;
    /** Texto de la etiqueta sin corchetes: "Coro", "Verso 1"... */
    label: string;
}

/** El título de la canción se guarda como una 'section' con "[TITULO] ...". */
export const isTitleLine = (line: SongLineParsed | undefined): boolean =>
    !!line &&
    line.type === 'section' &&
    !!line.blocks[0]?.text?.toUpperCase().includes('TITULO');

/** Etiqueta limpia de una línea 'section' ("[CORO]" → "CORO"). */
export const getSectionLabel = (line: SongLineParsed): string =>
    (line.blocks ?? [])
        .map(b => b?.text ?? '')
        .join('')
        .replace(/^\s*\[/, '')
        .replace(/\]\s*$/, '')
        .trim();

/** Secciones navegables de la canción: todas las etiquetas menos el título. */
export const buildSections = (parsedLines: SongLineParsed[]): SongSection[] => {
    const sections: SongSection[] = [];

    parsedLines.forEach((line, index) => {
        if (line.type === 'section' && !isTitleLine(line)) {
            sections.push({ line: index, label: getSectionLabel(line) });
        }
    });

    return sections;
};
