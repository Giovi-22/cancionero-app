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
  TouchableOpacity,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  parseChordPro,
  rebuildChordProFromParsedLines,
} from '../utils/chordpro';

import { SongMetadata } from '../types';

import {
  DirectorEvent,
  DirectorEventType,
} from '../types/band';

import { PdfService } from '../services/PdfService';
import { FileSystemService } from '../services/FileSystemService';
import { PedalHandler } from './PedalHandler';

// Hooks
import { useSongScroll } from '../hooks/useSongScroll';
import { useSongContent } from '../hooks/useSongContent';
import { useSongSettings } from '../hooks/useSongSettings';
import { useSongMetronome } from '../hooks/useSongMetronome';

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

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333',
};

const DISPLAY_FOOTER_TEXT =
  'CANCIONERO APP';

interface SongViewerProps {
  content: string;
  title: string;
  songId: string;
  onClose: () => void;
  initialSettings?: any;
  onSaveSettings?: (settings: any) => void;

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

  onFollowSongChange?: (
    newSongId: string
  ) => void;

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

  onFollowSongChange:
  _onFollowSongChange,

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
      beatCount,

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
    // Editor de notas
    // ─────────────────────────────────────────────

    const [
      editingNote,
      setEditingNote,
    ] = useState<{
      id: string;
      text: string;
    } | null>(null);

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

    const [
      editingLineIndex,
      setEditingLineIndex,
    ] = useState<number | null>(
      null
    );

    const [
      editingLineText,
      setEditingLineText,
    ] = useState('');

    const [
      inputSelection,
      setInputSelection,
    ] = useState({
      start: 0,
      end: 0,
    });

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

