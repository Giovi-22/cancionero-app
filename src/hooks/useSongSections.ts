/**
 * useSongSections
 *
 * Lógica del modo "Salto por secciones" del pedal y de la sección enfocada.
 *
 * Diferencias con la versión anterior:
 *
 * - NO guarda un índice de sección propio que se desincronice. La sección
 *   "actual" se calcula siempre a partir de la posición real del scroll, así
 *   sigue siendo correcta después de transponer, de HOME/END, de un scroll
 *   con el dedo o de una corrección del pedal Wi-Fi.
 * - El único estado guardado es el último salto hecho por el pedal (índice +
 *   scrollY). Sirve para dos casos: durante la animación del salto, y cuando
 *   la sección no se puede dejar al 30 % porque es de las últimas (el scroll
 *   queda recortado al máximo y la etiqueta cae más abajo).
 * - El título de la canción NO cuenta como sección.
 * - El scroll se hace por useSongScroll.scrollToSectionLine, que actualiza las
 *   referencias de posición. Así el pedal Wi-Fi no "devuelve" el scroll.
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
import { SongLineParsed } from '../utils/chordUtils';
import { SongSection, buildSections } from '../utils/sectionUtils';

/** Tolerancia (px) al comparar la posición de una etiqueta con la referencia. */
const POSITION_TOLERANCE_PX = 4;

/** Si el scroll sigue a menos de esto del último salto, se confía en su índice. */
const JUMP_TRUST_PX = 3;

/** Mientras dura la animación del salto, los onScroll intermedios se ignoran. */
const JUMP_ANIMATION_MS = 800;

export interface UseSongSectionsParams {
    /** Líneas parseadas de la canción actual. */
    parsedLines: SongLineParsed[];
    /** tops[i] = y donde empieza la línea i en el contenido del ScrollView. */
    getTops: () => ReadonlyArray<number | undefined>;
    /** Altura del viewport en píxeles. */
    viewportHeightRef: React.RefObject<number>;
    /** Posición de scroll actual (px). */
    getScrollY: () => number;
    /** Lleva una línea a (overlap × viewport) desde arriba. Devuelve el scrollY final. */
    scrollToSectionLine: (
        lineIndex: number,
        overlapFraction: number,
        animated?: boolean
    ) => number | null;
    /** Ir a una posición en líneas lógicas (0 = inicio, Infinity = final). */
    scrollToLinePos: (pos: number, animated?: boolean) => void;
    /**
     * Fracción del viewport visible por encima de la nueva sección
     * (contexto del verso anterior). Entre 0 y 1. Default: 0.3.
     */
    overlapFraction?: number;
    /**
     * Fracción del viewport donde se mira "qué sección estoy viendo" para
     * resaltarla cuando NO hubo un salto del pedal. En modo secciones es el
     * mismo overlap; en modo líneas es el punto de anclaje. Default: overlap.
     */
    referenceFraction?: number;
}

export interface UseSongSectionsReturn {
    /** Secciones navegables (sin el título). */
    sections: SongSection[];
    /** Cantidad de secciones. */
    sectionCount: number;
    /** Índice de la sección enfocada. -1 = ninguna (antes de la primera). */
    activeIndex: number;
    /** Etiqueta de la sección enfocada, o null. */
    activeLabel: string | null;
    /** Rango de líneas (parsedLines) de la sección enfocada, o null. */
    activeRange: { start: number; end: number } | null;
    /** Recalcula la sección enfocada para un scrollY (llamar desde onScroll). */
    updateActiveSection: (scrollY: number) => void;
    jumpToNextSection: () => void;
    jumpToPrevSection: () => void;
    /** HOME: va al inicio y deja el foco "antes de la primera sección". */
    jumpToStart: () => void;
    /** END: va al final y deja el foco en la última sección. */
    jumpToEnd: () => void;
}

