import {
    RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    ScrollView,
    View,
} from 'react-native';

interface UseSongScrollParams {
    scrollRef: RefObject<ScrollView | null>;
    scrollAreaRef: RefObject<View | null>;

    /**
     * Velocidad del auto-scroll.
     */
    scrollSpeed: number;

    /**
     * Velocidad del pedal.
     */
    pedalSpeed: number;

    /**
     * Si el auto-scroll está activo.
     */
    isScrolling: boolean;
}

export interface UseSongScrollReturn {
    /**
     * Posición actual del scroll.
     */
    scrollPosRef: React.MutableRefObject<number>;

    /**
     * Permite habilitar/deshabilitar el ScrollView.
     * Se usa especialmente mientras se arrastra una nota.
     */
    isScrollEnabled: boolean;
    setIsScrollEnabled: React.Dispatch<
        React.SetStateAction<boolean>
    >;

    /**
     * Referencia al RAF utilizado por el pedal.
     */
    pedalRafRef: React.MutableRefObject<number | null>;

    /**
     * Referencia a la dirección actual del pedal.
     */
    pedalScrollDirRef: React.MutableRefObject<
        'up' | 'down' | null
    >;

    /**
     * Inicia el desplazamiento progresivo del pedal.
     */
    startPedalScroll: (
        direction: 'up' | 'down'
    ) => void;

    /**
     * Detiene progresivamente el desplazamiento del pedal.
     */
    stopPedalScroll: () => void;

    /**
     * Handler para pedal hacia arriba.
     */
    handlePedalScrollUp: () => void;

    /**
     * Handler para pedal hacia abajo.
     */
    handlePedalScrollDown: () => void;

    /**
     * Handler para actualizar la posición cuando
     * el usuario desplaza manualmente la canción.
     */
    handleScroll: (
        offsetY: number
    ) => void;

    /**
     * Posición absoluta del área de scroll en pantalla.
     *
     * Esto será utilizado en la siguiente etapa para
     * calcular la posición de la canción respecto
     * al viewport.
     */
    scrollAreaPageY: React.MutableRefObject<number>;

    scrollAreaPageX: React.MutableRefObject<number>;

    /**
     * Mide la posición del área de canción respecto
     * a la pantalla.
     */
    measureScrollArea: () => void;
}

const ACCEL_RATE = 0.008;
const DECEL_RATE = 0.012;
const MIN_VELOCITY = 0.005;

