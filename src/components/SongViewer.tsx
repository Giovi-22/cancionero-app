import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SongMetadata } from '../types';

import {
  DirectorEvent,
  DirectorEventType,
} from '../types/band';

import { PdfService } from '../services/PdfService';
import { BluetoothInputBridge } from './BluetoothInputBridge';
import { usePedal } from '../hooks/usePedal';
import { PedalEvent, PedalMode } from '../types/pedal';
import { GestureDetector } from 'react-native-gesture-handler';

// Hooks
import { useSongScroll } from '../hooks/useSongScroll';
import { useSongContent } from '../hooks/useSongContent';
import { useSongSettings } from '../hooks/useSongSettings';
import { useSongMetronome } from '../hooks/useSongMetronome';
import { useSongNotes } from '../hooks/useSongNotes';
import { useSongEditor } from '../hooks/useSongEditor';
import { useSongPinchZoom } from '../hooks/useSongPinchZoom';
import { useSongSections } from '../hooks/useSongSections';

// Sub-componentes
import { DraggableNote } from './songViewer/DraggableNote';
import { EditToolBanner } from './songViewer/EditToolBanner';
import { NoteModeBanner } from './songViewer/NoteModeBanner';
import { FloatingControlsBar } from './songViewer/FloatingControlsBar';
import { NoteEditOverlay } from './songViewer/NoteEditOverlay';
import { ColorPickerModal } from './songViewer/ColorPickerModal';
import { ChordProModal } from './songViewer/ChordProModal';
import { LineEditModal } from './songViewer/LineEditModal';
import { SongViewerInfoBar } from './songViewer/SongViewerInfoBar';
import { SongViewerHeader } from './songViewer/SongViewerHeader';
import { SetlistNavSubHeader } from './songViewer/SetlistNavSubHeader';
import { SettingsModal } from './SettingsModal';
import { SongContent } from './songViewer/SongContent';
import { FontSizeIndicator } from './songViewer/FontSizeIndicator';
import { COLORS } from '../constants/theme';
import { features } from '../config/features';
import { makeSongKey } from '../utils/SongKey';
import { StorageService } from '../services/StorageService';


interface SongViewerProps {
  content: string;
  title: string;
  songId: string;
  onClose: () => void;
  initialSettings?: any;
  onSaveSettings?: (settings: any) => void;

  /**
   * Indica que la canción pertenece al repertorio
   * pero no está disponible localmente en este dispositivo.
   *
   * El SongViewer se mantiene completamente funcional
   * (header, navegación, controles, settings, etc.),
   * pero el área de contenido muestra un mensaje.
   */
  isSongUnavailable?: boolean;

  isDirector?: boolean;
  isFollower?: boolean;
  isActive?: boolean;
  followDirector?: boolean;
  onFollowDirectorChange?: (
    enabled: boolean
  ) => void;

  setlistSongs?: SongMetadata[];
  onDirectorNext?: () => void;
  onDirectorPrev?: () => void;

  onSendDirectorEvent?: (
    type: DirectorEventType,
    payload?: DirectorEvent['payload']
  ) => void;

  incomingDirectorEvent?: DirectorEvent | null;

  globalTheme?: any;
  onSaveGlobalTheme?: (
    theme: any
  ) => void;

  onContentUpdated?: (
    newContent: string
  ) => void;

  setlistNotes?: string;
  songNote?: string;
}

export const SongViewer: React.FC<
  SongViewerProps
