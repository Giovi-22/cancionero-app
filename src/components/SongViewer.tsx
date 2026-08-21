import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Platform, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';

import {
  parseChordPro, transposeChordPro, extractTitleFromChordPro, rebuildChordProFromParsedLines
} from '../utils/chordpro';
import { legacyToChordPro } from '../utils/legacyToChordPro';
import { transposeChord } from '../utils/chordUtils';
import { LiveSessionService } from '../services/LiveSessionService';
import { SongMetadata } from '../types';
import { PdfService } from '../services/PdfService';
import { FileSystemService } from '../services/FileSystemService';
import { PedalHandler } from './PedalHandler';

// Sub-componentes modularizados
import { DraggableNote } from './songViewer/DraggableNote';
import { EditToolBanner } from './songViewer/EditToolBanner';
import { FloatingControlsBar } from './songViewer/FloatingControlsBar';
import { NoteEditOverlay } from './songViewer/NoteEditOverlay';
import { ColorPickerModal } from './songViewer/ColorPickerModal';
import { ChordProModal } from './songViewer/ChordProModal';
import { LineEditModal } from './songViewer/LineEditModal';
import { SettingsModal } from './songViewer/SettingsModal';
import { SongViewerInfoBar } from './songViewer/SongViewerInfoBar';
import { SongViewerHeader } from './songViewer/SongViewerHeader';
import { SetlistNavSubHeader } from './songViewer/SetlistNavSubHeader';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

const LEGACY_FOOTER_TEXT = "Ministerio de Alabanza ICBS";
const DISPLAY_FOOTER_TEXT = "CANCIONERO APP";

const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};
const NOTES_DISPLAY = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface SongViewerProps {
  content: string;
  title: string;
  songId: string;
  onClose: () => void;
  initialSettings?: any;
  onSaveSettings?: (settings: any) => void;
  // Director mode
  isDirector?: boolean;
  directorSessionId?: string;
  setlistSongs?: SongMetadata[];
  onDirectorNext?: () => void;
  onDirectorPrev?: () => void;
  // Follower mode
  followSessionId?: string;
  onFollowSongChange?: (newSongId: string) => void;
  // Global theme
  globalTheme?: any;
  onSaveGlobalTheme?: (theme: any) => void;
  onContentUpdated?: (newContent: string) => void;
}