export const useSongScroll = ({
    scrollRef,
    scrollAreaRef,
    scrollSpeed,
    pedalSpeed,
    isScrolling,
}: UseSongScrollParams): UseSongScrollReturn => {
    // ─────────────────────────────────────────────
    // Estado / refs principales
    // ─────────────────────────────────────────────

    const [isScrollEnabled, setIsScrollEnabled] =
        useState(true);

    /**
     * Posición persistente del ScrollView.
     *
     * No usamos state porque esta posición cambia
     * constantemente durante el scroll.
     */
    const scrollPosRef = useRef(0);

    /**
     * Intervalo utilizado por auto-scroll.
     */
    const scrollIntervalRef =
        useRef<ReturnType<typeof setInterval> | null>(
            null
        );

    // ─────────────────────────────────────────────
    // Medición del viewport
    // ─────────────────────────────────────────────

    const scrollAreaPageY = useRef(0);
    const scrollAreaPageX = useRef(0);

    /**
     * Obtiene la posición absoluta del área de
     * contenido respecto de la pantalla.
     *
     * Actualmente solamente guardamos pageX/pageY.
     *
     * En la siguiente etapa agregaremos:
     *
     * - width
     * - height
     * - contentHeight
     * - posición de cada línea
     * - posición relativa dentro del viewport
     */
    const measureScrollArea = useCallback(() => {
        scrollAreaRef.current?.measure(
            (
                _x,
                _y,
                _width,
                _height,
                pageX,
                pageY
            ) => {
                scrollAreaPageX.current = pageX;
                scrollAreaPageY.current = pageY;
            }
        );
    }, [scrollAreaRef]);

    // ─────────────────────────────────────────────
    // Pedal
    // ─────────────────────────────────────────────

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

    /**
     * Mantenemos la velocidad del pedal en un ref
     * para que el loop de requestAnimationFrame
     * siempre utilice el valor actual sin tener que
     * recrearse.
     */
    useEffect(() => {
        pedalSpeedRef.current = pedalSpeed;
    }, [pedalSpeed]);

    /**
     * Inicia el scroll progresivo del pedal.
     *
     * Conservamos la lógica actual del SongViewer:
     *
     * - aceleración progresiva;
     * - velocidad objetivo;
     * - desaceleración;
     * - requestAnimationFrame;
     * - desplazamiento independiente del render.
     */
    const startPedalScroll = useCallback(
        (
            direction: 'up' | 'down'
        ) => {
            pedalScrollDirRef.current =
                direction;

            pedalTargetVelRef.current =
                pedalSpeedRef.current * 0.3;

            /**
             * Si ya existe un RAF corriendo,
             * solamente actualizamos dirección y
             * velocidad objetivo.
             */
            if (
                pedalRafRef.current !== null
            ) {
                return;
            }

            pedalLastTickRef.current = 0;

            const tick = (
                timestamp: number
            ) => {
                /**
                 * Primer frame: inicializamos el reloj.
                 */
                if (
                    pedalLastTickRef.current === 0
                ) {
                    pedalLastTickRef.current =
                        timestamp;

                    pedalRafRef.current =
                        requestAnimationFrame(
                            tick
                        );

                    return;
                }

                /**
                 * Limitar dt evita saltos grandes si la
                 * aplicación pierde temporalmente frames.
                 */
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

                /**
                 * Aceleración.
                 */
                if (target > 0) {
                    velocity = Math.min(
                        target,
                        velocity +
                        ACCEL_RATE * dt
                    );
                } else {
                    /**
                     * Desaceleración.
                     */
                    velocity = Math.max(
                        0,
                        velocity -
                        DECEL_RATE * dt
                    );
                }

                pedalVelocityRef.current =
                    velocity;

                /**
                 * Mientras exista dirección y velocidad
                 * suficiente, desplazamos el ScrollView.
                 */
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

                    scrollPosRef.current =
                        Math.max(
                            0,
                            scrollPosRef.current +
                            delta
                        );

                    scrollRef.current?.scrollTo({
                        y: scrollPosRef.current,
                        animated: false,
                    });

                    pedalRafRef.current =
                        requestAnimationFrame(
                            tick
                        );
                } else {
                    /**
                     * Terminamos completamente el loop.
                     */
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
                requestAnimationFrame(tick);
        },
        [scrollRef]
    );

    /**
     * Detiene el pedal.
     *
     * No cancelamos inmediatamente el RAF:
     * dejamos que la velocidad llegue a cero de
     * forma progresiva.
     */
    const stopPedalScroll = useCallback(() => {
        pedalTargetVelRef.current = 0;
    }, []);

    // ─────────────────────────────────────────────
    // Auto-scroll
    // ─────────────────────────────────────────────

    useEffect(() => {
        /**
         * Si el auto-scroll no está activo,
         * aseguramos que no quede un intervalo
         * anterior ejecutándose.
         */
        if (!isScrolling) {
            if (
                scrollIntervalRef.current !== null
            ) {
                clearInterval(
                    scrollIntervalRef.current
                );

                scrollIntervalRef.current =
                    null;
            }

            return;
        }

        /**
         * Evitamos crear más de un intervalo.
         */
        if (
            scrollIntervalRef.current !== null
        ) {
            return;
        }

        scrollIntervalRef.current =
            setInterval(() => {
                scrollPosRef.current +=
                    scrollSpeed * 0.5;

                scrollRef.current?.scrollTo({
                    y: scrollPosRef.current,
                    animated: false,
                });
            }, 16);

        return () => {
            if (
                scrollIntervalRef.current !== null
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
    ]);

    // ─────────────────────────────────────────────
    // Scroll manual
    // ─────────────────────────────────────────────

    /**
     * Actualiza nuestra posición interna cuando
     * el usuario mueve manualmente el ScrollView.
     *
     * Mientras el pedal está moviéndose no usamos
     * este valor porque el propio pedal ya modifica
     * scrollPosRef.
     */
    const handleScroll = useCallback(
        (offsetY: number) => {
            if (
                !isScrolling &&
                pedalScrollDirRef.current ===
                null
            ) {
                scrollPosRef.current =
                    offsetY;
            }
        },
        [isScrolling]
    );

    // ─────────────────────────────────────────────
    // Pedal handlers
    // ─────────────────────────────────────────────

    /**
     * Handler público para pedal UP.
     *
     * Importante:
     * El hook NO sabe nada de Director Mode.
     *
     * Director/Follower será responsabilidad de
     * otro hook/componente.
     */
    const handlePedalScrollUp =
        useCallback(() => {
            startPedalScroll('up');
        }, [startPedalScroll]);

    /**
     * Handler público para pedal DOWN.
     */
    const handlePedalScrollDown =
        useCallback(() => {
            startPedalScroll('down');
        }, [startPedalScroll]);

    // ─────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────

    useEffect(() => {
        return () => {
            /**
             * Auto-scroll.
             */
            if (
                scrollIntervalRef.current !== null
            ) {
                clearInterval(
                    scrollIntervalRef.current
                );

                scrollIntervalRef.current =
                    null;
            }

            /**
             * Pedal RAF.
             */
            if (
                pedalRafRef.current !== null
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
        };
    }, []);

    return {
        scrollPosRef,

        isScrollEnabled,
        setIsScrollEnabled,

        pedalRafRef,
        pedalScrollDirRef,

        startPedalScroll,
        stopPedalScroll,

        handlePedalScrollUp,
        handlePedalScrollDown,

        handleScroll,

        scrollAreaPageY,
        scrollAreaPageX,

        measureScrollArea,
    };
};