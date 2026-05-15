import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Dimensions, TextInput, Keyboard, Platform, AppState,
  PanResponder, Animated
} from 'react-native';
import {
  ChevronLeft, ChevronRight, Settings, Play, Pause, Maximize2,
  Plus, Minus, X, StickyNote, Clock, Radio
} from 'lucide-react-native';
import {
  transposeText, trimCommonIndentation, cleanSongText, parseSongToBlocks
} from '../utils/chordUtils';
import { LiveSessionService } from '../services/LiveSessionService';
import { SongMetadata } from '../types';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

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
}

export const SongViewer: React.FC<SongViewerProps> = ({
  content, title, songId, onClose,
  initialSettings, onSaveSettings,
  isDirector = false, directorSessionId,
  setlistSongs = [], onDirectorNext, onDirectorPrev,
  followSessionId, onFollowSongChange
}) => {
  const [transpose, setTranspose] = useState(initialSettings?.transpose || 0);
  const [capo, setCapo] = useState(initialSettings?.capo || 0);
  const [fontSize, setFontSize] = useState(initialSettings?.fontSize || 16);
  const [viewMode, setViewMode] = useState<'all' | 'lyrics'>(initialSettings?.viewMode || 'all');
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(initialSettings?.scrollSpeed || 1);
  const [pedalSpeed, setPedalSpeed] = useState(initialSettings?.pedalSpeed || 0.5);
  const [isStageMode, setIsStageMode] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [musicianNotes, setMusicianNotes] = useState<Record<number, string>>(initialSettings?.musicianNotes || {});
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [bpm, setBpm] = useState(initialSettings?.bpm || 120);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const [beat, setBeat] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const scrollPosRef = useRef(0);
  const scrollIntervalRef = useRef<any>(null);
  const pedalIntervalRef = useRef<any>(null);
  const isPedalScrollingRef = useRef(false);

  // ── Widget flotante draggable (Director) ───────
  const { width: SW, height: SH } = Dimensions.get('window');
  const dragPos = useRef(new Animated.ValueXY({ x: SW / 2 - 80, y: SH - 220 })).current;
  const dragOffset = useRef({ x: SW / 2 - 80, y: SH - 220 });
  dragPos.addListener(v => { dragOffset.current = v; });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        dragPos.setOffset({ x: dragOffset.current.x, y: dragOffset.current.y });
        dragPos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: dragPos.x, dy: dragPos.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        dragPos.flattenOffset();
      },
    })
  ).current;

  // ── Metrónomo ──────────────────────────────────
  useEffect(() => {
    let interval: any;
    if (isMetronomeActive) {
      interval = setInterval(() => {
        setBeat(true);
        setTimeout(() => setBeat(false), 100);
      }, 60000 / bpm);
    }
    return () => clearInterval(interval);
  }, [isMetronomeActive, bpm]);

  // ── Procesar canción ───────────────────────────
  const parsedLines = useMemo(() => {
    const cleaned = cleanSongText(content);
    const transposed = transposeText(cleaned, transpose - capo);
    const trimmed = trimCommonIndentation(transposed);
    return parseSongToBlocks(trimmed);
  }, [content, transpose, capo]);

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

  // ── Pedal BT: escuchar eventos de teclado hardware ─────────
  useEffect(() => {
    // En React Native, el pedal BT/HID emite eventos de teclado
    // que se capturan via el listener nativo de AppState + Keyboard
    // La implementación real depende del hardware; aquí usamos el
    // handler de KeyboardAvoidingView expuesto por Keyboard.addListener
    const startPedalScroll = () => {
      if (isPedalScrollingRef.current) return;
      isPedalScrollingRef.current = true;
      pedalIntervalRef.current = setInterval(() => {
        scrollPosRef.current += pedalSpeed * 4;
        scrollRef.current?.scrollTo({ y: scrollPosRef.current, animated: false });
      }, 16);
    };

    const stopPedalScroll = () => {
      isPedalScrollingRef.current = false;
      clearInterval(pedalIntervalRef.current);
    };

    // Exponer globalmente para que el handler nativo pueda llamarlos
    (global as any).__pedalScrollDown = startPedalScroll;
    (global as any).__pedalScrollUp = stopPedalScroll;

    return () => {
      stopPedalScroll();
      delete (global as any).__pedalScrollDown;
      delete (global as any).__pedalScrollUp;
    };
  }, [pedalSpeed]);

  // ── Director: emitir canción cuando se abre ────
  useEffect(() => {
    if (isDirector && directorSessionId && songId) {
      LiveSessionService.updateCurrentSong(directorSessionId, songId);
    }
  }, [isDirector, directorSessionId, songId]);

  // ── Seguidor: escuchar cambios de canción ──────
  useEffect(() => {
    if (!followSessionId || !onFollowSongChange) return;
    const unsub = LiveSessionService.subscribeToSession(followSessionId, (newSongId) => {
      if (newSongId !== songId) {
        onFollowSongChange(newSongId);
      }
    });
    return unsub;
  }, [followSessionId, songId, onFollowSongChange]);

  // ── Guardar ajustes ────────────────────────────
  useEffect(() => {
    onSaveSettings?.({ transpose, capo, fontSize, viewMode, scrollSpeed, pedalSpeed, musicianNotes, bpm });
  }, [transpose, capo, fontSize, viewMode, scrollSpeed, pedalSpeed, musicianNotes, bpm]);

  // ── Notas del músico ───────────────────────────
  const toggleNote = (index: number) => {
    if (isStageMode) return;
    if (editingLine === index) { setEditingLine(null); return; }
    setTempNote(musicianNotes[index] || '');
    setEditingLine(index);
  };

  const deleteNote = (index: number) => {
    const n = { ...musicianNotes };
    delete n[index];
    setMusicianNotes(n);
    setEditingLine(null);
  };

  const saveNote = () => {
    if (editingLine === null) return;
    const n = { ...musicianNotes };
    if (tempNote.trim()) n[editingLine] = tempNote;
    else delete n[editingLine];
    setMusicianNotes(n);
    setEditingLine(null);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      {/* Indicador de metrónomo */}
      {isMetronomeActive && <View style={[styles.metroDot, beat && styles.metroDotActive]} />}

      {/* Indicador de modo */}
      {(isDirector || !!followSessionId) && (
        <View style={[styles.liveIndicator, followSessionId ? styles.followerIndicator : styles.directorIndicator]}>
          <Radio size={12} color="#fff" />
          <Text style={styles.liveIndicatorText}>
            {isDirector ? 'DIRECTOR' : 'EN VIVO'}
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
          <ChevronLeft size={28} color={COLORS.foreground} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={() => setIsStageMode(!isStageMode)} style={styles.headerBtn}>
          <Maximize2 size={24} color={isStageMode ? COLORS.accent : COLORS.foreground} />
        </TouchableOpacity>
      </View>

      {/* Contenido */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={e => { if (!isScrolling) scrollPosRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        <View style={styles.songContainer}>
          {parsedLines.map((line, lIndex) => {
            const isTitle = line.type === 'section' && line.blocks[0]?.text.toUpperCase().includes('TITULO');
            const sectionColor = isStageMode ? '#fbbf24' : COLORS.accent;

            return (
              <View key={lIndex}>
                <TouchableOpacity
                  activeOpacity={isStageMode ? 1 : 0.7}
                  onPress={() => toggleNote(lIndex)}
                  style={[styles.lineWrapper, line.type === 'section' && (isTitle ? styles.titleLine : styles.sectionLine)]}
                >
                  <View style={styles.blocksContainer}>
                    {line.blocks.map((block, bIndex) => (
                      <View key={bIndex} style={[styles.block, isTitle && { width: '100%', alignItems: 'center' }]}>
                        {block.chord && viewMode !== 'lyrics' && (
                          <Text style={[styles.chordText, { fontSize: fontSize * 0.9 }]}>{block.chord}</Text>
                        )}
                        <Text style={[
                          styles.lyricText,
                          { fontSize },
                          line.type === 'section' && { color: sectionColor, fontWeight: 'bold' },
                          isTitle && { fontSize: fontSize * 1.5, textAlign: 'center' }
                        ]}>
                          {isTitle ? block.text.replace(/\[TITULO\]/i, '').trim() : (block.text || ' ')}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {musicianNotes[lIndex] && (
                    <View style={styles.noteRow}>
                      <View style={styles.noteBadge}>
                        <StickyNote size={10} color="#000" />
                        <Text style={styles.noteBadgeText}>{musicianNotes[lIndex]}</Text>
                      </View>
                      {!isStageMode && (
                        <TouchableOpacity onPress={() => deleteNote(lIndex)} style={styles.deleteNoteBtn}>
                          <X size={14} color="#ff4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>

                {editingLine === lIndex && !isStageMode && (
                  <View style={styles.noteEditor}>
                    <TextInput
                      autoFocus style={styles.noteInput} value={tempNote}
                      onChangeText={setTempNote} placeholder="Añadir nota..."
                      placeholderTextColor={COLORS.mutedForeground}
                      onSubmitEditing={saveNote} onBlur={saveNote}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Widget flotante draggable del Director */}
      {isDirector && setlistSongs.length > 0 && (() => {
        const idx = setlistSongs.findIndex(s => s.id === songId);
        const currentName = setlistSongs[idx]?.name || '';
        return (
          <Animated.View
            style={[styles.directorWidget, { left: dragPos.x, top: dragPos.y }]}
            {...panResponder.panHandlers}
          >
            {/* Handle de arrastre */}
            <View style={styles.widgetHandle}>
              <View style={styles.handleDot} />
              <View style={styles.handleDot} />
              <View style={styles.handleDot} />
            </View>

            <View style={styles.widgetBody}>
              {/* Indicador */}
              <View style={styles.widgetBadge}>
                <Radio size={10} color="#fff" />
                <Text style={styles.widgetBadgeText}>DIRECTOR</Text>
              </View>

              {/* Nombre canción actual */}
              <Text style={styles.widgetSongName} numberOfLines={1}>{currentName}</Text>

              {/* Controles prev/next */}
              <View style={styles.widgetControls}>
                <TouchableOpacity
                  onPress={onDirectorPrev}
                  style={[styles.widgetNavBtn, idx <= 0 && styles.widgetNavBtnDisabled]}
                  disabled={idx <= 0}
                >
                  <ChevronLeft size={22} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.widgetCounter}>{idx + 1} / {setlistSongs.length}</Text>

                <TouchableOpacity
                  onPress={onDirectorNext}
                  style={[styles.widgetNavBtn, idx >= setlistSongs.length - 1 && styles.widgetNavBtnDisabled]}
                  disabled={idx >= setlistSongs.length - 1}
                >
                  <ChevronRight size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        );
      })()}

      {/* Barra flotante */}
      {!isSettingsOpen ? (
        <View style={styles.floatingBar}>
          <View style={styles.controlGroup}>
            <TouchableOpacity onPress={() => setTranspose(p => p - 1)} style={styles.smallBtn}>
              <Minus size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.ctrlText}>{transpose > 0 ? `+${transpose}` : transpose}</Text>
            <TouchableOpacity onPress={() => setTranspose(p => p + 1)} style={styles.smallBtn}>
              <Plus size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.playBtn, isScrolling && styles.playBtnActive]}
            onPress={() => setIsScrolling(!isScrolling)}
          >
            {isScrolling ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" />}
            <Text style={styles.playText}>{isScrolling ? `${scrollSpeed}x` : 'Scroll'}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={styles.headerBtn}>
            <Settings size={24} color={COLORS.foreground} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.settingsSheet}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Ajustes de Canción</Text>
            <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
              <X size={24} color={COLORS.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Capo */}
            <Text style={styles.settingLabel}>Capodastro</Text>
            <View style={styles.capoGrid}>
              {[0, 1, 2, 3, 4, 5].map(val => (
                <TouchableOpacity key={val} style={[styles.capoBtn, capo === val && styles.capoBtnActive]} onPress={() => setCapo(val)}>
                  <Text style={[styles.capoText, capo === val && styles.capoTextActive]}>{val === 0 ? 'Off' : val}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Metrónomo */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Metrónomo</Text>
            <View style={styles.controlGroup}>
              <TouchableOpacity onPress={() => setIsMetronomeActive(!isMetronomeActive)} style={[styles.smallBtn, isMetronomeActive && { backgroundColor: COLORS.accent }]}>
                <Clock size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBpm(p => Math.max(40, p - 5))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{bpm} BPM</Text>
              <TouchableOpacity onPress={() => setBpm(p => Math.min(250, p + 5))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
            </View>

            {/* Tamaño letra */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Tamaño Letra</Text>
            <View style={styles.controlGroup}>
              <TouchableOpacity onPress={() => setFontSize(p => Math.max(10, p - 2))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{fontSize}px</Text>
              <TouchableOpacity onPress={() => setFontSize(p => Math.min(40, p + 2))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
            </View>

            {/* Auto-scroll speed */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Velocidad Auto-scroll</Text>
            <View style={styles.controlGroup}>
              <TouchableOpacity onPress={() => setScrollSpeed(p => Math.max(0.1, +(p - 0.1).toFixed(1)))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{scrollSpeed}x</Text>
              <TouchableOpacity onPress={() => setScrollSpeed(p => Math.min(10, +(p + 0.1).toFixed(1)))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
            </View>

            {/* Pedal speed */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Velocidad Pedal</Text>
            <View style={styles.controlGroup}>
              <TouchableOpacity onPress={() => setPedalSpeed(p => Math.max(0.1, +(p - 0.1).toFixed(1)))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{pedalSpeed}x</Text>
              <TouchableOpacity onPress={() => setPedalSpeed(p => Math.min(10, +(p + 0.1).toFixed(1)))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
            </View>

            {/* Vista */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Vista</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity style={[styles.toggleBtn, viewMode === 'all' && styles.toggleBtnActive]} onPress={() => setViewMode('all')}>
                <Text style={[styles.toggleText, viewMode === 'all' && styles.toggleTextActive]}>Todo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, viewMode === 'lyrics' && styles.toggleBtnActive]} onPress={() => setViewMode('lyrics')}>
                <Text style={[styles.toggleText, viewMode === 'lyrics' && styles.toggleTextActive]}>Solo Letra</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={() => setIsSettingsOpen(false)}>
              <Text style={styles.doneBtnText}>Listo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  metroDot: { position: 'absolute', top: 10, left: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent', zIndex: 1000 },
  metroDotActive: { backgroundColor: COLORS.accent },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  directorIndicator: { backgroundColor: '#dc2626' },
  followerIndicator: { backgroundColor: '#7c3aed' },
  liveIndicatorText: { color: '#fff', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerBtn: { padding: 8 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: COLORS.foreground, marginHorizontal: 10 },
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
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  noteBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fbbf24', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  noteBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
  deleteNoteBtn: { padding: 4, backgroundColor: 'rgba(255,68,68,0.1)', borderRadius: 4 },
  noteEditor: { marginTop: 5, backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.accent, padding: 8 },
  noteInput: { color: COLORS.foreground, fontSize: 14 },
  floatingBar: { position: 'absolute', bottom: 30, left: 20, right: 20, height: 60, backgroundColor: 'rgba(26,26,26,0.95)', borderRadius: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, elevation: 5 },
  // Director widget draggable
  directorWidget: {
    position: 'absolute',
    width: 200,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    zIndex: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  widgetHandle: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  handleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  widgetBody: {
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  widgetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  widgetBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  widgetSongName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  widgetControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  widgetNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetNavBtnDisabled: {
    opacity: 0.25,
  },
  widgetCounter: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  controlGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: { width: 30, height: 30, backgroundColor: COLORS.border, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ctrlText: { color: '#fff', fontSize: 15, fontWeight: 'bold', minWidth: 40, textAlign: 'center' },
  divider: { width: 1, height: 30, backgroundColor: COLORS.border },
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  playBtnActive: { backgroundColor: COLORS.accent },
  playText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  settingsSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40, maxHeight: '80%' },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingsTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.foreground },
  settingLabel: { color: COLORS.mutedForeground, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  capoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  capoBtn: { width: 45, height: 45, borderRadius: 12, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  capoBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  capoText: { color: COLORS.mutedForeground, fontWeight: 'bold' },
  capoTextActive: { color: '#fff' },
  toggleGroup: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: 10, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: COLORS.surface },
  toggleText: { color: COLORS.mutedForeground, fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: 'bold' },
  doneBtn: { backgroundColor: COLORS.accent, padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 25 },
  doneBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
