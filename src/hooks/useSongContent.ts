import { useMemo } from 'react';

import {
    parseChordPro,
    transposeChordPro,
    extractTitleFromChordPro,
} from '../utils/chordpro';
import { legacyToChordPro } from '../utils/legacyToChordPro';
import { transposeChord } from '../utils/chordUtils';

const LEGACY_FOOTER_TEXT =
    'Ministerio de Alabanza ICBS';

const NOTE_SEMITONES: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
};

const NOTES_DISPLAY = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
];

interface UseSongContentParams {
    content: string;
    title: string;
    currentContent: string;
    transpose: number;
    capo: number;
}

export const useSongContent = ({
    content,
    title,
    currentContent,
    transpose,
    capo,
}: UseSongContentParams) => {
    // ─────────────────────────────────────────────
    // Título
    // ─────────────────────────────────────────────

    const displayTitle = useMemo(() => {
        const titleFromContent =
            extractTitleFromChordPro(
                content || ''
            );

        if (titleFromContent) {
            return titleFromContent;
        }

        return (title || '').replace(
            /\.(chordpro|pro|cho|chopro|crd|txt)$/i,
            ''
        );
    }, [content, title]);

    // ─────────────────────────────────────────────
    // Normalización
    // ─────────────────────────────────────────────

    const normalizedContent = useMemo(() => {
        return legacyToChordPro(
            currentContent
        );
    }, [currentContent]);

    // ─────────────────────────────────────────────
    // Transposición
    // ─────────────────────────────────────────────

    const transposedContent = useMemo(() => {
        const contentWithoutFooter =
            normalizedContent.replace(
                new RegExp(
                    LEGACY_FOOTER_TEXT,
                    'gi'
                ),
                ''
            );

        return transposeChordPro(
            contentWithoutFooter,
            transpose - capo
        );
    }, [
        normalizedContent,
        transpose,
        capo,
    ]);

    // ─────────────────────────────────────────────
    // Parseo
    // ─────────────────────────────────────────────

    const parsedLines = useMemo(() => {
        const result =
            parseChordPro(
                transposedContent
            );

        const footerNormalized =
            LEGACY_FOOTER_TEXT
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();

        return result.map(line => {
            const lineText =
                line.blocks
                    .map(
                        b => b.text || ''
                    )
                    .join('')
                    .toLowerCase()
                    .replace(/\s+/g, ' ')
                    .trim();

            if (
                lineText.includes(
                    footerNormalized
                )
            ) {
                return {
                    ...line,
                    blocks:
                        line.blocks.map(
                            b => ({
                                ...b,
                                text: ' ',
                            })
                        ),
                };
            }

            return line;
        });
    }, [transposedContent]);

    // ─────────────────────────────────────────────
    // Tonalidad
    // ─────────────────────────────────────────────

    const {
        originalTone,
        transposedTone,
    } = useMemo(() => {
        let match =
            currentContent.match(
                /\{\s*(?:key|tono|t)\s*:\s*\[?([A-G][b#]?[m]?)\]?\s*\}/i
            );

        if (!match) {
            match =
                currentContent.match(
                    /^\s*(?:TONO|KEY):\s*\[?([A-G][b#]?[m]?)\]?/mi
                );
        }

        const orig =
            match
                ? match[1]
                : null;

        let trans = orig;

        if (
            orig &&
            transpose - capo !== 0
        ) {
            trans =
                transposeChord(
                    orig,
                    transpose - capo
                );
        }

        return {
            originalTone: orig,
            transposedTone: trans,
        };
    }, [
        currentContent,
        transpose,
        capo,
    ]);

    // ─────────────────────────────────────────────
    // Tonalidad sonora
    // ─────────────────────────────────────────────

    const soundingKeySemitone =
        useMemo(() => {
            if (!originalTone) {
                return null;
            }

            const baseNote =
                originalTone.replace(
                    /m$/i,
                    ''
                );

            const baseSemitone =
                NOTE_SEMITONES[
                baseNote
                ];

            if (
                baseSemitone ===
                undefined
            ) {
                return null;
            }

            return (
                (baseSemitone +
                    transpose +
                    120) %
                12
            );
        }, [
            originalTone,
            transpose,
        ]);

    const soundingKeyName =
        useMemo(() => {
            if (
                soundingKeySemitone ===
                null ||
                !originalTone
            ) {
                return null;
            }

            const isMinor =
                originalTone
                    .toLowerCase()
                    .endsWith('m');

            return (
                NOTES_DISPLAY[
                soundingKeySemitone
                ] +
                (isMinor ? 'm' : '')
            );
        }, [
            soundingKeySemitone,
            originalTone,
        ]);

    return {
        displayTitle,
        normalizedContent,
        transposedContent,
        parsedLines,
        originalTone,
        transposedTone,
        soundingKeySemitone,
        soundingKeyName,
    };
};