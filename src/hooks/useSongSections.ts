/**
 * useSongSections
 *
 * Lógica del modo "Salto por Secciones" del pedal.
 *
 * Cada llamada a jumpToNextSection / jumpToPrevSection hace que el
 * ScrollView salte a la siguiente / anterior línea de tipo 'section',
 * posicionándola al (overlapFraction) del viewport desde el top, para que
 * esa fracción superior muestre el final del verso anterior.
 *
 * Ejemplo con overlapFraction = 0.3 (por defecto):
 *
 *   ┌──────────────────────────────────┐
 *   │ ~30%  final del verso anterior   │  ← contexto
 *   ├──────────────────────────────────┤
 *   │ [CORO] ← etiqueta de sección     │
 *   │  ...contenido del coro...        │
 *   │ ~70%                             │
 *   └──────────────────────────────────┘
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { ScrollView } from 'react-native';
import { SongLineParsed } from '../utils/chordUtils';

export interface UseSongSectionsParams {
    /** Líneas parseadas de la canción actual. */
    parsedLines: SongLineParsed[];
    /** Ref al ScrollView principal de la canción. */
    scrollRef: React.RefObject<ScrollView | null>;
    /**
     * Función que devuelve las posiciones Y de cada línea
     * (tops[i] = y donde empieza la línea i en el contenido del ScrollView).
     */
    getTops: () => ReadonlyArray<number | undefined>;
    /** Referencia a la altura del viewport en píxeles. */
    viewportHeightRef: React.RefObject<number>;
    /**
     * Fracción del viewport visible por encima de la nueva sección
     * (contexto del verso anterior). Valor entre 0 y 1. Default: 0.3.
     */
    overlapFraction?: number;
}

export interface UseSongSectionsReturn {
    /** Índice actual de sección (dentro del array de secciones). -1 = antes de la primera. */
    currentSectionIndex: number;
    /** Cantidad total de secciones detectadas en la canción. */
    sectionCount: number;
    /** Etiqueta de la sección actual (texto limpio sin corchetes), o null. */
    currentSectionLabel: string | null;
    /** Salta a la siguiente sección. */
    jumpToNextSection: () => void;
    /** Vuelve a la sección anterior. */
    jumpToPrevSection: () => void;
    /** Resetea el índice (llamar cuando cambia de canción). */
    resetSectionIndex: () => void;
}

export const useSongSections = ({
    parsedLines,
    scrollRef,
    getTops,
    viewportHeightRef,
    overlapFraction = 0.3,
}: UseSongSectionsParams): UseSongSectionsReturn => {

    // Índices de todas las líneas con type === 'section'
    const sectionLineIndices = useMemo(
        () =>
            parsedLines.reduce<number[]>((acc, line, i) => {
                if (line.type === 'section') acc.push(i);
                return acc;
            }, []),
        [parsedLines]
    );

    const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);

    // Resetear cuando cambia la canción
    useEffect(() => {
        setCurrentSectionIndex(-1);
    }, [sectionLineIndices]);

    const overlapFractionRef = useRef(overlapFraction);
    useEffect(() => {
        overlapFractionRef.current = overlapFraction;
    }, [overlapFraction]);

    /**
     * Desplaza el ScrollView para que la línea `lineIndex` aparezca
     * a (overlapFraction × viewportHeight) desde el borde superior.
     */
    const scrollToSectionLine = useCallback(
        (lineIndex: number) => {
            const tops = getTops();
            const sectionY = tops[lineIndex];
            if (sectionY === undefined) return;

            const viewportHeight = viewportHeightRef.current ?? 0;
            const targetY = Math.max(
                0,
                sectionY - viewportHeight * overlapFractionRef.current
            );

            scrollRef.current?.scrollTo({ y: targetY, animated: true });
        },
        [getTops, scrollRef, viewportHeightRef]
    );

    const jumpToNextSection = useCallback(() => {
        if (sectionLineIndices.length === 0) return;

        const nextIndex = currentSectionIndex + 1;
        if (nextIndex >= sectionLineIndices.length) return; // ya en la última

        setCurrentSectionIndex(nextIndex);
        scrollToSectionLine(sectionLineIndices[nextIndex]);
    }, [currentSectionIndex, sectionLineIndices, scrollToSectionLine]);

    const jumpToPrevSection = useCallback(() => {
        if (sectionLineIndices.length === 0) return;

        const prevIndex = currentSectionIndex - 1;

        if (prevIndex < 0) {
            // Antes de la primera sección → ir al tope
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            setCurrentSectionIndex(-1);
            return;
        }

        setCurrentSectionIndex(prevIndex);
        scrollToSectionLine(sectionLineIndices[prevIndex]);
    }, [currentSectionIndex, sectionLineIndices, scrollToSectionLine, scrollRef]);

    const resetSectionIndex = useCallback(() => {
        setCurrentSectionIndex(-1);
    }, []);

    const currentSectionLabel = useMemo(() => {
        if (currentSectionIndex < 0 || currentSectionIndex >= sectionLineIndices.length) {
            return null;
        }
        const lineIdx = sectionLineIndices[currentSectionIndex];
        const line = parsedLines[lineIdx] as any;
        if (!line) return null;

        // Las líneas de tipo 'section' tienen estructura: { type: 'section', blocks: [{ text: '[CORO]' }] }
        const raw: string =
            line.blocks?.[0]?.text ??
            line.text ??
            line.content ??
            line.label ??
            '';
        return raw.replace(/^\[/, '').replace(/\]$/, '').trim() || null;
    }, [currentSectionIndex, sectionLineIndices, parsedLines]);


    return {
        currentSectionIndex,
        sectionCount: sectionLineIndices.length,
        currentSectionLabel,
        jumpToNextSection,
        jumpToPrevSection,
        resetSectionIndex,
    };
};