> = ({
  content,
  title,
  songId,
  onClose,
  initialSettings,
  onSaveSettings,
  isSongUnavailable = false,

  isDirector = false,
  isFollower = false,

  isActive = true,

  followDirector = true,
  onFollowDirectorChange,
  setlistSongs = [],
  onDirectorNext,
  onDirectorPrev,
  onSendDirectorEvent,

  incomingDirectorEvent,

  globalTheme,
  onSaveGlobalTheme,
  onContentUpdated,

  setlistNotes,
  songNote,
}) => {
    // ─────────────────────────────────────────────
    // Settings
    // ─────────────────────────────────────────────

    const {
      transpose,
      setTranspose,

      capo,
      setCapo,

      fontSize,
      setFontSize,

      viewMode,
      setViewMode,

      isScrolling,
      setIsScrolling,

      scrollSpeed,
      setScrollSpeed,

      pedalSpeed,
      setPedalSpeed,

      isStageMode,
      setIsStageMode,

      isSettingsOpen,
      setIsSettingsOpen,

      musicianNotes,
      setMusicianNotes,

      bpm,
      setBpm,
    } = useSongSettings({
      songId,
      initialSettings,
      onSaveSettings,
    });

    // ─────────────────────────────────────────────
    // Metrónomo
    // ─────────────────────────────────────────────

    const {
      isMetronomeActive,
      setIsMetronomeActive,

      beat,

      metronomeMuted,
      setMetronomeMuted,

      timeSignature,
      setTimeSignature,
    } = useSongMetronome({
      bpm,
    });

    // ─────────────────────────────────────────────
    // Otros estados
    // ─────────────────────────────────────────────

    const [
      isGeneratingPdf,
      setIsGeneratingPdf,
    ] = useState(false);

    const [
      isDebugMode,
      setIsDebugMode,
    ] = useState(false);

    // ─────────────────────────────────────────────
    // Modo del Pedal
    // ─────────────────────────────────────────────

    const [
      pedalMode,
      setPedalModeState,
    ] = useState<PedalMode>('scroll');

    /**
     * Porcentaje de superposición para el modo "secciones".
     * Indica qué fracción del viewport (en %) muestra el final del
     * verso anterior encima de la nueva sección.
     * Default: 30%.
     */
    const [
      overlapPercent,
      setOverlapPercentState,
    ] = useState(30);

    // Cargar preferencias del pedal persistidas
    useEffect(() => {
      let isMounted = true;
      StorageService.getSetting<PedalMode>('pedal_mode').then(savedMode => {
        if (isMounted && savedMode && (savedMode === 'scroll' || savedMode === 'sections')) {
          setPedalModeState(savedMode);
        }
      });
      StorageService.getSetting<number>('pedal_overlap_percent').then(savedPct => {
        if (isMounted && typeof savedPct === 'number' && savedPct >= 0 && savedPct <= 60) {
          setOverlapPercentState(savedPct);
        }
      });
      return () => {
        isMounted = false;
      };
    }, []);

    const setPedalMode = useCallback((mode: PedalMode) => {
      setPedalModeState(mode);
      StorageService.saveSetting('pedal_mode', mode).catch(e =>
        console.error('[SongViewer] Error saving pedal_mode:', e)
      );
    }, []);

    const setOverlapPercent = useCallback((pct: number) => {
      setOverlapPercentState(pct);
      StorageService.saveSetting('pedal_overlap_percent', pct).catch(e =>
        console.error('[SongViewer] Error saving pedal_overlap_percent:', e)
      );
    }, []);

    const pedalModeRef = useRef<PedalMode>(pedalMode);
    useEffect(() => {
      pedalModeRef.current = pedalMode;
    }, [pedalMode]);

    const overlapPercentRef = useRef(overlapPercent);
    useEffect(() => {
      overlapPercentRef.current = overlapPercent;
    }, [overlapPercent]);

    const [
      theme,
      setTheme,
    ] = useState(
      globalTheme ||
      initialSettings?.theme || {
        background:
          COLORS.background,
        lyrics:
          COLORS.foreground,
        chords:
          COLORS.accent,
      }
    );

    const [
      colorPickerOpen,
      setColorPickerOpen,
    ] = useState(false);

    // ─────────────────────────────────────────────
    // Editor ChordPro
    // ─────────────────────────────────────────────

    const [
      showChordPro,
      setShowChordPro,
    ] = useState(false);

    const [
      isEditToolActive,
      setIsEditToolActive,
    ] = useState(false);

    // ─────────────────────────────────────────────
    // Contenido local
    // ─────────────────────────────────────────────

    const [
      currentContent,
      setCurrentContent,
    ] = useState(content);

    useEffect(() => {
      setCurrentContent(content);
    }, [content]);

    // ─────────────────────────────────────────────
    // Procesamiento canción
    // ─────────────────────────────────────────────

    const {
      displayTitle,
      normalizedContent,
      transposedContent,
      parsedLines,
      originalTone,
      transposedTone,
      soundingKeySemitone,
      soundingKeyName,
    } = useSongContent({
      content,
      title,
      currentContent,
      transpose,
      capo,
    });

    void normalizedContent;

    // ─────────────────────────────────────────────
    // Director → Scroll Position
    // ─────────────────────────────────────────────

    const handleScrollPositionChange =
      useCallback(
        (progress: number) => {
          if (
            !isDirector ||
            !isActive ||
            !onSendDirectorEvent
          ) {
            return;
          }

          onSendDirectorEvent(
            'SCROLL_POSITION',
            {
              progress,
            }
          );
        },
        [
          isDirector,
          isActive,
          onSendDirectorEvent,
        ]
      );

    // ─────────────────────────────────────────────
    // Scroll
    // ─────────────────────────────────────────────

    const scrollRef =
      useRef<ScrollView>(null);

    const scrollAreaRef =
      useRef<View>(null);

    const {
      scrollPosRef,
      isScrollEnabled,
      setIsScrollEnabled,

      handleScroll,

      handlePedalScrollUp:
      startLocalPedalScrollUp,

      handlePedalScrollDown:
      startLocalPedalScrollDown,

      stopPedalScroll,

      goToSongStart,
      goToSongEnd,

      scrollAreaPageY,
      scrollAreaPageX,

      viewportHeightRef,
      contentHeightRef,

      handleScrollAreaLayout,
      handleContentSizeChange,

      getScrollProgress,
      scrollToProgress,

      hasLineMap,
      handleLineLayout,
      handleContainerLayout,
      scrollToLinePos,
      startLinePedalScroll,
      stopLinePedalScroll,
      lineMapVersion,
      getLineReport,
      applyServerLinePos,
      setLinePedalConfig,
      sharedLimitY,
      setSharedMinVisible,
      updateSharedLimit,
      getTops,
    } = useSongScroll({
      scrollRef,
      scrollAreaRef,
      scrollSpeed,
      pedalSpeed,
      isScrolling,

      onScrollPositionChange:
        handleScrollPositionChange,

      lineCount: parsedLines.length,
    });

    void scrollAreaPageX;
    void viewportHeightRef;
    void contentHeightRef;
    void getScrollProgress;

    // ─────────────────────────────────────────────
    // Salto por secciones (modo pedal)
    // ─────────────────────────────────────────────

    const hasSections = useMemo(
      () => parsedLines.some(l => l.type === 'section'),
      [parsedLines]
    );

    const {
      jumpToNextSection,
      jumpToPrevSection,
      resetSectionIndex,
      currentSectionLabel,
      sectionCount,
    } = useSongSections({
      parsedLines,
      scrollRef,
      getTops,
      viewportHeightRef,
      overlapFraction: overlapPercent / 100,
    });

    void sectionCount;

    // Resetear índice de secciones al cambiar de canción
    useEffect(() => {
      resetSectionIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [songId, currentContent]);

    // ─────────────────────────────────────────────
    // Zoom con gesto de dos dedos (Pinch-to-zoom)
    // ─────────────────────────────────────────────

    const {
      pinchGesture,
      displayFontSize,
      showIndicator: showZoomIndicator,
    } = useSongPinchZoom({
      fontSize,
      setFontSize,
      setIsScrollEnabled,
      isScrolling,
      setIsScrolling,
      enabled: !isSongUnavailable,
    });

    // ─────────────────────────────────────────────
    // Editor de notas
    // ─────────────────────────────────────────────

    const {
      editingNote,
      setEditingNote,

      addFloatingNoteAtLine,
      handleSaveNote,
      handleCancelNote,
      handleDeleteNote,
      handleUpdateNote,
    } = useSongNotes({
      isStageMode,
      scrollAreaPageY,
      scrollPosRef,
      musicianNotes,
      setMusicianNotes,
    });

    // ─────────────────────────────────────────────
    // Editor de líneas
    // ─────────────────────────────────────────────

    const {
      editingLineIndex,
      setEditingLineIndex,

      editingLineText,
      setEditingLineText,

      inputSelection,
      setInputSelection,

      insertAtCursor,
      openLineEditModal,
      handleSaveEditedLine,
    } = useSongEditor({
      parsedLines,
      songId,
      currentContent,
      setCurrentContent,
      onContentUpdated,
    });

    // ─────────────────────────────────────────────
    // Pedal — suscripción a PedalEvent vía usePedal
    // ─────────────────────────────────────────────
    const {
      connected: pedalConnected,
      device: pedalDevice,
      connecting: pedalConnecting,
      discovering: pedalDiscovering,
      discover: discoverPedal,
      connect: connectPedal,
      disconnect: disconnectPedal,
      onEvent: onPedalEvent,
      wifiConnected,
      sendHello,
      sendLeave,
      onPosition,
      onWifiMinVisible,
      onWifiConfig,
    } = usePedal();

    // Descubrimiento pasivo en segundo plano si no hay pedal conectado/detectado
    useEffect(() => {
      if (!isActive || wifiConnected || pedalDevice) return;

      let isMounted = true;
      const runDiscover = async () => {
        if (!isMounted || wifiConnected || pedalDevice) return;
        try {
          await discoverPedal(6000);
        } catch {
          // Silencioso
        }
      };

      runDiscover();
      const interval = setInterval(runDiscover, 10000);

      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }, [isActive, wifiConnected, pedalDevice, discoverPedal]);

    const handleConnectPedal = useCallback(async () => {
      if (!pedalDevice || pedalConnecting) return;
      try {
        await connectPedal(pedalDevice);
      } catch (err: any) {
        console.error('[SongViewer] Error connecting to pedal:', err);
        Alert.alert(
          'Error al conectar',
          err?.message || 'No se pudo conectar al pedal WiFi.'
        );
      }
    }, [pedalDevice, pedalConnecting, connectPedal]);

    const handleDisconnectPedal = useCallback(() => {
      disconnectPedal();
    }, [disconnectPedal]);

    /**
     * Indica si el pedal está activo en este momento.
     * Mismo criterio que antes usaba PedalHandler.
     */
    const pedalEnabled = isStageMode && !isSettingsOpen && isActive;
    const pedalEnabledRef = useRef(pedalEnabled);
    useEffect(() => {
      pedalEnabledRef.current = pedalEnabled;
    }, [pedalEnabled]);

    /**
     * Despachador unificado de PedalEvent.
     * Recibe eventos normalizados de ambos adapters (BT y WiFi) a través de PedalService.
     */
    const handlePedalEvent = useCallback(
      (event: PedalEvent) => {
        if (!pedalEnabledRef.current) return;

        // Modo "Salto por secciones": un pulso = saltar a la siguiente/anterior sección.
        // No se usa scroll continuo en este modo.
        if (pedalModeRef.current === 'sections') {
          switch (event.type) {
            case 'DOWN_PRESS':
              jumpToNextSection();
              break;
            case 'UP_PRESS':
              jumpToPrevSection();
              break;
            case 'HOME':
              scrollToLinePos(0, true);
              break;
            case 'END':
              scrollToLinePos(Infinity, true);
              break;
            // RELEASE events are ignored in sections mode
          }
          return;
        }

        // Modo "Scroll continuo" (comportamiento original)
        // El pedal WiFi se comparte entre varios dispositivos: se mueve
        // por líneas lógicas para que todos vean la misma zona.
        // El pedal Bluetooth es de un solo usuario: sigue continuo en píxeles.
        const byLines =
          event.source === 'wifi' && hasLineMap();

        switch (event.type) {
          case 'UP_PRESS':
            if (byLines) {
              startLinePedalScroll('up');
            } else {
              startLocalPedalScrollUp();
            }
            break;
          case 'DOWN_PRESS':
            if (byLines) {
              startLinePedalScroll('down');
            } else {
              startLocalPedalScrollDown();
            }
            break;
          case 'UP_RELEASE':
          case 'DOWN_RELEASE':
            stopPedalScroll();
            stopLinePedalScroll();
            break;
          case 'HOME':
            if (byLines) {
              scrollToLinePos(0, true);
            } else {
              goToSongStart();
            }
            break;
          case 'END':
            if (byLines) {
              scrollToLinePos(Infinity, true);
            } else {
              goToSongEnd();
            }
            break;
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [startLocalPedalScrollUp, startLocalPedalScrollDown, stopPedalScroll, goToSongStart, goToSongEnd, hasLineMap, startLinePedalScroll, stopLinePedalScroll, scrollToLinePos, jumpToNextSection, jumpToPrevSection]
    );

    // Suscribir a eventos normalizados del pedal unificado
    useEffect(() => {
      return onPedalEvent(handlePedalEvent);
    }, [onPedalEvent, handlePedalEvent]);

    // ─────────────────────────────────────────────
    // Pedal WiFi — posición compartida
    //
    // El ESP32 guarda la posición de cada canción (en líneas lógicas) y la
    // publica; cada dispositivo la traduce a píxeles con su propia pantalla.
    // El movimiento local se sigue prediciendo para que sea fluido y la
    // posición del ESP32 lo corrige.
    // ─────────────────────────────────────────────

    // Basada en el contenido original: transponer no la cambia, pero dos
    // versiones distintas de la letra no se mezclan.
    const songKey = useMemo(
      () => makeSongKey(songId, currentContent),
      [songId, currentContent]
    );

    const songKeyRef = useRef(songKey);
    useEffect(() => {
      songKeyRef.current = songKey;
    }, [songKey]);

    const syncWithPedal =
      isActive && isStageMode && wifiConnected && !isSongUnavailable;

    // "Esta canción está abierta, y en mi pantalla entran N líneas."
    // Se reenvía cuando cambia la letra, la pantalla o el contenido.
    useEffect(() => {
      if (!syncWithPedal) return;

      const timer = setTimeout(() => {
        const report = getLineReport();
        if (!report) return;

        sendHello({
          songKey,
          visibleLines: report.visible,
          totalLines: report.total,
          pos: report.pos,
        });
      }, 100);

      return () => clearTimeout(timer);
    }, [syncWithPedal, songKey, lineMapVersion, getLineReport, sendHello]);

    // "Cerré esta canción."
    useEffect(() => {
      if (!syncWithPedal) return;

      return () => {
        sendLeave(songKey);
      };
    }, [syncWithPedal, songKey, sendLeave]);

    // Posición publicada por el ESP32
    useEffect(() => {
      return onPosition(message => {
        if (!pedalEnabledRef.current) return;
        if (message.songKey !== songKeyRef.current) return;

        applyServerLinePos(message.pos, message.moving);
      });
    }, [onPosition, applyServerLinePos]);

    // Líneas que entran en la pantalla más chica con esta canción abierta.
    // Se usa para marcar hasta dónde llega lo que ve esa pantalla.
    useEffect(() => {
      if (!syncWithPedal) {
        setSharedMinVisible(null);
        return;
      }

      const unsubscribe = onWifiMinVisible(message => {
        if (message.songKey !== songKeyRef.current) return;

        setSharedMinVisible(
          message.minVisible > 0 ? message.minVisible : null
        );
      });

      return () => {
        unsubscribe();
        setSharedMinVisible(null);
      };
    }, [syncWithPedal, songKey, onWifiMinVisible, setSharedMinVisible]);

    // Velocidad del pedal definida por el ESP32
    useEffect(() => {
      return onWifiConfig(config => {
        setLinePedalConfig(config.linesPerSec, config.rampMs);
      });
    }, [onWifiConfig, setLinePedalConfig]);

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    const headerFg = useMemo(() => {
      const hex =
        theme.background ||
        '#000000';

      const r = parseInt(
        hex.slice(1, 3) || '0',
        16
      );

      const g = parseInt(
        hex.slice(3, 5) || '0',
        16
      );

      const b = parseInt(
        hex.slice(5, 7) || '0',
        16
      );

      const dark =
        (r * 299 +
          g * 587 +
          b * 114) /
        1000 <
        128;

      return dark
        ? '#ffffff'
        : '#111111';
    }, [theme.background]);

    // ─────────────────────────────────────────────
    // Director / Follower
    // ─────────────────────────────────────────────

    useEffect(() => {
      if (
        !isFollower ||
        !isActive ||
        !followDirector ||
        !incomingDirectorEvent
      ) {
        return;
      }

      if (
        incomingDirectorEvent.type ===
        'SONG_CHANGED'
      ) {
        return;
      }

      /**
       * Sincronización proporcional.
       *
       * El director envía un progress 0..1.
       * Este dispositivo calcula su propio
       * maxScroll y se posiciona en el mismo
       * porcentaje.
       */
      if (
        incomingDirectorEvent.type ===
        'SCROLL_POSITION'
      ) {
        const progress =
          incomingDirectorEvent
            .payload?.progress;

        if (
          typeof progress !==
          'number'
        ) {
          return;
        }

        scrollToProgress(
          progress,
          false
        );
      }
    }, [
      incomingDirectorEvent,
      isFollower,
      isActive,
      followDirector,
      scrollToProgress,
    ]);

    // ─────────────────────────────────────────────
    // Theme
    // ─────────────────────────────────────────────

    useEffect(() => {
      if (globalTheme) {
        setTheme(globalTheme);
      }
    }, [globalTheme]);

    // ─────────────────────────────────────────────
    // PDF
    // ─────────────────────────────────────────────

    const handleSharePdf =
      async () => {
        setIsGeneratingPdf(true);

        try {
          await PdfService.generateAndShareSongPdf(
            displayTitle,
            transposedContent,
            {
              transpose,
              capo,
              fontSize,
              viewMode,
              bpm,
              theme,
            }
          );
        } catch (error) {
          console.error(
            'Error generando PDF:',
            error
          );

          Alert.alert(
            'Error',
            'No se pudo generar el archivo PDF.'
          );
        } finally {
          setIsGeneratingPdf(
            false
          );
        }
      };

    const insets =
      useSafeAreaInsets();

    // ─────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor:
              theme.background,
          },
        ]}
      >
        <SongViewerHeader
          topInset={insets.top}
          headerFg={headerFg}
          displayTitle={displayTitle}
          onClose={onClose}
          isEditToolActive={
            isEditToolActive
          }
          onToggleEditTool={() => {
            if (!isEditToolActive) {
              setIsStageMode(true);
            }
            setIsEditToolActive(!isEditToolActive);
          }}
          isGeneratingPdf={
            isGeneratingPdf
          }
          onSharePdf={
            handleSharePdf
          }
          onOpenChordPro={() =>
            setShowChordPro(true)
          }
          isStageMode={
            isStageMode
          }
          onToggleStageMode={() => {
            if (isStageMode) {
              setIsEditToolActive(false);
            }
            setIsStageMode(!isStageMode);
          }}
        />

        <SongViewerInfoBar
          originalTone={
            originalTone
          }
          transposedTone={
            transposedTone
          }
          transpose={
            transpose
          }
          onTransposeChange={
            setTranspose
          }
          capo={capo}
          onCapoChange={setCapo}
          soundingKeySemitone={
            soundingKeySemitone
          }
          soundingKeyName={
            soundingKeyName
          }
          isScrolling={
            isScrolling
          }
          onToggleScroll={() =>
            setIsScrolling(!isScrolling)
          }
          scrollSpeed={
            scrollSpeed
          }
          setScrollSpeed={setScrollSpeed}
          pedalSpeed={pedalSpeed}
          setPedalSpeed={setPedalSpeed}
          isMetronomeActive={
            isMetronomeActive
          }
          setIsMetronomeActive={
            setIsMetronomeActive
          }
          bpm={bpm}
          setBpm={setBpm}
          timeSignature={timeSignature}
          setTimeSignature={setTimeSignature}
          metronomeMuted={metronomeMuted}
          setMetronomeMuted={setMetronomeMuted}
          beat={beat}
          connected={pedalConnected}
          wifiConnected={wifiConnected}
          pedalConnecting={pedalConnecting}
          pedalDevice={pedalDevice}
          onConnectPedal={handleConnectPedal}
          onDisconnectPedal={handleDisconnectPedal}
          pedalMode={pedalMode}
          onPedalModeChange={setPedalMode}
          overlapPercent={overlapPercent}
          onOverlapPercentChange={setOverlapPercent}
          hasSections={hasSections}
        />

        {isEditToolActive && (
          <EditToolBanner
            onClose={() =>
              setIsEditToolActive(
                false
              )
            }
          />
        )}

        {!isStageMode && (
          <NoteModeBanner
            onClose={() =>
              setIsStageMode(
                true
              )
            }
          />
        )}

        <SetlistNavSubHeader
          isDirector={
            isDirector
          }
          isFollower={
            isFollower
          }
          setlistSongs={
            setlistSongs
          }
          songId={songId}
          onDirectorPrev={
            onDirectorPrev
          }
          onDirectorNext={
            onDirectorNext
          }
          notes={setlistNotes}
          songNote={songNote}
        />
        {/*follow director? */}
        {isFollower && (
          <View
            style={
              styles.followDirectorBar
            }
          >
            <View
              style={
                styles.followDirectorInfo
              }
            >
              <View
                style={[
                  styles.followDirectorDot,
                  followDirector &&
                  styles.followDirectorDotActive,
                ]}
              />

              <View>
                <Text
                  style={
                    styles.followDirectorTitle
                  }
                >
                  Seguir al director
                </Text>

                <Text
                  style={
                    styles.followDirectorSubtitle
                  }
                >
                  {followDirector
                    ? 'Sincronización activa'
                    : 'Modo independiente'}
                </Text>
              </View>
            </View>

            <Switch
              value={
                followDirector
              }
              onValueChange={
                onFollowDirectorChange
              }
              trackColor={{
                false: '#3a3a3a',
                true: COLORS.accent,
              }}
              thumbColor="#ffffff"
              ios_backgroundColor="#3a3a3a"
            />
          </View>
        )}


        <View
          ref={scrollAreaRef}
          style={{
            flex: 1,
          }}
          onLayout={
            handleScrollAreaLayout
          }
        >
          {isSongUnavailable ? (
            <View
              style={[
                styles.unavailableContainer,
                {
                  backgroundColor:
                    theme.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.unavailableTitle,
                  {
                    color:
                      theme.lyrics,
                  },
                ]}
              >
                Canción no disponible
              </Text>

              <Text
                style={[
                  styles.unavailableSubtitle,
                  {
                    color:
                      theme.lyrics,
                  },
                ]}
              >
                Esta canción pertenece al
                repertorio, pero no está
                disponible en este dispositivo.
              </Text>
            </View>
          ) : (
            <GestureDetector gesture={pinchGesture}>
              <View style={styles.scrollWrapper} collapsable={false}>
                <ScrollView
                  ref={scrollRef}
                  style={styles.scroll}
                  contentContainerStyle={
                    styles.scrollContent
                  }
                  onContentSizeChange={
                    handleContentSizeChange
                  }
                  onScroll={e => {
                    handleScroll(
                      e.nativeEvent
                        .contentOffset.y
                    );

                    updateSharedLimit(
                      e.nativeEvent
                        .contentOffset.y
                    );
                  }}
                  scrollEventThrottle={1}
                  scrollEnabled={
                    isScrollEnabled
                  }
                >
                  <SongContent
                    parsedLines={
                      parsedLines
                    }
                    fontSize={
                      fontSize
                    }
                    viewMode={
                      viewMode
                    }
                    theme={theme}
                    isStageMode={
                      isStageMode
                    }
                    isDebugMode={
                      features.debugTools &&
                      isDebugMode
                    }
                    isEditToolActive={
                      isEditToolActive
                    }
                    onLineLayout={
                      handleLineLayout
                    }
                    onContainerLayout={
                      handleContainerLayout
                    }
                    onLinePress={(
                      lineIndex,
                      pageX,
                      pageY
                    ) => {
                      if (
                        isEditToolActive
                      ) {
                        openLineEditModal(
                          lineIndex
                        );
                      } else {
                        addFloatingNoteAtLine(
                          pageX,
                          pageY
                        );
                      }
                    }}
                  />

                  {Object.entries(musicianNotes || {}).map(
                    ([noteId, noteData]: [string, any]) => {
                      if (
                        !noteData ||
                        typeof noteData === 'string' ||
                        !noteData.text
                      ) {
                        return null;
                      }
                      return (
                        <DraggableNote
                          key={noteId}
                          id={noteId}
                          initialText={noteData.text}
                          initialX={noteData.x}
                          initialY={noteData.y}
                          isStageMode={isStageMode}
                          onRequestEdit={(id, text) =>
                            setEditingNote({ id, text })
                          }
                          onUpdate={handleUpdateNote}
                          onDelete={handleDeleteNote}
                          setScrollEnabled={setIsScrollEnabled}
                        />
                      );
                    }
                  )}
                </ScrollView>

                {/* Hasta acá llega lo que ve la pantalla más chica */}
                {sharedLimitY !== null && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.sharedLimit,
                      { top: sharedLimitY },
                    ]}
                  />
                )}

                <FontSizeIndicator
                  visible={showZoomIndicator}
                  fontSize={displayFontSize}
                />
              </View>
            </GestureDetector>
          )}
        </View>

        {/* Barra flotante */}
        {!isSettingsOpen && (
          <FloatingControlsBar
            transpose={
              transpose
            }
            onTransposeDecrease={() =>
              setTranspose(
                p => p - 1
              )
            }
            onTransposeIncrease={() =>
              setTranspose(
                p => p + 1
              )
            }
            isScrolling={
              isScrolling
            }
            scrollSpeed={
              scrollSpeed
            }
            onToggleScroll={() =>
              setIsScrolling(
                !isScrolling
              )
            }
            onOpenSettings={() =>
              setIsSettingsOpen(
                true
              )
            }
            bottomInset={
              insets.bottom
            }
          />
        )}

        {/* Ajustes */}
        <SettingsModal
          visible={
            isSettingsOpen
          }
          onClose={() =>
            setIsSettingsOpen(
              false
            )
          }
          theme={theme}
          fontSize={fontSize}
          setFontSize={setFontSize}
          onOpenColorPicker={() =>
            setColorPickerOpen(
              true
            )
          }
          viewMode={
            viewMode
          }
          setViewMode={
            setViewMode
          }
          isDebugMode={
            isDebugMode
          }
          setIsDebugMode={
            setIsDebugMode
          }
          isEditToolActive={
            isEditToolActive
          }
          setIsEditToolActive={
            setIsEditToolActive
          }
        />

        {/* Pedal — captura HID Bluetooth */}
        <BluetoothInputBridge
          enabled={
            isStageMode &&
            !isSettingsOpen &&
            isActive
          }
        />

        {/* Overlay notas */}
        <NoteEditOverlay
          editingNote={
            editingNote
          }
          setEditingNote={
            setEditingNote
          }
          onSaveNote={
            handleSaveNote
          }
          onCancelNote={
            handleCancelNote
          }
        />

        {/* Color Picker */}
        <ColorPickerModal
          visible={
            colorPickerOpen
          }
          onClose={() =>
            setColorPickerOpen(
              false
            )
          }
          theme={theme}
          setTheme={
            setTheme
          }
          onSaveGlobalTheme={
            onSaveGlobalTheme
          }
        />

        {/* ChordPro (solo desarrollo) */}
        {features.debugTools && (
          <ChordProModal
            visible={
              showChordPro
            }
            onClose={() =>
              setShowChordPro(
                false
              )
            }
            content={
              transposedContent
            }
          />
        )}

        {/* Editor de línea */}
        <LineEditModal
          visible={
            editingLineIndex !==
            null
          }
          lineIndex={
            editingLineIndex
          }
          editingLineText={
            editingLineText
          }
          setEditingLineText={
            setEditingLineText
          }
          setInputSelection={
            setInputSelection
          }
          insertAtCursor={
            insertAtCursor
          }
          onCancel={() =>
            setEditingLineIndex(
              null
            )
          }
          onSave={
            handleSaveEditedLine
          }
        />
      </View>
    );
  };


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  scrollWrapper: {
    flex: 1,
    position: 'relative',
  },

  // Marca sutil: tinte neutro (sirve en fondo claro y oscuro) debajo
  // de una línea fina, hasta donde llega la pantalla más chica.
  sharedLimit: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(128, 128, 128, 0.10)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.45)',
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 200,
    position: 'relative',
  },

  unavailableContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  unavailableTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },

  unavailableSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    opacity: 0.7,
  },

  followDirectorBar: {
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor:
      'rgba(59, 130, 246, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(59, 130, 246, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  followDirectorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  followDirectorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor:
      '#555555',
  },

  followDirectorDotActive: {
    backgroundColor:
      '#ef4444',
  },

  followDirectorTitle: {
    color:
      COLORS.foreground,
    fontSize: 14,
    fontWeight: '600',
  },

  followDirectorSubtitle: {
    color:
      COLORS.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },
});
