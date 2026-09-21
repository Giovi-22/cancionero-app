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
import { PedalEvent } from '../types/pedal';

// Hooks
import { useSongScroll } from '../hooks/useSongScroll';
import { useSongContent } from '../hooks/useSongContent';
import { useSongSettings } from '../hooks/useSongSettings';
import { useSongMetronome } from '../hooks/useSongMetronome';
import { useSongNotes } from '../hooks/useSongNotes';
import { useSongEditor } from '../hooks/useSongEditor';

// Sub-componentes
import { DraggableNote } from './songViewer/DraggableNote';
import { EditToolBanner } from './songViewer/EditToolBanner';
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
import { COLORS } from '../constants/theme';


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
    } = useSongScroll({
      scrollRef,
      scrollAreaRef,
      scrollSpeed,
      pedalSpeed,
      isScrolling,

      onScrollPositionChange:
        handleScrollPositionChange,
    });

    void scrollAreaPageX;
    void viewportHeightRef;
    void contentHeightRef;
    void getScrollProgress;

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
    const { onEvent: onPedalEvent } = usePedal();

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

        switch (event.type) {
          case 'UP_PRESS':
            startLocalPedalScrollUp();
            break;
          case 'DOWN_PRESS':
            startLocalPedalScrollDown();
            break;
          case 'UP_RELEASE':
          case 'DOWN_RELEASE':
            stopPedalScroll();
            break;
          case 'HOME':
            goToSongStart();
            break;
          case 'END':
            goToSongEnd();
            break;
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [startLocalPedalScrollUp, startLocalPedalScrollDown, stopPedalScroll, goToSongStart, goToSongEnd]
    );

    // Suscribir a eventos normalizados del pedal unificado
    useEffect(() => {
      return onPedalEvent(handlePedalEvent);
    }, [onPedalEvent, handlePedalEvent]);

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
          onToggleEditTool={() =>
            setIsEditToolActive(
              !isEditToolActive
            )
          }
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
          onToggleStageMode={() =>
            setIsStageMode(
              !isStageMode
            )
          }
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
          isScrolling={
            isScrolling
          }
          scrollSpeed={
            scrollSpeed
          }
          isMetronomeActive={
            isMetronomeActive
          }
          setIsMetronomeActive={
            setIsMetronomeActive
          }
          beat={beat}
          bpm={bpm}
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
                  isDebugMode
                }
                isEditToolActive={
                  isEditToolActive
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
            </ScrollView>
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
          capo={capo}
          setCapo={setCapo}
          soundingKeySemitone={
            soundingKeySemitone
          }
          soundingKeyName={
            soundingKeyName
          }
          isMetronomeActive={
            isMetronomeActive
          }
          setIsMetronomeActive={
            setIsMetronomeActive
          }
          bpm={bpm}
          setBpm={setBpm}
          timeSignature={
            timeSignature
          }
          setTimeSignature={
            setTimeSignature
          }
          metronomeMuted={
            metronomeMuted
          }
          setMetronomeMuted={
            setMetronomeMuted
          }
          fontSize={
            fontSize
          }
          setFontSize={
            setFontSize
          }
          scrollSpeed={
            scrollSpeed
          }
          setScrollSpeed={
            setScrollSpeed
          }
          pedalSpeed={
            pedalSpeed
          }
          setPedalSpeed={
            setPedalSpeed
          }
          theme={theme}
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

        {/* ChordPro */}
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

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 200,
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
