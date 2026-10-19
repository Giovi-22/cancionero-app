import { useRef, useState, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { MIN_FONT_SIZE, MAX_FONT_SIZE } from '../constants/songViewer';

export interface UseSongPinchZoomParams {
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  setIsScrollEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  isScrolling?: boolean;
  setIsScrolling?: (scrolling: boolean) => void;
  minFontSize?: number;
  maxFontSize?: number;
  enabled?: boolean;
}

export interface UseSongPinchZoomReturn {
  pinchGesture: ReturnType<typeof Gesture.Pinch>;
  isPinching: boolean;
  displayFontSize: number;
  showIndicator: boolean;
}

/**
 * Hook para gestionar el gesto de pellizco (pinch-to-zoom) con dos dedos
 * en el SongViewer para cambiar el tamaño de letra de manera fluida y reactiva.
 */
export const useSongPinchZoom = ({
  fontSize,
  setFontSize,
  setIsScrollEnabled,
  isScrolling = false,
  setIsScrolling,
  minFontSize = MIN_FONT_SIZE,
  maxFontSize = MAX_FONT_SIZE,
  enabled = true,
}: UseSongPinchZoomParams): UseSongPinchZoomReturn => {
  const [isPinching, setIsPinching] = useState(false);
  const [displayFontSize, setDisplayFontSize] = useState(fontSize);
  const [showIndicator, setShowIndicator] = useState(false);

  // Mantenemos referencias actualizadas para no tener que recrear el gesto en cada re-render
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  const startFontSizeRef = useRef(fontSize);
  const lastReportedSizeRef = useRef(fontSize);
  const isGestureActiveRef = useRef(false);

  const setIsScrollEnabledRef = useRef(setIsScrollEnabled);
  setIsScrollEnabledRef.current = setIsScrollEnabled;

  const isScrollingRef = useRef(isScrolling);
  isScrollingRef.current = isScrolling;

  const setIsScrollingRef = useRef(setIsScrolling);
  setIsScrollingRef.current = setIsScrolling;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const minFontSizeRef = useRef(minFontSize);
  minFontSizeRef.current = minFontSize;

  const maxFontSizeRef = useRef(maxFontSize);
  maxFontSizeRef.current = maxFontSize;

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar displayFontSize cuando cambia externamente (ej: desde SettingsModal)
  useEffect(() => {
    if (!isPinching) {
      setDisplayFontSize(fontSize);
    }
  }, [fontSize, isPinching]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      .runOnJS(true)
      .cancelsTouchesInView(true)
      .onStart(() => {
        if (enabledRef.current === false) return;

        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }

        // Si el autoscroll está activo, pausarlo durante el gesto de zoom
        if (isScrollingRef.current && setIsScrollingRef.current) {
          setIsScrollingRef.current(false);
        }

        isGestureActiveRef.current = true;
        startFontSizeRef.current = fontSizeRef.current;
        lastReportedSizeRef.current = fontSizeRef.current;

        // Desactivar scroll del ScrollView para evitar sacudidas verticales al hacer zoom
        setIsScrollEnabledRef.current(false);
        setIsPinching(true);
        setDisplayFontSize(fontSizeRef.current);
        setShowIndicator(true);
      })
      .onUpdate((event) => {
        if (enabledRef.current === false || !isGestureActiveRef.current) return;

        const min = minFontSizeRef.current;
        const max = maxFontSizeRef.current;

        // Calcular el nuevo tamaño de letra escalando el tamaño inicial del gesto
        const calculatedSize = Math.round(startFontSizeRef.current * event.scale);
        const clampedSize = Math.min(max, Math.max(min, calculatedSize));

        setDisplayFontSize(clampedSize);

        // Solo notificar si cambió el valor entero en px
        if (clampedSize !== lastReportedSizeRef.current) {
          lastReportedSizeRef.current = clampedSize;
          setFontSize(clampedSize);
        }
      })
      .onFinalize(() => {
        if (isGestureActiveRef.current) {
          isGestureActiveRef.current = false;
        }

        // Rehabilitar el scroll
        setIsScrollEnabledRef.current(true);
        setIsPinching(false);

        // Ocultar el indicador visual con un delay suave tras soltar los dedos
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = setTimeout(() => {
          setShowIndicator(false);
          hideTimerRef.current = null;
        }, 850);
      });
  }, [setFontSize]);

  return {
    pinchGesture,
    isPinching,
    displayFontSize,
    showIndicator,
  };
};
