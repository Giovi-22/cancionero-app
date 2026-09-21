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

interface UseSongScrollParams {
    scrollRef: RefObject<ScrollView | null>;
    scrollAreaRef: RefObject<View | null>;
    scrollSpeed: number;
    pedalSpeed: number;
    isScrolling: boolean;
    onScrollPositionChange?: (
        progress: number
    ) => void;
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
            },
            [measureScrollArea]
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
                    null
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
    };
};