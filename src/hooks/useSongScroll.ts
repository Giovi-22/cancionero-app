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

    /**
     * Notifica cambios de posición del scroll.
     *
     * El valor recibido está normalizado entre 0 y 1:
     * 0 = principio
     * 1 = final
     *
     * Se utiliza principalmente para Director Mode.
     */
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

    scrollAreaPageY: React.MutableRefObject<number>;
    scrollAreaPageX: React.MutableRefObject<number>;

    measureScrollArea: () => void;
}

const ACCEL_RATE = 0.008;
const DECEL_RATE = 0.012;
const MIN_VELOCITY = 0.005;

/**
 * Frecuencia máxima con la que notificamos
 * cambios de posición.
 *
 * No queremos generar un evento de Firestore
 * por cada frame (~60 por segundo).
 */
const POSITION_NOTIFY_INTERVAL = 100;

export const useSongScroll = ({
    scrollRef,
    scrollAreaRef,
    scrollSpeed,
    pedalSpeed,
    isScrolling,
    onScrollPositionChange,
}: UseSongScrollParams): UseSongScrollReturn => {
    const [
        isScrollEnabled,
        setIsScrollEnabled,
    ] = useState(true);

    const scrollPosRef =
        useRef(0);

    const scrollIntervalRef =
        useRef<ReturnType<typeof setInterval> | null>(
            null
        );

    const viewportHeightRef =
        useRef(0);

    const contentHeightRef =
        useRef(0);

    const scrollAreaPageY =
        useRef(0);

    const scrollAreaPageX =
        useRef(0);

    /**
     * Último momento en el que notificamos
     * un cambio de posición.
     */
    const lastPositionNotifyRef =
        useRef(0);

    /**
     * Último progress pendiente de notificar.
     *
     * Sirve para coalescer cambios rápidos.
     */
    const pendingProgressRef =
        useRef<number | null>(null);

    const notifyProgress =
        useCallback(
            (
                progress: number,
                force = false
            ) => {
                if (
                    !onScrollPositionChange
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

                const now =
                    Date.now();

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

                pendingProgressRef.current =
                    null;

                if (
                    value !== null
                ) {
                    onScrollPositionChange(
                        value
                    );
                }
            },
            [
                onScrollPositionChange,
            ]
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
            (
                event: LayoutChangeEvent
            ) => {
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
     * Convierte la posición absoluta actual
     * en un porcentaje normalizado 0..1.
     */
    const getScrollProgress =
        useCallback(() => {
            const maxScroll =
                getMaxScroll();

            if (
                maxScroll <= 0
            ) {
                return 0;
            }

            return Math.min(
                1,
                Math.max(
                    0,
                    scrollPosRef.current /
                    maxScroll
                )
            );
        }, [getMaxScroll]);

    /**
     * Lleva el scroll a una posición normalizada.
     *
     * Cada dispositivo calcula su propio maxScroll,
     * por lo que funciona aunque los tamaños de pantalla
     * o el contenido sean diferentes.
     */
    const scrollToProgress =
        useCallback(
            (
                progress: number,
                animated = true
            ) => {
                const maxScroll =
                    getMaxScroll();

                const safeProgress =
                    Math.min(
                        1,
                        Math.max(
                            0,
                            progress
                        )
                    );

                const targetY =
                    safeProgress *
                    maxScroll;

                scrollPosRef.current =
                    targetY;

                scrollRef.current?.scrollTo({
                    y: targetY,
                    animated,
                });
            },
            [
                getMaxScroll,
                scrollRef,
            ]
        );

    const pedalRafRef =
        useRef<number | null>(null);

    const pedalLastTickRef =
        useRef<number>(0);

    const pedalSpeedRef =
        useRef<number>(
            pedalSpeed
        );

    const pedalScrollDirRef =
        useRef<
            'up' | 'down' | null
        >(null);

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
                direction:
                    | 'up'
                    | 'down'
            ) => {
                pedalScrollDirRef.current =
                    direction;

                pedalTargetVelRef.current =
                    pedalSpeedRef.current *
                    0.3;

                if (
                    pedalRafRef.current !==
                    null
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

                    const dt =
                        Math.min(
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

                    if (
                        target > 0
                    ) {
                        velocity =
                            Math.min(
                                target,
                                velocity +
                                ACCEL_RATE *
                                dt
                            );
                    } else {
                        velocity =
                            Math.max(
                                0,
                                velocity -
                                DECEL_RATE *
                                dt
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

                        scrollRef.current?.scrollTo(
                            {
                                y:
                                    scrollPosRef.current,
                                animated: false,
                            }
                        );

                        /**
                         * Notificamos la posición
                         * normalizada para Director Mode.
                         */
                        notifyProgress(
                            getScrollProgress()
                        );

                        pedalRafRef.current =
                            requestAnimationFrame(
                                tick
                            );
                    } else {
                        /**
                         * Al terminar el movimiento
                         * enviamos una última posición
                         * exacta.
                         */
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
                        scrollSpeed *
                        0.5
                    );

                scrollRef.current?.scrollTo(
                    {
                        y:
                            scrollPosRef.current,
                        animated: false,
                    }
                );

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

                    /**
                     * Manual scrolling también
                     * actualiza el progress.
                     */
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
            startPedalScroll(
                'up'
            );
        }, [
            startPedalScroll,
        ]);

    const handlePedalScrollDown =
        useCallback(() => {
            startPedalScroll(
                'down'
            );
        }, [
            startPedalScroll,
        ]);

    /**
     * Limpieza al desmontar.
     */
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

                pedalRafRef.current =
                    null;
            }

            pedalVelocityRef.current =
                0;

            pedalTargetVelRef.current =
                0;

            pedalScrollDirRef.current =
                null;

            pedalLastTickRef.current =
                0;

            pendingProgressRef.current =
                null;
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

        scrollAreaPageY,
        scrollAreaPageX,

        measureScrollArea,
    };
};