export const useSongSections = ({
    parsedLines,
    getTops,
    viewportHeightRef,
    getScrollY,
    scrollToSectionLine,
    scrollToLinePos,
    overlapFraction = 0.3,
    referenceFraction,
}: UseSongSectionsParams): UseSongSectionsReturn => {
    const sections = useMemo(() => buildSections(parsedLines), [parsedLines]);

    // Refs para que los callbacks no cambien de identidad (ni lean valores
    // viejos) cuando cambia la canción o el ajuste de overlap.
    const sectionsRef = useRef(sections);
    sectionsRef.current = sections;

    const overlapRef = useRef(overlapFraction);
    overlapRef.current = overlapFraction;

    const referenceRef = useRef(referenceFraction ?? overlapFraction);
    referenceRef.current = referenceFraction ?? overlapFraction;

    /** Último salto hecho por el pedal. */
    const lastJumpRef = useRef<{
        index: number;
        y: number;
        until: number;
    } | null>(null);

    /**
     * Índice de la sección que corresponde a un scrollY.
     * `fraction` es el punto del viewport que se toma como referencia:
     * una sección "ya empezó" si su etiqueta está en o por encima de ese punto.
     */
    const indexAtScroll = useCallback(
        (scrollY: number, fraction: number): number => {
            const list = sectionsRef.current;

            if (list.length === 0) return -1;

            const jump = lastJumpRef.current;

            if (
                jump &&
                (Date.now() < jump.until ||
                    Math.abs(scrollY - jump.y) < JUMP_TRUST_PX)
            ) {
                return jump.index;
            }

            // Arriba de todo no hay nada "empezado" todavía.
            if (scrollY <= 1) return -1;

            const tops = getTops();
            const referenceY =
                scrollY +
                (viewportHeightRef.current ?? 0) * fraction +
                POSITION_TOLERANCE_PX;

            let index = -1;

            for (let i = 0; i < list.length; i++) {
                const top = tops[list[i].line];

                if (top === undefined) continue;

                if (top <= referenceY) {
                    index = i;
                } else {
                    break;
                }
            }

            return index;
        },
        [getTops, viewportHeightRef]
    );

    // ── Sección enfocada (para resaltar) ──

    const [activeIndex, setActiveIndex] = useState(-1);
    const activeIndexRef = useRef(-1);

    const commitActive = useCallback((index: number) => {
        if (activeIndexRef.current !== index) {
            activeIndexRef.current = index;
            setActiveIndex(index);
        }
    }, []);

    const updateActiveSection = useCallback(
        (scrollY: number) => {
            commitActive(indexAtScroll(scrollY, referenceRef.current));
        },
        [indexAtScroll, commitActive]
    );

    // Si cambian las secciones (otra canción, transposición con cambio de
    // estructura, edición) el último salto ya no vale.
    useEffect(() => {
        lastJumpRef.current = null;
        updateActiveSection(getScrollY());
    }, [sections, updateActiveSection, getScrollY]);

    // Si cambia el punto de referencia (cambio de modo / overlap), se recalcula.
    useEffect(() => {
        updateActiveSection(getScrollY());
    }, [referenceFraction, overlapFraction, updateActiveSection, getScrollY]);

    // ── Navegación ──

    const rememberJump = useCallback(
        (index: number, y: number) => {
            lastJumpRef.current = {
                index,
                y,
                until: Date.now() + JUMP_ANIMATION_MS,
            };
            commitActive(index);
        },
        [commitActive]
    );

    const goToSection = useCallback(
        (index: number) => {
            const target = sectionsRef.current[index];

            if (!target) return;

            const y = scrollToSectionLine(
                target.line,
                overlapRef.current,
                true
            );

            // Sin mapa de líneas todavía: no se hace nada y no se pierde el estado.
            if (y === null) return;

            rememberJump(index, y);
        },
        [scrollToSectionLine, rememberJump]
    );

    const jumpToStart = useCallback(() => {
        scrollToLinePos(0, true);
        rememberJump(-1, 0);
    }, [scrollToLinePos, rememberJump]);

    const jumpToEnd = useCallback(() => {
        scrollToLinePos(Infinity, true);
        rememberJump(sectionsRef.current.length - 1, getScrollY());
    }, [scrollToLinePos, rememberJump, getScrollY]);

    const jumpToNextSection = useCallback(() => {
        const count = sectionsRef.current.length;

        if (count === 0) return;

        // La "actual" es la última cuya etiqueta ya está en o por encima del
        // punto donde el pedal deja las secciones (el overlap), o el último
        // salto del pedal. Arriba de todo (scrollY ≈ 0) todavía no empezó
        // ninguna, así que el primer pulso lleva a la primera sección.
        const current = indexAtScroll(getScrollY(), overlapRef.current);
        const next = current + 1;

        if (next >= count) return; // ya está en la última

        goToSection(next);
    }, [indexAtScroll, getScrollY, goToSection]);

    const jumpToPrevSection = useCallback(() => {
        if (sectionsRef.current.length === 0) return;

        const current = indexAtScroll(getScrollY(), overlapRef.current);
        const prev = current - 1;

        if (prev < 0) {
            jumpToStart();
            return;
        }

        goToSection(prev);
    }, [indexAtScroll, getScrollY, goToSection, jumpToStart]);

    const activeRange = useMemo(() => {
        if (activeIndex < 0 || activeIndex >= sections.length) return null;

        const start = sections[activeIndex].line;
        const end = (sections[activeIndex + 1]?.line ?? parsedLines.length) - 1;

        return { start, end };
    }, [activeIndex, sections, parsedLines.length]);

    const activeLabel =
        activeIndex >= 0 && activeIndex < sections.length
            ? sections[activeIndex].label || null
            : null;

    return {
        sections,
        sectionCount: sections.length,
        activeIndex,
        activeLabel,
        activeRange,
        updateActiveSection,
        jumpToNextSection,
        jumpToPrevSection,
        jumpToStart,
        jumpToEnd,
    };
};