export const SongViewer: React.FC<SongViewerProps> = ({
  content, title, songId, onClose,
  initialSettings, onSaveSettings,
  isDirector = false, directorSessionId,
  setlistSongs = [], onDirectorNext, onDirectorPrev,
  followSessionId, onFollowSongChange,
  globalTheme, onSaveGlobalTheme,
  onContentUpdated
}) => {
  // Título a mostrar: prioriza {title:} del contenido ChordPro sobre el nombre del archivo
  const displayTitle = useMemo(() => {
    const titleFromContent = extractTitleFromChordPro(content || '');
    if (titleFromContent) return titleFromContent;
    return (title || '').replace(/\.(chordpro|pro|cho|chopro|crd|txt)$/i, '');
  }, [content, title]);

  const [transpose, setTranspose] = useState<number>(initialSettings?.transpose || 0);
  const [capo, setCapo] = useState(initialSettings?.capo || 0);
  const [fontSize, setFontSize] = useState(initialSettings?.fontSize || 16);
  const [viewMode, setViewMode] = useState<'all' | 'lyrics'>(initialSettings?.viewMode || 'all');
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(initialSettings?.scrollSpeed || 0.2);
  const [pedalSpeed, setPedalSpeed] = useState<number>(initialSettings?.pedalSpeed || 0.2);
  const [isStageMode, setIsStageMode] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [musicianNotes, setMusicianNotes] = useState<any>(initialSettings?.musicianNotes || {});
  const [bpm, setBpm] = useState(initialSettings?.bpm || 120);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const [beat, setBeat] = useState(false);
  const [beatCount, setBeatCount] = useState(0);
  const [metronomeMuted, setMetronomeMuted] = useState(false);
  const [timeSignature, setTimeSignature] = useState(4);
  const beatCountRef = useRef(0);
  const soundAccentRef = useRef<Audio.Sound | null>(null);
  const soundNormalRef = useRef<Audio.Sound | null>(null);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [theme, setTheme] = useState(globalTheme || initialSettings?.theme || {
    background: COLORS.background,
    lyrics: COLORS.foreground,
    chords: COLORS.accent
  });
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const isDark = (hex: string) => {
    const r = parseInt(hex.slice(1, 3) || '0', 16);
    const g = parseInt(hex.slice(3, 5) || '0', 16);
    const b = parseInt(hex.slice(5, 7) || '0', 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };
  const headerFg = isDark(theme.background) ? '#ffffff' : '#111111';

  // Estado del overlay de edición de notas
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);

  // Estado del modal de código ChordPro
  const [showChordPro, setShowChordPro] = useState(false);

  // Estado de la herramienta de edición visual de canciones
  const [isEditToolActive, setIsEditToolActive] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editingLineText, setEditingLineText] = useState('');
  const [inputSelection, setInputSelection] = useState({ start: 0, end: 0 });

  // Estado local sincronizado de la canción
  const [currentContent, setCurrentContent] = useState(content);

  useEffect(() => {
    setCurrentContent(content);
  }, [content]);

  // Insertar acorde en la posición actual del cursor dentro del modal de edición
  const insertAtCursor = (textToInsert: string) => {
    const start = inputSelection.start;
    const end = inputSelection.end;
    const newText = editingLineText.slice(0, start) + textToInsert + editingLineText.slice(end);
    setEditingLineText(newText);
    const newPos = start + textToInsert.length;
    setInputSelection({ start: newPos, end: newPos });
  };

  const openLineEditModal = (lineIndex: number) => {
    const line = parsedLines[lineIndex];
    if (!line) return;

    let lineText = '';
    if (line.type === 'section') {
      lineText = line.blocks.map(b => b.text).join('');
    } else {
      lineText = line.blocks.map(b => (b.chord ? `[${b.chord}]` : '') + (b.text || '')).join('');
    }

    setEditingLineText(lineText);
    setInputSelection({ start: lineText.length, end: lineText.length });
    setEditingLineIndex(lineIndex);
  };

  const handleSaveEditedLine = async () => {
    if (editingLineIndex === null) return;

    const newParsedLines = [...parsedLines];
    const rawLine = editingLineText.trim();

    if (rawLine.startsWith('[') && rawLine.endsWith(']') && !rawLine.slice(1, -1).includes(']')) {
      newParsedLines[editingLineIndex] = {
        type: 'section',
        blocks: [{ text: rawLine }]
      };
    } else {
      const parsedSingleLine = parseChordPro(editingLineText);
      const firstLine = Array.isArray(parsedSingleLine) && parsedSingleLine.length > 0 ? parsedSingleLine[0] : null;
      if (firstLine) {
        newParsedLines[editingLineIndex] = firstLine;
      } else {
        newParsedLines[editingLineIndex] = {
          type: 'chords-lyrics',
          isMetadata: false,
          blocks: [{ text: editingLineText }]
        };
      }
    }

    const updatedChordPro = rebuildChordProFromParsedLines(newParsedLines);
    setCurrentContent(updatedChordPro);

    try {
      await FileSystemService.saveSongContent(songId, updatedChordPro);
      onContentUpdated?.(updatedChordPro);
    } catch (e) {
      console.error('Error guardando línea editada:', e);
    }

    setEditingLineIndex(null);
  };

  // Aislar estado por canción
  const prevSongId = useRef(songId);
  useEffect(() => {
    if (prevSongId.current !== songId) {
      setTranspose(initialSettings?.transpose || 0);
      setCapo(initialSettings?.capo || 0);
      setFontSize(initialSettings?.fontSize || 16);
      setViewMode(initialSettings?.viewMode || 'all');
      setMusicianNotes(initialSettings?.musicianNotes || {});
      setBpm(initialSettings?.bpm || 120);
      prevSongId.current = songId;
    }
  }, [songId, initialSettings]);

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollPosRef = useRef(0);
  const scrollIntervalRef = useRef<any>(null);
  const pedalRafRef = useRef<number | null>(null);
  const pedalLastTickRef = useRef<number>(0);
  const pedalSpeedRef = useRef(0.2);
  const scrollAreaRef = useRef<View>(null);
  const scrollAreaPageY = useRef(0);
  const scrollAreaPageX = useRef(0);

  useEffect(() => {
    pedalSpeedRef.current = pedalSpeed;
  }, [pedalSpeed]);

  const measureScrollArea = () => {
    scrollAreaRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      scrollAreaPageX.current = pageX;
      scrollAreaPageY.current = pageY;
    });
  };

  // ── Metrónomo ──────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    async function loadSounds() {
      try {
        const { sound: soundAccent } = await Audio.Sound.createAsync(
          require('../../assets/click_accent.wav')
        );
        const { sound: soundNormal } = await Audio.Sound.createAsync(
          require('../../assets/click_normal.wav')
        );
        if (isMounted) {
          soundAccentRef.current = soundAccent;
          soundNormalRef.current = soundNormal;
        } else {
          soundAccent.unloadAsync();
          soundNormal.unloadAsync();
        }
      } catch (err) {
        console.log('Error loading metronome sounds', err);
      }
    }
    loadSounds();
    return () => {
      isMounted = false;
      soundAccentRef.current?.unloadAsync();
      soundNormalRef.current?.unloadAsync();
    };
  }, []);

  const playMetronomeClick = async (isDownbeat: boolean) => {
    try {
      const soundObj = isDownbeat ? soundAccentRef.current : soundNormalRef.current;
      if (soundObj) {
        await soundObj.replayAsync();
      }
    } catch (err) {
      console.log('Error playing metronome sound', err);
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (isMetronomeActive) {
      beatCountRef.current = 0;
      setBeatCount(0);
      interval = setInterval(() => {
        const isDownbeat = beatCountRef.current === 0;
        setBeat(true);
        setBeatCount(beatCountRef.current);
        if (!metronomeMuted) playMetronomeClick(isDownbeat);
        setTimeout(() => setBeat(false), 80);

        beatCountRef.current = (beatCountRef.current + 1) % timeSignature;
      }, 60000 / bpm);
    } else {
      beatCountRef.current = 0;
      setBeatCount(0);
    }
    return () => clearInterval(interval);
  }, [isMetronomeActive, bpm, metronomeMuted, timeSignature]);

  // ── Procesar canción ───────────────────────────
  const normalizedContent = useMemo(() => {
    return legacyToChordPro(currentContent);
  }, [currentContent]);

  const transposedContent = useMemo(() => {
    const contentWithoutFooter = normalizedContent.replace(new RegExp(LEGACY_FOOTER_TEXT, 'gi'), '');
    return transposeChordPro(contentWithoutFooter, transpose - capo);
  }, [normalizedContent, transpose, capo]);

  const parsedLines = useMemo(() => {
    const result = parseChordPro(transposedContent);
    const footerNormalized = LEGACY_FOOTER_TEXT.toLowerCase().replace(/\s+/g, ' ').trim();

    return result.map((line) => {
      const lineText = line.blocks
        .map((b) => b.text || '')
        .join('')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      if (lineText.includes(footerNormalized)) {
        return {
          ...line,
          blocks: line.blocks.map(b => ({ ...b, text: ' ' }))
        };
      }
      return line;
    });
  }, [transposedContent]);

  const { originalTone, transposedTone } = useMemo(() => {
    let match = currentContent.match(/\{\s*(?:key|tono|t)\s*:\s*\[?([A-G][b#]?[m]?)\]?\s*\}/i);
    if (!match) {
      match = currentContent.match(/^\s*(?:TONO|KEY):\s*\[?([A-G][b#]?[m]?)\]?/mi);
    }
    const orig = match ? match[1] : null;
    let trans = orig;
    if (orig && (transpose - capo) !== 0) {
      trans = transposeChord(orig, transpose - capo);
    }
    return { originalTone: orig, transposedTone: trans };
  }, [currentContent, transpose, capo]);

  const soundingKeySemitone = useMemo(() => {
    if (!originalTone) return null;
    const baseNote = originalTone.replace(/m$/i, '');
    const baseSemitone = NOTE_SEMITONES[baseNote];
    if (baseSemitone === undefined) return null;
    return (baseSemitone + transpose + 120) % 12;
  }, [originalTone, transpose]);

  const soundingKeyName = useMemo(() => {
    if (soundingKeySemitone === null || !originalTone) return null;
    const isMinor = originalTone.toLowerCase().endsWith('m');
    return NOTES_DISPLAY[soundingKeySemitone] + (isMinor ? 'm' : '');
  }, [soundingKeySemitone, originalTone]);

  // ── Auto-scroll ────────────────────────────────
  useEffect(() => {
    if (isScrolling) {
      scrollIntervalRef.current = setInterval(() => {
        scrollPosRef.current += scrollSpeed * 0.5;
        scrollRef.current?.scrollTo({ y: scrollPosRef.current, animated: false });
      }, 16);
    } else {
      clearInterval(scrollIntervalRef.current);
    }
    return () => clearInterval(scrollIntervalRef.current);
  }, [isScrolling, scrollSpeed]);

  // ── Pedal BT: Scroll Fluido ────────────────────
  const pedalScrollDirRef = useRef<'up' | 'down' | null>(null);
  const pedalVelocityRef = useRef<number>(0);
  const pedalTargetVelRef = useRef<number>(0);
  const ACCEL_RATE = 0.008;
  const DECEL_RATE = 0.012;
  const MIN_VELOCITY = 0.005;

  const startPedalScroll = useCallback((direction: 'up' | 'down') => {
    pedalScrollDirRef.current = direction;
    pedalTargetVelRef.current = pedalSpeedRef.current * 0.3;

    if (pedalRafRef.current !== null) return;
    pedalLastTickRef.current = 0;

    const tick = (timestamp: number) => {
      if (pedalLastTickRef.current === 0) {
        pedalLastTickRef.current = timestamp;
        pedalRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(timestamp - pedalLastTickRef.current, 50);
      pedalLastTickRef.current = timestamp;

      const target = pedalTargetVelRef.current;
      let vel = pedalVelocityRef.current;

      if (target > 0) {
        vel = Math.min(target, vel + ACCEL_RATE * dt);
      } else {
        vel = Math.max(0, vel - DECEL_RATE * dt);
      }

      pedalVelocityRef.current = vel;

      if (vel > MIN_VELOCITY && pedalScrollDirRef.current !== null) {
        const delta = vel * dt * (pedalScrollDirRef.current === 'down' ? 1 : -1);
        scrollPosRef.current = Math.max(0, scrollPosRef.current + delta);
        scrollRef.current?.scrollTo({ y: scrollPosRef.current, animated: false });
        pedalRafRef.current = requestAnimationFrame(tick);
      } else {
        pedalRafRef.current = null;
        pedalVelocityRef.current = 0;
        pedalScrollDirRef.current = null;
        pedalLastTickRef.current = 0;
      }
    };

    pedalRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopPedalScroll = useCallback(() => {
    pedalTargetVelRef.current = 0;
  }, []);

  const handlePedalScrollUp = useCallback(() => startPedalScroll('up'), [startPedalScroll]);
  const handlePedalScrollDown = useCallback(() => startPedalScroll('down'), [startPedalScroll]);

  // ── Director / Follower ────────────────────────
  useEffect(() => {
    if (isDirector && directorSessionId && songId) {
      LiveSessionService.updateCurrentSong(directorSessionId, songId);
    }
  }, [isDirector, directorSessionId, songId]);

  useEffect(() => {
    if (!followSessionId || !onFollowSongChange) return;
    const unsub = LiveSessionService.subscribeToSession(followSessionId, (newSongId) => {
      if (newSongId !== songId) {
        onFollowSongChange(newSongId);
      }
    });
    return unsub;
  }, [followSessionId, songId, onFollowSongChange]);

  useEffect(() => {
    if (globalTheme) {
      setTheme(globalTheme);
    }
  }, [globalTheme]);

  useEffect(() => {
    onSaveSettings?.({
      songId,
      settings: { transpose, capo, fontSize, viewMode, scrollSpeed, pedalSpeed, musicianNotes, bpm }
    });
  }, [transpose, capo, fontSize, viewMode, scrollSpeed, pedalSpeed, musicianNotes, bpm]);

  // ── Generar PDF ────────────────────────────────
  const handleSharePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await PdfService.generateAndShareSongPdf(displayTitle, transposedContent, {
        transpose,
        capo,
        fontSize,
        viewMode,
        bpm,
        theme
      });
    } catch (error) {
      console.error('Error generando PDF:', error);
      Alert.alert('Error', 'No se pudo generar el archivo PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ── Notas flotantes de músicos ─────────────────
  const addFloatingNoteAtLine = (_pageX: number, pageY: number) => {
    if (isStageMode) return;
    const contentY = pageY - scrollAreaPageY.current + scrollPosRef.current;
    const noteId = `note_${Date.now()}`;
    const newY = Math.max(10, Math.round(contentY - 20));
    setEditingNote({ id: noteId, text: '' });
    setMusicianNotes((prev: any) => ({
      ...prev,
      [noteId]: { text: '', x: 20, y: newY }
    }));
  };

  const handleSaveNote = () => {
    if (!editingNote) return;
    const trimmed = editingNote.text.trim();
    if (!trimmed) {
      setMusicianNotes((prev: any) => {
        const next = { ...prev };
        delete next[editingNote.id];
        return next;
      });
    } else {
      setMusicianNotes((prev: any) => ({
        ...prev,
        [editingNote.id]: {
          ...(prev[editingNote.id] || { x: 20, y: 100 }),
          text: trimmed
        }
      }));
    }
    setEditingNote(null);
  };

  const handleCancelNote = () => {
    if (!editingNote) return;
    const existing = musicianNotes[editingNote.id];
    if (!existing || !existing.text) {
      setMusicianNotes((prev: any) => {
        const next = { ...prev };
        delete next[editingNote.id];
        return next;
      });
    }
    setEditingNote(null);
  };

  const handleDeleteNote = (noteId: string) => {
    setMusicianNotes((prev: any) => {
      const next = { ...prev };
      delete next[noteId];
      return next;
    });
  };

  const handleUpdateNote = (noteId: string, text: string, x: number, y: number) => {
    setMusicianNotes((prev: any) => ({
      ...prev,
      [noteId]: { text, x, y }
    }));
  };

  const getRenderItems = useCallback((blocks: any[], isTitle: boolean) => {
    if (isTitle) {
      return blocks.map(b => ({ chord: undefined as string | undefined, text: b.text.replace(/\[TITULO\]/i, '').trim() }));
    }

    const items: { chord?: string; text: string }[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const rawText = block.text || '';
      const words = rawText.match(/^\s+|\S+\s*/g) || [];

      if (words.length === 0) {
        if (block.chord) items.push({ chord: block.chord, text: '' });
        continue;
      }

      if (block.chord) {
        items.push({
          chord: block.chord,
          text: words[0]
        });
        for (let w = 1; w < words.length; w++) {
          items.push({ text: words[w] });
        }
      } else {
        for (let w = 0; w < words.length; w++) {
          items.push({ text: words[w] });
        }
      }
    }

    return items;
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header principal */}
      <SongViewerHeader
        topInset={insets.top}
        headerFg={headerFg}
        displayTitle={displayTitle}
        onClose={onClose}
        isEditToolActive={isEditToolActive}
        onToggleEditTool={() => setIsEditToolActive(!isEditToolActive)}
        isGeneratingPdf={isGeneratingPdf}
        onSharePdf={handleSharePdf}
        onOpenChordPro={() => setShowChordPro(true)}
        isStageMode={isStageMode}
        onToggleStageMode={() => setIsStageMode(!isStageMode)}
      />

      {/* Barra de Información de Estado */}
      <SongViewerInfoBar
        originalTone={originalTone}
        transposedTone={transposedTone}
        transpose={transpose}
        onTransposeChange={setTranspose}
        capo={capo}
        isScrolling={isScrolling}
        scrollSpeed={scrollSpeed}
        isMetronomeActive={isMetronomeActive}
        setIsMetronomeActive={setIsMetronomeActive}
        beat={beat}
        beatCount={beatCount}
        bpm={bpm}
      />

      {/* Banner de Herramienta de Edición Visual */}
      {isEditToolActive && (
        <EditToolBanner onClose={() => setIsEditToolActive(false)} />
      )}

      {/* Sub-header de navegación de lista */}
      <SetlistNavSubHeader
        isDirector={isDirector}
        followSessionId={followSessionId}
        setlistSongs={setlistSongs}
        songId={songId}
        onDirectorPrev={onDirectorPrev}
        onDirectorNext={onDirectorNext}
      />

      {/* Área del Contenido de Canción */}
      <View ref={scrollAreaRef} style={{ flex: 1 }} onLayout={measureScrollArea}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onScroll={e => {
            if (!isScrolling && pedalScrollDirRef.current === null) {
              scrollPosRef.current = e.nativeEvent.contentOffset.y;
            }
          }}
          scrollEventThrottle={1}
          scrollEnabled={isScrollEnabled}
        >
          <View style={styles.songContainer}>
            {parsedLines.map((line, lIndex) => {
              const isTitle = line.type === 'section' && line.blocks[0]?.text.toUpperCase().includes('TITULO');
              const sectionColor = isStageMode ? '#fbbf24' : theme.chords;
              const fullLineText = line.blocks.map(b => b.text).join('');
              const isNonPlayableMetadata = line.isMetadata && /^(NOTA|TONO|KEY|BPM|TEMPO|CAPO|COMP[ÁA]S):/i.test(fullLineText);
              // Línea de "solo acordes" (interludios, instrumentales, etc.): tiene acordes
              // pero ningún texto de letra real debajo (sólo espacios, guiones separadores
              // como "-", marcas de repetición, etc. entre corchetes).
              // Sin esto, dos acordes separados por un único espacio en el ChordPro fuente
              // (ej. "[A] [D] [F#m]") quedan pegados visualmente, porque el ancho del
              // nombre del acorde suele ser mayor que el de un simple espacio.
              const isChordOnlyLine =
                line.type !== 'section' &&
                !line.isMetadata &&
                line.blocks.some(b => !!b.chord) &&
                !/\p{L}{2,}/u.test(fullLineText);

              return (
                <View key={lIndex}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={(e) => {
                      if (isEditToolActive) {
                        openLineEditModal(lIndex);
                      } else {
                        addFloatingNoteAtLine(e.nativeEvent.pageX, e.nativeEvent.pageY);
                      }
                    }}
                    style={[
                      styles.lineWrapper,
                      line.type === 'section' && (isTitle ? styles.titleLine : styles.sectionLine),
                      isEditToolActive && { borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.5)', borderRadius: 4, marginVertical: 2, padding: 3 }
                    ]}
                  >
                    <View style={[
                      styles.blocksContainer,
                      isTitle && { justifyContent: 'center', width: '100%' },
                      isDebugMode && { borderWidth: 1, borderColor: '#3b82f6', borderStyle: 'dashed' }
                    ]}>
                      {getRenderItems(line.blocks, isTitle).map((item, bIndex) => {
                        if (isTitle) {
                          return (
                            <View key={bIndex} style={[styles.block, { width: '100%', alignItems: 'center' }]}>
                              <Text style={[
                                styles.lyricText,
                                { fontSize: fontSize * 1.5, textAlign: 'center', fontWeight: 'bold', lineHeight: fontSize * 1.5 * 1.25, color: theme.lyrics },
                                isDebugMode && { backgroundColor: 'rgba(59, 130, 246, 0.15)' }
                              ]}>
                                {item.text}
                              </Text>
                            </View>
                          );
                        }

                        const hasChord = !!item.chord;

                        if (!hasChord && (!item.text || /^\s+$/.test(item.text))) {
                          return (
                            <Text
                              key={`item-${bIndex}`}
                              style={[
                                styles.lyricText,
                                { fontSize, color: theme.lyrics },
                                line.type === 'section' && { color: sectionColor, fontWeight: 'bold' },
                              ]}
                            >
                              {(item.text || ' ').replace(/ /g, '\u00A0')}
                            </Text>
                          );
                        }

                        const displayText = (item.text || '').replace(/ /g, '\u00A0');
                        const isSpaceOnly = /^\s+$/.test(item.text || '');

                        return (
                          <View
                            key={`item-${bIndex}`}
                            style={[
                              styles.block,
                              line.isMetadata && { flexDirection: 'row', alignItems: 'baseline' },
                              isSpaceOnly && item.text.length > 1 && { minWidth: Math.max(fontSize, item.text.length * (fontSize * 0.45)) },
                              isChordOnlyLine && hasChord && { marginRight: Math.max(6, fontSize * 0.4) },
                              isDebugMode && {
                                borderWidth: 1,
                                borderColor: hasChord ? '#ef4444' : '#3b82f6',
                                borderStyle: hasChord ? 'solid' : 'dotted',
                                padding: 1
                              }
                            ]}
                          >
                            {viewMode !== 'lyrics' && (
                              hasChord ? (
                                <Text style={[
                                  styles.chordText,
                                  { fontSize: fontSize, color: theme.chords },
                                  line.isMetadata && { marginRight: 4 },
                                  isNonPlayableMetadata && { color: theme.lyrics, fontWeight: 'normal' },
                                  isDebugMode && { backgroundColor: 'rgba(239, 68, 68, 0.15)' }
                                ]}>{item.chord}</Text>
                              ) : (
                                <Text style={[styles.chordText, { fontSize, opacity: 0 }]} numberOfLines={1}>
                                  X
                                </Text>
                              )
                            )}
                            <Text style={[
                              styles.lyricText,
                              { fontSize, color: theme.lyrics },
                              line.type === 'section' && { color: sectionColor, fontWeight: 'bold' },
                              isDebugMode && { backgroundColor: hasChord ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.15)' }
                            ]}>
                              {displayText || '\u00A0'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Capa de notas flotantes de músicos */}
            {Object.entries(musicianNotes).map(([id, note]: [string, any]) => (
              <DraggableNote
                key={id}
                id={id}
                initialText={note.text}
                initialX={note.x || 20}
                initialY={note.y || 100}
                isStageMode={isStageMode}
                onRequestEdit={(noteId: string, text: string) => setEditingNote({ id: noteId, text })}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
                setScrollEnabled={setIsScrollEnabled}
              />
            ))}

            {/* Footer Informativo Fijo */}
            <View style={styles.footerContainer}>
              <View style={styles.footerLine} />
              <Text style={styles.footerText}>{DISPLAY_FOOTER_TEXT}</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Barra flotante de controles */}
      {!isSettingsOpen && (
        <FloatingControlsBar
          transpose={transpose}
          onTransposeDecrease={() => setTranspose(p => p - 1)}
          onTransposeIncrease={() => setTranspose(p => p + 1)}
          isScrolling={isScrolling}
          scrollSpeed={scrollSpeed}
          onToggleScroll={() => setIsScrolling(!isScrolling)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          bottomInset={insets.bottom}
        />
      )}

      {/* Ajustes de Canción Sheet */}
      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        capo={capo}
        setCapo={setCapo}
        soundingKeySemitone={soundingKeySemitone}
        soundingKeyName={soundingKeyName}
        isMetronomeActive={isMetronomeActive}
        setIsMetronomeActive={setIsMetronomeActive}
        bpm={bpm}
        setBpm={setBpm}
        timeSignature={timeSignature}
        setTimeSignature={setTimeSignature}
        metronomeMuted={metronomeMuted}
        setMetronomeMuted={setMetronomeMuted}
        beatCountRef={beatCountRef}
        fontSize={fontSize}
        setFontSize={setFontSize}
        scrollSpeed={scrollSpeed}
        setScrollSpeed={setScrollSpeed}
        pedalSpeed={pedalSpeed}
        setPedalSpeed={setPedalSpeed}
        theme={theme}
        onOpenColorPicker={() => setColorPickerOpen(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isDebugMode={isDebugMode}
        setIsDebugMode={setIsDebugMode}
        isEditToolActive={isEditToolActive}
        setIsEditToolActive={setIsEditToolActive}
      />

      {/* Handler para pedal Bluetooth */}
      <PedalHandler
        onScrollUp={handlePedalScrollUp}
        onScrollDown={handlePedalScrollDown}
        onScrollStop={stopPedalScroll}
        enabled={isStageMode && !isSettingsOpen}
      />

      {/* Overlay de edición de notas de músicos */}
      <NoteEditOverlay
        editingNote={editingNote}
        setEditingNote={setEditingNote}
        onSaveNote={handleSaveNote}
        onCancelNote={handleCancelNote}
      />

      {/* Modal Color Picker Unificado */}
      <ColorPickerModal
        visible={colorPickerOpen}
        onClose={() => setColorPickerOpen(false)}
        theme={theme}
        setTheme={setTheme}
        onSaveGlobalTheme={onSaveGlobalTheme}
      />

      {/* Modal de Código ChordPro */}
      <ChordProModal
        visible={showChordPro}
        onClose={() => setShowChordPro(false)}
        content={transposedContent}
      />

      {/* Modal de Edición Visual de Línea */}
      <LineEditModal
        visible={editingLineIndex !== null}
        lineIndex={editingLineIndex}
        editingLineText={editingLineText}
        setEditingLineText={setEditingLineText}
        setInputSelection={setInputSelection}
        insertAtCursor={insertAtCursor}
        onCancel={() => setEditingLineIndex(null)}
        onSave={handleSaveEditedLine}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 200 },
  songContainer: { padding: 20 },
  lineWrapper: { marginBottom: 5, paddingHorizontal: 5, borderRadius: 5 },
  titleLine: { marginTop: 20, marginBottom: 20 },
  sectionLine: { marginTop: 15, marginBottom: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 5 },
  blocksContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  block: { minWidth: 10 },
  chordText: { color: COLORS.accent, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  lyricText: { color: COLORS.foreground, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 22 },
  footerContainer: {
    paddingBottom: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  footerLine: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 15,
  },
  footerText: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
});
