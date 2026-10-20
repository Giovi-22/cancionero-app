import {
    RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    LayoutChangeEvent,
    ScrollView,
    View,
} from 'react-native';

import {
    LINE_ANCHOR_FRACTION,
    LINE_MIN_VELOCITY,
    LINE_SYNC_EPSILON,
    LINE_TRUST_TOLERANCE_PX,
    SERVER_BLEND,
    SERVER_SNAP_LINES,
    WIFI_PEDAL_LINES_PER_SEC,
    WIFI_PEDAL_RAMP_MS,
    buildTops,
    minVisibleLines,
    posToY,
    yToPos,
} from '../utils/lineMap';

interface UseSongScrollParams {
    scrollRef: RefObject<ScrollView | null>;
    scrollAreaRef: RefObject<View | null>;
    scrollSpeed: number;
    pedalSpeed: number;
    isScrolling: boolean;
    onScrollPositionChange?: (
        progress: number
    ) => void;
    /** Cantidad de líneas lógicas (parsedLines.length). */
    lineCount?: number;
}

export interface UseSongScrollReturn {
    scrollPosRef: React.MutableRefObject<number>;
    viewportHeightRef: React.MutableRefObject<number>;
    contentHeightRef: React.MutableRefObject<number>;
    isScrollEnabled: boolean;
    setIsScrollEnabled: React.Dispatch<
        React.SetStateAction<boolean>
    >;
    pedalRafRef: React.MutableRefObject<number | null>;
    pedalScrollDirRef: React.MutableRefObject<
        'up' | 'down' | null
    >;
    startPedalScroll: (
        direction: 'up' | 'down'
    ) => void;
    stopPedalScroll: () => void;
    handlePedalScrollUp: () => void;
    handlePedalScrollDown: () => void;
    handleScroll: (
        offsetY: number
    ) => void;
    handleScrollAreaLayout: (
        event: LayoutChangeEvent
    ) => void;
    handleContentSizeChange: (
        width: number,
        height: number
    ) => void;
    getScrollProgress: () => number;
    scrollToProgress: (
        progress: number,
        animated?: boolean
    ) => void;
    goToSongStart: (animated?: boolean) => void;
    goToSongEnd: (animated?: boolean) => void;
    scrollAreaPageY: React.MutableRefObject<number>;
    scrollAreaPageX: React.MutableRefObject<number>;
    measureScrollArea: () => void;

    // ── Scroll por líneas lógicas (pedal WiFi) ──
    hasLineMap: () => boolean;
    handleLineLayout: (
        lineIndex: number,
        y: number,
        height: number
    ) => void;
    handleContainerLayout: (y: number) => void;
    getLinePos: () => number;
    scrollToLinePos: (
        pos: number,
        animated?: boolean
    ) => void;
    startLinePedalScroll: (
        direction: 'up' | 'down'
    ) => void;
    stopLinePedalScroll: () => void;

    // ── Posición compartida con el ESP32 ──
    /** Se incrementa cuando el mapa de líneas o el viewport terminan de cambiar. */
    lineMapVersion: number;
    /** Datos para el HELLO: líneas visibles (peor caso), total y posición actual. */
    getLineReport: () => {
        visible: number;
        total: number;
        pos: number;
    } | null;
    /** Aplica una posición publicada por el ESP32. */
    applyServerLinePos: (
        pos: number,
        moving: boolean
    ) => void;
    /** Velocidad y rampa del pedal, definidas por el ESP32. */
    setLinePedalConfig: (
        linesPerSec: number,
        rampMs: number
    ) => void;
}

const ACCEL_RATE = 0.008;
const DECEL_RATE = 0.012;
const MIN_VELOCITY = 0.005;
const POSITION_NOTIFY_INTERVAL = 100;