      scrollAreaPageY,
      scrollAreaPageX,
      measureScrollArea,
    } = useSongScroll({
      scrollRef,
      scrollAreaRef,
      scrollSpeed,
      pedalSpeed,
      isScrolling,
    });

    void scrollAreaPageX;

    // ─────────────────────────────────────────────
    // Pedal + Director
    // ─────────────────────────────────────────────

    const handlePedalScrollUp =
      useCallback(() => {
        startLocalPedalScrollUp();

        if (
          isDirector &&
          isActive &&
          onSendDirectorEvent
        ) {
          onSendDirectorEvent(
            'SCROLL_UP'
          );
        }
      }, [
        startLocalPedalScrollUp,
        isDirector,
        isActive,
        onSendDirectorEvent,
      ]);

    const handlePedalScrollDown =
      useCallback(() => {
        startLocalPedalScrollDown();

        if (
          isDirector &&
          isActive &&
          onSendDirectorEvent
        ) {
          onSendDirectorEvent(
            'SCROLL_DOWN'
          );
        }
      }, [
        startLocalPedalScrollDown,
        isDirector,
        isActive,
        onSendDirectorEvent,
      ]);

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
    // Edición de línea
    // ─────────────────────────────────────────────

    const insertAtCursor = (
      textToInsert: string
    ) => {
      const start =
        inputSelection.start;

      const end =
        inputSelection.end;

      const newText =
        editingLineText.slice(
          0,
          start
        ) +
        textToInsert +
        editingLineText.slice(end);

      setEditingLineText(
        newText
      );

      const newPos =
        start +
        textToInsert.length;

      setInputSelection({
        start: newPos,
        end: newPos,
      });
    };

    const openLineEditModal = (
      lineIndex: number
    ) => {
      const line =
        parsedLines[lineIndex];

      if (!line) return;

      let lineText = '';

      if (line.type === 'section') {
        lineText = line.blocks
          .map(b => b.text)
          .join('');
      } else {
        lineText = line.blocks
          .map(
            b =>
              (b.chord
                ? `[${b.chord}]`
                : '') +
              (b.text || '')
          )
          .join('');
      }

      setEditingLineText(
        lineText
      );

      setInputSelection({
        start: lineText.length,
        end: lineText.length,
      });

      setEditingLineIndex(
        lineIndex
      );
    };

    const handleSaveEditedLine =
      async () => {
        if (
          editingLineIndex === null
        ) {
          return;
        }

        const newParsedLines =
          [...parsedLines];

        const rawLine =
          editingLineText.trim();

        if (
          rawLine.startsWith('[') &&
          rawLine.endsWith(']') &&
          !rawLine
            .slice(1, -1)
            .includes(']')
        ) {
          newParsedLines[
            editingLineIndex
          ] = {
            type: 'section',
            blocks: [
              {
                text: rawLine,
              },
            ],
          };
        } else {
          const parsedSingleLine =
            parseChordPro(
              editingLineText
            );

          const firstLine =
            Array.isArray(
              parsedSingleLine
            ) &&
              parsedSingleLine.length > 0
              ? parsedSingleLine[0]
              : null;

          if (firstLine) {
            newParsedLines[
              editingLineIndex
            ] = firstLine;
          } else {
            newParsedLines[
              editingLineIndex
            ] = {
              type: 'chords-lyrics',
              isMetadata: false,
              blocks: [
                {
                  text: editingLineText,
                },
              ],
            };
          }
        }

        const updatedChordPro =
          rebuildChordProFromParsedLines(
            newParsedLines
          );

        setCurrentContent(
          updatedChordPro
        );

        try {
          await FileSystemService.saveSongContent(
            songId,
            updatedChordPro
          );

          onContentUpdated?.(
            updatedChordPro
          );
        } catch (e) {
          console.error(
            'Error guardando línea editada:',
            e
          );
        }

        setEditingLineIndex(null);
      };

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

      if (
        incomingDirectorEvent.type ===
        'SCROLL_DOWN'
      ) {
        scrollPosRef.current +=
          250;

        scrollRef.current?.scrollTo({
          y: scrollPosRef.current,
          animated: true,
        });
      } else if (
        incomingDirectorEvent.type ===
        'SCROLL_UP'
      ) {
        scrollPosRef.current =
          Math.max(
            0,
            scrollPosRef.current -
            250
          );

        scrollRef.current?.scrollTo({
          y: scrollPosRef.current,
          animated: true,
        });
      }
    }, [
      incomingDirectorEvent,
      isFollower,
      isActive,
      followDirector,
      scrollRef,
      scrollPosRef,
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

    // ─────────────────────────────────────────────
    // Notas flotantes
    // ─────────────────────────────────────────────

    const addFloatingNoteAtLine =
      (
        _pageX: number,
        pageY: number
      ) => {
        if (isStageMode) {
          return;
        }

        const contentY =
          pageY -
          scrollAreaPageY.current +
          scrollPosRef.current;

        const noteId =
          `note_${Date.now()}`;

        const newY =
          Math.max(
            10,
            Math.round(
              contentY - 20
            )
          );

        setEditingNote({
          id: noteId,
          text: '',
        });

        setMusicianNotes(
          (prev: any) => ({
            ...prev,
            [noteId]: {
              text: '',
              x: 20,
              y: newY,
            },
          })
        );
      };

    const handleSaveNote =
      () => {
        if (!editingNote) {
          return;
        }

        const trimmed =
          editingNote.text.trim();

        if (!trimmed) {
          setMusicianNotes(
            (prev: any) => {
              const next = {
                ...prev,
              };

              delete next[
                editingNote.id
              ];

              return next;
            }
          );
        } else {
          setMusicianNotes(
            (prev: any) => ({
              ...prev,
              [editingNote.id]: {
                ...(prev[
                  editingNote.id
                ] || {
                  x: 20,
                  y: 100,
                }),
                text: trimmed,
              },
            })
          );
        }

        setEditingNote(null);
      };

    const handleCancelNote =
      () => {
        if (!editingNote) {
          return;
        }

        const existing =
          musicianNotes[
          editingNote.id
          ];

        if (
          !existing ||
          !existing.text
        ) {
          setMusicianNotes(
            (prev: any) => {
              const next = {
                ...prev,
              };

              delete next[
                editingNote.id
              ];

              return next;
            }
          );
        }

        setEditingNote(null);
      };

    const handleDeleteNote =
      (noteId: string) => {
        setMusicianNotes(
          (prev: any) => {
            const next = {
              ...prev,
            };

            delete next[noteId];

            return next;
          }
        );
      };

    const handleUpdateNote =
      (
        noteId: string,
        text: string,
        x: number,
        y: number
      ) => {
        setMusicianNotes(
          (prev: any) => ({
            ...prev,
            [noteId]: {
              text,
              x,
              y,
            },
          })
        );
      };

    // ─────────────────────────────────────────────
    // Render de bloques
    // ─────────────────────────────────────────────

    const getRenderItems =
      useCallback(
        (
          blocks: any[],
          isTitle: boolean
        ) => {
          if (isTitle) {
            return blocks.map(
              b => ({
                chord:
                  undefined as
                  | string
                  | undefined,
                text: b.text
                  .replace(
                    /\[TITULO\]/i,
                    ''
                  )
                  .trim(),
              })
            );
          }

          const items: {
            chord?: string;
            text: string;
          }[] = [];

          for (
            let i = 0;
            i < blocks.length;
            i++
          ) {
            const block =
              blocks[i];

            const rawText =
              block.text || '';

            const words =
              rawText.match(
                /^\s+|\S+\s*/g
              ) || [];

            if (
              words.length === 0
            ) {
              if (block.chord) {
                items.push({
                  chord:
                    block.chord,
                  text: '',
                });
              }

              continue;
            }

            if (block.chord) {
              items.push({
                chord:
                  block.chord,
                text: words[0],
              });

              for (
                let w = 1;
                w < words.length;
                w++
              ) {
                items.push({
                  text: words[w],
                });
              }
            } else {
              for (
                let w = 0;
                w < words.length;
                w++
              ) {
                items.push({
                  text: words[w],
                });
              }
            }
          }

          return items;
        },
        []
      );

    const renderChordOnlyLine =
      useCallback(
        (blocks: any[]) => {
          return (
            <Text
              style={[
                styles.lyricText,
                {
                  fontSize,
                  color: theme.lyrics,
                  lineHeight:
                    fontSize * 1.4,
                },
              ]}
            >
              {blocks.map(
                (
                  block,
                  index
                ) => (
                  <React.Fragment
                    key={`chord-only-${index}`}
                  >
                    {block.chord && (
                      <Text
                        style={[
                          styles.chordText,
                          {
                            fontSize,
                            color:
                              theme.chords,
                          },
                        ]}
                      >
                        {
                          block.chord
                        }
                      </Text>
                    )}

                    {block.text && (
                      <Text
                        style={[
                          styles.lyricText,
                          {
                            fontSize,
                            color:
                              theme.lyrics,
                          },
                        ]}
                      >
                        {block.text.replace(
                          / /g,
                          '\u00A0'
                        )}
                      </Text>
                    )}
                  </React.Fragment>
                )
              )}
            </Text>
          );
        },
        [
          fontSize,
          theme.chords,
          theme.lyrics,
        ]
      );

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
              value={followDirector}
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
            measureScrollArea
          }
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={
              styles.scrollContent
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
            <View
              style={
                styles.songContainer
              }
            >
              {parsedLines.map(
                (
                  line,
                  lIndex
                ) => {
                  const isTitle =
                    line.type ===
                    'section' &&
                    line.blocks[0]?.text
                      .toUpperCase()
                      .includes(
                        'TITULO'
                      );

                  const sectionColor =
                    isStageMode
                      ? '#fbbf24'
                      : theme.chords;

                  const fullLineText =
                    line.blocks
                      .map(
                        b =>
                          b.text
                      )
                      .join('');

                  const isNonPlayableMetadata =
                    line.isMetadata &&
                    /^(NOTA|TONO|KEY|BPM|TEMPO|CAPO|COMP[ÁA]S):/i.test(
                      fullLineText
                    );

                  const isChordOnlyLine =
                    line.type !==
                    'section' &&
                    !line.isMetadata &&
                    line.blocks.some(
                      b =>
                        !!b.chord
                    ) &&
                    !/\p{L}{2,}/u.test(
                      fullLineText
                    );

                  return (
                    <View
                      key={lIndex}
                    >
                      <TouchableOpacity
                        activeOpacity={
                          0.7
                        }
                        onPress={e => {
                          if (
                            isEditToolActive
                          ) {
                            openLineEditModal(
                              lIndex
                            );
                          } else {
                            addFloatingNoteAtLine(
                              e.nativeEvent
                                .pageX,
                              e.nativeEvent
                                .pageY
                            );
                          }
                        }}
                        style={[
                          styles.lineWrapper,
                          line.type ===
                          'section' &&
                          (isTitle
                            ? styles.titleLine
                            : styles.sectionLine),
                          isEditToolActive && {
                            borderWidth: 1,
                            borderColor:
                              'rgba(59, 130, 246, 0.5)',
                            borderRadius: 4,
                            marginVertical: 2,
                            padding: 3,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.blocksContainer,
                            isTitle && {
                              justifyContent:
                                'center',
                              width:
                                '100%',
                            },
                            isDebugMode && {
                              borderWidth: 1,
                              borderColor:
                                '#3b82f6',
                              borderStyle:
                                'dashed',
                            },
                          ]}
                        >
                          {isChordOnlyLine
                            ? renderChordOnlyLine(
                              line.blocks
                            )
                            : getRenderItems(
                              line.blocks,
                              isTitle
                            ).map(
                              (
                                item,
                                bIndex
                              ) => {
                                if (
                                  isTitle
                                ) {
                                  return (
                                    <View
                                      key={
                                        bIndex
                                      }
                                      style={[
                                        styles.block,
                                        {
                                          width:
                                            '100%',
                                          alignItems:
                                            'center',
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.lyricText,
                                          {
                                            fontSize:
                                              fontSize *
                                              1.5,
                                            textAlign:
                                              'center',
                                            fontWeight:
                                              'bold',
                                            lineHeight:
                                              fontSize *
                                              1.5 *
                                              1.25,
                                            color:
                                              theme.lyrics,
                                          },
                                          isDebugMode && {
                                            backgroundColor:
                                              'rgba(59, 130, 246, 0.15)',
                                          },
                                        ]}
                                      >
                                        {
                                          item.text
                                        }
                                      </Text>
                                    </View>
                                  );
                                }

                                const hasChord =
                                  !!item.chord;

                                if (
                                  !hasChord &&
                                  (!item.text ||
                                    /^\s+$/.test(
                                      item.text
                                    ))
                                ) {
                                  return (
                                    <Text
                                      key={`item-${bIndex}`}
                                      style={[
                                        styles.lyricText,
                                        {
                                          fontSize,
                                          color:
                                            theme.lyrics,
                                        },
                                        line.type ===
                                        'section' && {
                                          color:
                                            sectionColor,
                                          fontWeight:
                                            'bold',
                                        },
                                      ]}
                                    >
                                      {(
                                        item.text ||
                                        ' '
                                      ).replace(
                                        / /g,
                                        '\u00A0'
                                      )}
                                    </Text>
                                  );
                                }

                                const displayText =
                                  (
                                    item.text ||
                                    ''
                                  ).replace(
                                    / /g,
                                    '\u00A0'
                                  );

                                const isSpaceOnly =
                                  /^\s+$/.test(
                                    item.text ||
                                    ''
                                  );

                                return (
                                  <View
                                    key={`item-${bIndex}`}
                                    style={[
                                      styles.block,
                                      line.isMetadata && {
                                        flexDirection:
                                          'row',
                                        alignItems:
                                          'baseline',
                                      },
                                      isSpaceOnly &&
                                      item
                                        .text
                                        .length >
                                      1 && {
                                        minWidth:
                                          Math.max(
                                            fontSize,
                                            item
                                              .text
                                              .length *
                                            (fontSize *
                                              0.45)
                                          ),
                                      },
                                      isChordOnlyLine &&
                                      hasChord && {
                                        marginRight:
                                          Math.max(
                                            6,
                                            fontSize *
                                            0.4
                                          ),
                                      },
                                      isDebugMode && {
                                        borderWidth: 1,
                                        borderColor:
                                          hasChord
                                            ? '#ef4444'
                                            : '#3b82f6',
                                        borderStyle:
                                          hasChord
                                            ? 'solid'
                                            : 'dotted',
                                        padding: 1,
                                      },
                                    ]}
                                  >
                                    {viewMode !==
                                      'lyrics' &&
                                      (hasChord ? (
                                        <Text
                                          style={[
                                            styles.chordText,
                                            {
                                              fontSize,
                                              color:
                                                theme.chords,
                                            },
                                            line.isMetadata && {
                                              marginRight:
                                                4,
                                            },
                                            isNonPlayableMetadata && {
                                              color:
                                                theme.lyrics,
                                              fontWeight:
                                                'normal',
                                            },
                                            isDebugMode && {
                                              backgroundColor:
                                                'rgba(239, 68, 68, 0.15)',
                                            },
                                          ]}
                                        >
                                          {
                                            item.chord
                                          }
                                        </Text>
                                      ) : (
                                        <Text
                                          style={[
                                            styles.chordText,
                                            {
                                              fontSize,
                                              opacity: 0,
                                            },
                                          ]}
                                          numberOfLines={
                                            1
                                          }
                                        >
                                          X
                                        </Text>
                                      ))}

                                    <Text
                                      style={[
                                        styles.lyricText,
                                        {
                                          fontSize,
                                          color:
                                            theme.lyrics,
                                        },
                                        line.type ===
                                        'section' && {
                                          color:
                                            sectionColor,
                                          fontWeight:
                                            'bold',
                                        },
                                        isDebugMode && {
                                          backgroundColor:
                                            hasChord
                                              ? 'rgba(239, 68, 68, 0.05)'
                                              : 'rgba(59, 130, 246, 0.15)',
                                        },
                                      ]}
                                    >
                                      {displayText ||
                                        '\u00A0'}
                                    </Text>
                                  </View>
                                );
                              }
                            )}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }
              )}

              {/* Notas flotantes */}
              {Object.entries(
                musicianNotes
              ).map(
                ([
                  id,
                  note,
                ]: [
                    string,
                    any
                  ]) => (
                  <DraggableNote
                    key={id}
                    id={id}
                    initialText={
                      note.text
                    }
                    initialX={
                      note.x || 20
                    }
                    initialY={
                      note.y || 100
                    }
                    isStageMode={
                      isStageMode
                    }
                    onRequestEdit={(
                      noteId: string,
                      text: string
                    ) =>
                      setEditingNote({
                        id: noteId,
                        text,
                      })
                    }
                    onUpdate={
                      handleUpdateNote
                    }
                    onDelete={
                      handleDeleteNote
                    }
                    setScrollEnabled={
                      setIsScrollEnabled
                    }
                  />
                )
              )}

              {/* Footer */}
              <View
                style={
                  styles.footerContainer
                }
              >
                <View
                  style={
                    styles.footerLine
                  }
                />

                <Text
                  style={
                    styles.footerText
                  }
                >
                  {
                    DISPLAY_FOOTER_TEXT
                  }
                </Text>
              </View>
            </View>
          </ScrollView>
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
          fontSize={fontSize}
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
          viewMode={viewMode}
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

        {/* Pedal Bluetooth */}
        <PedalHandler
          onScrollUp={
            handlePedalScrollUp
          }
          onScrollDown={
            handlePedalScrollDown
          }
          onScrollStop={
            stopPedalScroll
          }
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

  songContainer: {
    padding: 20,
  },

  lineWrapper: {
    marginBottom: 5,
    paddingHorizontal: 5,
    borderRadius: 5,
  },

  titleLine: {
    marginTop: 20,
    marginBottom: 20,
  },

  sectionLine: {
    marginTop: 15,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(255,255,255,0.1)',
    paddingBottom: 5,
  },

  blocksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },

  block: {
    minWidth: 10,
  },

  chordText: {
    color: COLORS.accent,
    fontWeight: 'bold',
    fontFamily:
      Platform.OS === 'ios'
        ? 'Courier'
        : 'monospace',
  },

  lyricText: {
    color: COLORS.foreground,
    fontFamily:
      Platform.OS === 'ios'
        ? 'Courier'
        : 'monospace',
    lineHeight: 22,
  },

  footerContainer: {
    paddingBottom: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },

  footerLine: {
    width: '100%',
    height: 1,
    backgroundColor:
      'rgba(255,255,255,0.1)',
    marginBottom: 15,
  },

  footerText: {
    color:
      COLORS.mutedForeground,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform:
      'uppercase',
    opacity: 0.6,
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