export const useSongScroll = ({
    scrollRef,
    scrollAreaRef,
    scrollSpeed,
    pedalSpeed,
    isScrolling,
    onScrollPositionChange,
    lineCount = 0,
}: UseSongScrollParams): UseSongScrollReturn => {
    const [isScrollEnabled, setIsScrollEnabled] =
        useState(true);

    const scrollPosRef = useRef(0);

    const scrollIntervalRef =
        useRef<ReturnType<typeof setInterval> | null>(
            null
        );

    const viewportHeightRef = useRef(0);
    const contentHeightRef = useRef(0);

    const scrollAreaPageY = useRef(0);
    const scrollAreaPageX = useRef(0);

    const lastPositionNotifyRef =
        useRef(0);

    const pendingProgressRef =
        useRef<number | null>(null);

    /**
     * Notifica al director la posición visual actual.
     *
     * IMPORTANTE:
     * El progress ya no representa simplemente:
     *
     *   scrollY / maxScroll
     *
     * Sino la posición del CENTRO del viewport
     * respecto del contenido.
     *
     * Esto permite que director y follower puedan
     * tener distintos tamaños de viewport y seguir
     * mostrando aproximadamente la misma zona de
     * la canción.
     */
    const notifyProgress = useCallback(
        (
            progress: number,
            force = false
        ) => {
            if (!onScrollPositionChange) return;

            const safeProgress = Math.min(
                1,
                Math.max(0, progress)
            );

            const now = Date.now();

            pendingProgressRef.current =
                safeProgress;

            if (
                !force &&
                now -
                lastPositionNotifyRef.current <
                POSITION_NOTIFY_INTERVAL
            ) {
                return;
            }

            lastPositionNotifyRef.current =
                now;

            const value =
                pendingProgressRef.current;

            pendingProgressRef.current = null;

            if (value !== null) {
                onScrollPositionChange(value);
            }
        },
        [onScrollPositionChange]
    );

    // Cambia (con un pequeño retardo) cuando el mapa de líneas o el viewport
    // dejaron de moverse. SongViewer lo usa para volver a reportar al ESP32.
    const [lineMapVersion, setLineMapVersion] = useState(0);
    const lineMapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const bumpLineMapVersion = useCallback(() => {
        if (lineMapTimerRef.current !== null) {
            clearTimeout(lineMapTimerRef.current);
        }

        lineMapTimerRef.current = setTimeout(() => {
            lineMapTimerRef.current = null;
            setLineMapVersion(v => v + 1);
        }, 300);
    }, []);

    const measureScrollArea =
        useCallback(() => {
            scrollAreaRef.current?.measure(
                (
                    _x,
                    _y,
                    _width,
                    _height,
                    pageX,
                    pageY
                ) => {
                    scrollAreaPageX.current =
                        pageX;

                    scrollAreaPageY.current =
                        pageY;
                }
            );
        }, [scrollAreaRef]);

    const handleScrollAreaLayout =
        useCallback(
            (event: LayoutChangeEvent) => {
                viewportHeightRef.current =
                    event.nativeEvent.layout.height;

                measureScrollArea();
                bumpLineMapVersion();
            },
            [measureScrollArea, bumpLineMapVersion]
        );

    const handleContentSizeChange =
        useCallback(
            (
                _width: number,
                height: number
            ) => {
                contentHeightRef.current =
                    height;
            },
            []
        );

    const getMaxScroll =
        useCallback(() => {
            return Math.max(
                0,
                contentHeightRef.current -
                viewportHeightRef.current
            );
        }, []);

    /**
     * Devuelve una posición normalizada basada en
     * el CENTRO de lo que está viendo el usuario.
     *
     * Ejemplo:
     *
     * contentHeight = 7000
     * viewportHeight = 1000
     * scrollY = 2400
     *
     * centro = 2400 + 500 = 2900
     *
     * progress = 2900 / 7000 = 0.414
     *
     * El follower usa ese mismo punto visual
     * aunque su viewport tenga otra altura.
     */
    const getScrollProgress =
        useCallback(() => {
            const contentHeight =
                contentHeightRef.current;

            const viewportHeight =
                viewportHeightRef.current;

            if (
                contentHeight <= 0 ||
                viewportHeight <= 0
            ) {
                return 0;
            }

            const centerY =
                scrollPosRef.current +
                viewportHeight / 2;

            return Math.min(
                1,
                Math.max(
                    0,
                    centerY / contentHeight
                )
            );
        }, []);

    /**
     * Lleva el viewport hasta el mismo punto
     * visual indicado por el director.
     *
     * El progress representa el centro del viewport
     * dentro del contenido.
     */
    const scrollToProgress =
        useCallback(
            (
                progress: number,
                animated = true
            ) => {
                const contentHeight =
                    contentHeightRef.current;

                const viewportHeight =
                    viewportHeightRef.current;

                const maxScroll =
                    getMaxScroll();

                if (
                    contentHeight <= 0 ||
                    viewportHeight <= 0
                ) {
                    return;
                }

                const safeProgress =
                    Math.min(
                        1,
                        Math.max(
                            0,
                            progress
                        )
                    );

                /**
                 * Posición absoluta del centro del
                 * contenido que queremos mostrar.
                 */
                const targetCenterY =
                    safeProgress *
                    contentHeight;

                /**
                 * Convertimos el centro deseado
                 * en el scrollY correspondiente
                 * al viewport local.
                 */
                const targetY =
                    targetCenterY -
                    viewportHeight / 2;

                const clampedTargetY =
                    Math.max(
                        0,
                        Math.min(
                            maxScroll,
                            targetY
                        )
                    );

                scrollPosRef.current =
                    clampedTargetY;

                scrollRef.current?.scrollTo({
                    y: clampedTargetY,
                    animated,
                });
            },
            [getMaxScroll, scrollRef]
        );

    const pedalRafRef =
        useRef<number | null>(null);

    const pedalLastTickRef =
        useRef<number>(0);

    const pedalSpeedRef =
        useRef<number>(pedalSpeed);

    const pedalScrollDirRef =
        useRef<'up' | 'down' | null>(null);

    const pedalVelocityRef =
        useRef<number>(0);

    const pedalTargetVelRef =
        useRef<number>(0);

    useEffect(() => {
        pedalSpeedRef.current =
            pedalSpeed;
    }, [pedalSpeed]);

    const startPedalScroll =
        useCallback(
            (
                direction: 'up' | 'down'
            ) => {
                pedalScrollDirRef.current =
                    direction;

                pedalTargetVelRef.current =
                    pedalSpeedRef.current *
                    0.3;

                if (
                    pedalRafRef.current !== null
                ) {
                    return;
                }

                pedalLastTickRef.current =
                    0;

                const tick = (
                    timestamp: number
                ) => {
                    if (
                        pedalLastTickRef.current ===
                        0
                    ) {
                        pedalLastTickRef.current =
                            timestamp;

                        pedalRafRef.current =
                            requestAnimationFrame(
                                tick
                            );

                        return;
                    }

                    const dt = Math.min(
                        timestamp -
                        pedalLastTickRef.current,
                        50
                    );

                    pedalLastTickRef.current =
                        timestamp;

                    const target =
                        pedalTargetVelRef.current;

                    let velocity =
                        pedalVelocityRef.current;

                    if (target > 0) {
                        velocity = Math.min(
                            target,
                            velocity +
                            ACCEL_RATE * dt
                        );
                    } else {
                        velocity = Math.max(
                            0,
                            velocity -
                            DECEL_RATE * dt
                        );
                    }

                    pedalVelocityRef.current =
                        velocity;

                    if (
                        velocity >
                        MIN_VELOCITY &&
                        pedalScrollDirRef.current !==
                        null
                    ) {
                        const delta =
                            velocity *
                            dt *
                            (
                                pedalScrollDirRef.current ===
                                    'down'
                                    ? 1
                                    : -1
                            );

                        const maxScroll =
                            getMaxScroll();

                        scrollPosRef.current =
                            Math.max(
                                0,
                                Math.min(
                                    maxScroll,
                                    scrollPosRef.current +
                                    delta
                                )
                            );

                        scrollRef.current?.scrollTo({
                            y:
                                scrollPosRef.current,
                            animated: false,
                        });

                        notifyProgress(
                            getScrollProgress()
                        );

                        pedalRafRef.current =
                            requestAnimationFrame(
                                tick
                            );
                    } else {
                        notifyProgress(
                            getScrollProgress(),
                            true
                        );

                        pedalRafRef.current =
                            null;

                        pedalVelocityRef.current =
                            0;

                        pedalScrollDirRef.current =
                            null;

                        pedalLastTickRef.current =
                            0;
                    }
                };

                pedalRafRef.current =
                    requestAnimationFrame(
                        tick
                    );
            },
            [
                getMaxScroll,
                getScrollProgress,
                notifyProgress,
                scrollRef,
            ]
        );

    const stopPedalScroll =
        useCallback(() => {
            pedalTargetVelRef.current =
                0;
        }, []);

    // ─────────────────────────────────────────────
    // Scroll por líneas lógicas (pedal WiFi)
    //
    // Trabaja con una posición expresada en líneas
    // (ej. 42.6), no en píxeles. Cada dispositivo la
    // convierte a píxeles con las alturas que midió
    // SongContent, así que dos pantallas distintas
    // muestran la misma zona de la canción.
    //
    // El pedal Bluetooth NO usa esto: sigue con el
    // loop en píxeles de más arriba.
    // ─────────────────────────────────────────────

    const lineCountRef = useRef(lineCount);
    lineCountRef.current = lineCount;

    const lineYRef = useRef<(number | undefined)[]>([]);
    const lineHRef = useRef<(number | undefined)[]>([]);
    const containerYRef = useRef(0);
    const topsCacheRef = useRef<number[] | null>(null);

    // Posición lógica vigente y el scrollY que le corresponde.
    // Si el scroll real ya no coincide con lineScrollYRef,
    // alguien más lo movió (dedo, autoscroll, pedal BT) y
    // se vuelve a derivar la posición desde el scroll.
    const linePosRef = useRef<number | null>(null);
    const lineScrollYRef = useRef(0);
    const ignoreScrollUntilRef = useRef(0);

    // Velocidad del pedal: valores por defecto hasta que el ESP32 envíe CFG.
    const linesPerSecRef = useRef(WIFI_PEDAL_LINES_PER_SEC);
    const rampMsRef = useRef(WIFI_PEDAL_RAMP_MS);

    // Posición final (moving=0) que llegó mientras el loop local seguía frenando.
    const serverFinalPosRef = useRef<number | null>(null);

    const linePedalRafRef = useRef<number | null>(null);
    const linePedalDirRef = useRef<'up' | 'down' | null>(null);
    const linePedalVelRef = useRef(0);
    const linePedalTargetRef = useRef(0);
    const linePedalLastTickRef = useRef(0);

    const handleLineLayout = useCallback(
        (lineIndex: number, y: number, height: number) => {
            lineYRef.current[lineIndex] = y;
            lineHRef.current[lineIndex] = height;
            topsCacheRef.current = null;
            bumpLineMapVersion();
        },
        [bumpLineMapVersion]
    );

    const handleContainerLayout = useCallback((y: number) => {
        containerYRef.current = y;
        topsCacheRef.current = null;
        bumpLineMapVersion();
    }, [bumpLineMapVersion]);

    const getTops = useCallback(() => {
        const count = lineCountRef.current;
        const cached = topsCacheRef.current;

        if (cached && cached.length === count + 1) {
            return cached;
        }

        const tops = buildTops(
            lineYRef.current,
            lineHRef.current,
            count,
            containerYRef.current,
            contentHeightRef.current
        );

        topsCacheRef.current = tops;
        return tops;
    }, []);

    const hasLineMap = useCallback(() => {
        const count = lineCountRef.current;

        if (count <= 0 || viewportHeightRef.current <= 0) {
            return false;
        }

        for (let i = 0; i < count; i++) {
            if (lineYRef.current[i] !== undefined) {
                return true;
            }
        }

        return false;
    }, []);

    /** Línea (decimal) que hoy está en el punto de anclaje del viewport. */
    const getLinePos = useCallback(() => {
        const anchorY =
            scrollPosRef.current +
            viewportHeightRef.current * LINE_ANCHOR_FRACTION;

        return yToPos(getTops(), anchorY);
    }, [getTops]);

    const getTrustedLinePos = useCallback(() => {
        if (
            linePosRef.current !== null &&
            Math.abs(scrollPosRef.current - lineScrollYRef.current) <
            LINE_TRUST_TOLERANCE_PX
        ) {
            return linePosRef.current;
        }

        return getLinePos();
    }, [getLinePos]);

    /** Lleva el viewport a que la línea `pos` quede en el punto de anclaje. */
    const applyLinePos = useCallback(
        (pos: number, animated: boolean) => {
            const clamped = Math.min(
                lineCountRef.current,
                Math.max(0, pos)
            );

            const targetY =
                posToY(getTops(), clamped) -
                viewportHeightRef.current * LINE_ANCHOR_FRACTION;

            const y = Math.max(0, Math.min(getMaxScroll(), targetY));

            linePosRef.current = clamped;
            lineScrollYRef.current = y;
            scrollPosRef.current = y;

            // Evita que los onScroll que dispara este mismo scrollTo
            // pisen scrollPosRef con valores intermedios.
            ignoreScrollUntilRef.current =
                Date.now() + (animated ? 700 : 250);

            scrollRef.current?.scrollTo({ y, animated });
        },
        [getTops, getMaxScroll, scrollRef]
    );

    const cancelLinePedalLoop = useCallback(() => {
        if (linePedalRafRef.current !== null) {
            cancelAnimationFrame(linePedalRafRef.current);
            linePedalRafRef.current = null;
        }

        linePedalVelRef.current = 0;
        linePedalTargetRef.current = 0;
        linePedalDirRef.current = null;
        linePedalLastTickRef.current = 0;
        serverFinalPosRef.current = null;
    }, []);

    const scrollToLinePos = useCallback(
        (pos: number, animated = true) => {
            cancelLinePedalLoop();
            applyLinePos(pos, animated);
            notifyProgress(getScrollProgress(), true);
        },
        [
            cancelLinePedalLoop,
            applyLinePos,
            notifyProgress,
            getScrollProgress,
        ]
    );

    const startLinePedalScroll = useCallback(
        (direction: 'up' | 'down') => {
            // Si el loop en píxeles estuviera activo, se corta.
            if (pedalRafRef.current !== null) {
                cancelAnimationFrame(pedalRafRef.current);
                pedalRafRef.current = null;
            }

            pedalVelocityRef.current = 0;
            pedalTargetVelRef.current = 0;
            pedalScrollDirRef.current = null;
            pedalLastTickRef.current = 0;

            serverFinalPosRef.current = null;

            linePedalDirRef.current = direction;
            linePedalTargetRef.current = linesPerSecRef.current;

            if (linePedalRafRef.current !== null) {
                return;
            }

            linePosRef.current = getTrustedLinePos();
            lineScrollYRef.current = scrollPosRef.current;
            linePedalVelRef.current = 0;
            linePedalLastTickRef.current = 0;

            const tick = (timestamp: number) => {
                if (linePedalLastTickRef.current === 0) {
                    linePedalLastTickRef.current = timestamp;
                    linePedalRafRef.current =
                        requestAnimationFrame(tick);
                    return;
                }

                const dt = Math.min(
                    timestamp - linePedalLastTickRef.current,
                    50
                );

                linePedalLastTickRef.current = timestamp;

                const target = linePedalTargetRef.current;
                const rate =
                    (linesPerSecRef.current / rampMsRef.current) * dt;

                let vel = linePedalVelRef.current;

                vel =
                    target > vel
                        ? Math.min(target, vel + rate)
                        : Math.max(target, vel - rate);

                linePedalVelRef.current = vel;

                const dir = linePedalDirRef.current;

                // Solo se detiene cuando ya no se pide movimiento (pedal soltado)
                // y la velocidad llegó a cero; al acelerar desde cero la
                // velocidad de los primeros frames es menor al umbral.
                if (
                    dir !== null &&
                    (vel > LINE_MIN_VELOCITY || target > 0)
                ) {
                    const current = linePosRef.current ?? 0;
                    const next =
                        current +
                        (dir === 'down' ? 1 : -1) * vel * (dt / 1000);

                    applyLinePos(next, false);
                    notifyProgress(getScrollProgress());

                    linePedalRafRef.current =
                        requestAnimationFrame(tick);
                } else {
                    linePedalRafRef.current = null;
                    linePedalVelRef.current = 0;
                    linePedalTargetRef.current = 0;
                    linePedalDirRef.current = null;
                    linePedalLastTickRef.current = 0;

                    // Si el ESP32 ya informó dónde quedó, terminar exactamente ahí.
                    const finalPos = serverFinalPosRef.current;
                    serverFinalPosRef.current = null;

                    if (finalPos !== null) {
                        applyLinePos(finalPos, true);
                    }

                    notifyProgress(getScrollProgress(), true);
                }
            };

            linePedalRafRef.current = requestAnimationFrame(tick);
        },
        [applyLinePos, getTrustedLinePos, notifyProgress, getScrollProgress]
    );

    const stopLinePedalScroll = useCallback(() => {
        linePedalTargetRef.current = 0;
    }, []);

    const setLinePedalConfig = useCallback(
        (linesPerSec: number, rampMs: number) => {
            if (linesPerSec > 0 && linesPerSec <= 20) {
                linesPerSecRef.current = linesPerSec;
            }

            if (rampMs >= 1 && rampMs <= 2000) {
                rampMsRef.current = rampMs;
            }
        },
        []
    );

    /**
     * Posición publicada por el ESP32 (fuente de verdad).
     *
     * - Con el loop local corriendo: se corrige una fracción del error (o se
     *   salta si es grande) para que el movimiento siga fluido.
     * - La posición final (moving=false) se aplica cuando el loop frena.
     * - Sin loop local (dispositivo que no recibió el inicio, o ya parado):
     *   se lleva el scroll a esa posición con animación.
     */
    const applyServerLinePos = useCallback(
        (pos: number, moving: boolean) => {
            if (!Number.isFinite(pos)) {
                return;
            }

            if (linePedalRafRef.current !== null) {
                if (!moving) {
                    serverFinalPosRef.current = pos;
                    return;
                }

                const current = linePosRef.current ?? pos;
                const error = pos - current;

                linePosRef.current =
                    Math.abs(error) > SERVER_SNAP_LINES
                        ? pos
                        : current + error * SERVER_BLEND;

                return;
            }

            if (Math.abs(pos - getTrustedLinePos()) < LINE_SYNC_EPSILON) {
                return;
            }

            applyLinePos(pos, true);
            notifyProgress(getScrollProgress(), true);
        },
        [applyLinePos, getTrustedLinePos, notifyProgress, getScrollProgress]
    );

    const getLineReport = useCallback(() => {
        if (!hasLineMap()) {
            return null;
        }

        return {
            visible: minVisibleLines(
                getTops(),
                viewportHeightRef.current
            ),
            total: lineCountRef.current,
            pos: getTrustedLinePos(),
        };
    }, [hasLineMap, getTops, getTrustedLinePos]);

    useEffect(() => {
        if (!isScrolling) {
            if (
                scrollIntervalRef.current !==
                null
            ) {
                clearInterval(
                    scrollIntervalRef.current
                );

                scrollIntervalRef.current =
                    null;
            }

            return;
        }

        if (
            scrollIntervalRef.current !==
            null
        ) {
            return;
        }

        scrollIntervalRef.current =
            setInterval(() => {
                const maxScroll =
                    getMaxScroll();

                scrollPosRef.current =
                    Math.min(
                        maxScroll,
                        scrollPosRef.current +
                        scrollSpeed * 0.5
                    );

                scrollRef.current?.scrollTo({
                    y: scrollPosRef.current,
                    animated: false,
                });

                notifyProgress(
                    getScrollProgress()
                );
            }, 16);

        return () => {
            if (
                scrollIntervalRef.current !==
                null
            ) {
                clearInterval(
                    scrollIntervalRef.current
                );

                scrollIntervalRef.current =
                    null;
            }
        };
    }, [
        isScrolling,
        scrollSpeed,
        scrollRef,
        getMaxScroll,
        getScrollProgress,
        notifyProgress,
    ]);

    const handleScroll =
        useCallback(
            (offsetY: number) => {
                if (
                    !isScrolling &&
                    pedalScrollDirRef.current ===
                    null &&
                    Date.now() >=
                    ignoreScrollUntilRef.current
                ) {
                    scrollPosRef.current =
                        offsetY;

                    notifyProgress(
                        getScrollProgress()
                    );
                }
            },
            [
                isScrolling,
                getScrollProgress,
                notifyProgress,
            ]
        );

    const handlePedalScrollUp =
        useCallback(() => {
            startPedalScroll('up');
        }, [startPedalScroll]);

    const handlePedalScrollDown =
        useCallback(() => {
            startPedalScroll('down');
        }, [startPedalScroll]);

    const goToSongStart = useCallback(
        (animated = true) => {
            stopPedalScroll();

            scrollPosRef.current = 0;

            scrollRef.current?.scrollTo({
                y: 0,
                animated,
            });

            notifyProgress(getScrollProgress(), true);
        },
        [stopPedalScroll, scrollRef, notifyProgress, getScrollProgress]
    );

    const goToSongEnd = useCallback(
        (animated = true) => {
            stopPedalScroll();

            const maxScroll = getMaxScroll();

            scrollPosRef.current = maxScroll;

            scrollRef.current?.scrollTo({
                y: maxScroll,
                animated,
            });

            notifyProgress(getScrollProgress(), true);
        },
        [stopPedalScroll, getMaxScroll, scrollRef, notifyProgress, getScrollProgress]
    );

    useEffect(() => {
        return () => {
            if (
                scrollIntervalRef.current !==
                null
            ) {
                clearInterval(
                    scrollIntervalRef.current
                );

                scrollIntervalRef.current =
                    null;
            }

            if (
                pedalRafRef.current !==
                null
            ) {
                cancelAnimationFrame(
                    pedalRafRef.current
                );

                pedalRafRef.current = null;
            }

            if (
                linePedalRafRef.current !==
                null
            ) {
                cancelAnimationFrame(
                    linePedalRafRef.current
                );

                linePedalRafRef.current = null;
            }

            if (lineMapTimerRef.current !== null) {
                clearTimeout(lineMapTimerRef.current);
                lineMapTimerRef.current = null;
            }

            pedalVelocityRef.current = 0;
            pedalTargetVelRef.current = 0;
            pedalScrollDirRef.current = null;
            pedalLastTickRef.current = 0;
            pendingProgressRef.current = null;
        };
    }, []);

    return {
        scrollPosRef,
        viewportHeightRef,
        contentHeightRef,
        isScrollEnabled,
        setIsScrollEnabled,
        pedalRafRef,
        pedalScrollDirRef,
        startPedalScroll,
        stopPedalScroll,
        handlePedalScrollUp,
        handlePedalScrollDown,
        handleScroll,
        handleScrollAreaLayout,
        handleContentSizeChange,
        getScrollProgress,
        scrollToProgress,
        goToSongStart,
        goToSongEnd,
        scrollAreaPageY,
        scrollAreaPageX,
        measureScrollArea,
        hasLineMap,
        handleLineLayout,
        handleContainerLayout,
        getLinePos,
        scrollToLinePos,
        startLinePedalScroll,
        stopLinePedalScroll,
        lineMapVersion,
        getLineReport,
        applyServerLinePos,
        setLinePedalConfig,
    };
};