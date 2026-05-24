import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Dimensions, TextInput, Keyboard, Platform, AppState,
  PanResponder, Animated, Alert, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronRight, Settings, Play, Pause, Maximize2,
  Plus, Minus, X, StickyNote, Clock, Radio, Edit2, List, Share2
} from 'lucide-react-native';
import {
  transposeText, trimCommonIndentation, cleanSongText, parseSongToBlocks
} from '../utils/chordUtils';
import { LiveSessionService } from '../services/LiveSessionService';
import { SongMetadata } from '../types';
import { PdfService } from '../services/PdfService';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

const FOOTER_TEXT = "Ministerio de Alabanza ICBS";

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

const DraggableNote = ({ id, initialText, initialX, initialY, isStageMode, isNew, onUpdate, onDelete, setScrollEnabled }: any) => {
  const pan = useRef(new Animated.ValueXY({ x: initialX || 0, y: initialY || 0 })).current;
  const offset = useRef({ x: initialX || 0, y: initialY || 0 });

  const [isEditing, setIsEditing] = useState(!!isNew);
  const [text, setText] = useState(initialText || '');

  // Keep a mutable ref of the dynamic values to avoid stale closures in PanResponder
  const stateRef = useRef({ isEditing, text, id, onUpdate, setScrollEnabled, isStageMode });
  stateRef.current = { isEditing, text, id, onUpdate, setScrollEnabled, isStageMode };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !stateRef.current.isEditing && !stateRef.current.isStageMode,
      onMoveShouldSetPanResponder: (_, g) => !stateRef.current.isEditing && !stateRef.current.isStageMode && (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5),
      onPanResponderGrant: () => {
        stateRef.current.setScrollEnabled(false);
        pan.setOffset(offset.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        offset.current = { x: (pan.x as any)._value, y: (pan.y as any)._value };
        stateRef.current.onUpdate(
          stateRef.current.id,
          stateRef.current.text,
          offset.current.x,
          offset.current.y
        );
        stateRef.current.setScrollEnabled(true);
      }
    })
  ).current;

  useEffect(() => {
    pan.setValue({ x: initialX || 0, y: initialY || 0 });
    offset.current = { x: initialX || 0, y: initialY || 0 };
  }, [initialX, initialY]);

  const handleSave = () => {
    setIsEditing(false);
    if (!text.trim()) onDelete(id);
    else onUpdate(id, text, offset.current.x, offset.current.y);
  };

  return (
    <Animated.View
      style={[
        { position: 'absolute', transform: pan.getTranslateTransform(), zIndex: 100 },
        isEditing && { width: 200 }
      ]}
      {...(isStageMode ? {} : panResponder.panHandlers)}
    >
      {isEditing ? (
        <View style={styles.noteEditor}>
          <TextInput
            autoFocus
            style={styles.noteInput}
            value={text}
            onChangeText={setText}
            placeholder="Escribe tu nota..."
            placeholderTextColor={COLORS.mutedForeground}
            onBlur={handleSave}
            onSubmitEditing={handleSave}
          />
        </View>
      ) : (
        <View style={[styles.noteBadge, !isStageMode && { borderColor: '#dc2626', borderWidth: 1 }]}>
          <StickyNote size={12} color="#000" />
          <Text style={styles.noteBadgeText}>{text}</Text>
          {!isStageMode && (
             <TouchableOpacity onPress={() => setIsEditing(true)} hitSlop={{top:10,bottom:10,left:10,right:10}} style={{marginLeft: 5}}>
               <Edit2 size={12} color="#000" />
             </TouchableOpacity>
          )}
          {!isStageMode && (
             <TouchableOpacity onPress={() => onDelete(id)} hitSlop={{top:10,bottom:10,left:10,right:10}} style={{marginLeft: 5}}>
               <X size={14} color="#dc2626" />
             </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
};

export const SongViewer: React.FC<SongViewerProps> = ({
  content, title, songId, onClose,
  initialSettings, onSaveSettings,
  isDirector = false, directorSessionId,
  setlistSongs = [], onDirectorNext, onDirectorPrev,
  followSessionId, onFollowSongChange
}) => {
  const [transpose, setTranspose] = useState<number>(initialSettings?.transpose || 0);
  const [capo, setCapo] = useState(initialSettings?.capo || 0);
  const [fontSize, setFontSize] = useState(initialSettings?.fontSize || 16);
  const [viewMode, setViewMode] = useState<'all' | 'lyrics'>(initialSettings?.viewMode || 'all');
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(initialSettings?.scrollSpeed || 1);
  const [pedalSpeed, setPedalSpeed] = useState<number>(initialSettings?.pedalSpeed || 0.5);
  const [isStageMode, setIsStageMode] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [musicianNotes, setMusicianNotes] = useState<any>(initialSettings?.musicianNotes || {});
  const [bpm, setBpm] = useState(initialSettings?.bpm || 120);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const [beat, setBeat] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Aislar estado por canción
  const prevSongId = useRef(songId);
  useEffect(() => {
    if (prevSongId.current !== songId) {
      prevSongId.current = songId;
      setTranspose(initialSettings?.transpose || 0);
      setCapo(initialSettings?.capo || 0);
      setFontSize(initialSettings?.fontSize || 16);
      setViewMode(initialSettings?.viewMode || 'all');
      setScrollSpeed(initialSettings?.scrollSpeed || 1);
      setPedalSpeed(initialSettings?.pedalSpeed || 0.5);
      setMusicianNotes(initialSettings?.musicianNotes || {});
      setBpm(initialSettings?.bpm || 120);
      setIsScrolling(false);
    }
  }, [songId, initialSettings]);

  const insets = useSafeAreaInsets();

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
    const contentWithoutFooter = content.replace(new RegExp(FOOTER_TEXT, 'gi'), '');
    const cleaned = cleanSongText(contentWithoutFooter);
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
    onSaveSettings?.({ 
      songId, 
      settings: { transpose, capo, fontSize, viewMode, scrollSpeed, pedalSpeed, musicianNotes, bpm }
    });
  }, [transpose, capo, fontSize, viewMode, scrollSpeed, pedalSpeed, musicianNotes, bpm, songId]);

  const addFloatingNoteAtLine = (lineIndex: number) => {
    // Solo permitir agregar notas cuando NO está en modo escenario
    if (isStageMode) return;
    const newId = `note_${Date.now()}`;
    const startY = Math.max(0, lineIndex * 35);
    setMusicianNotes((p: any) => ({
      ...p,
      [newId]: { text: '', x: 50, y: startY, isNew: true }
    }));
  };

  const handleSharePdf = () => {
    Alert.alert(
      'Exportar a PDF',
      'Elige el formato del PDF para compartir',
      [
        {
          text: 'Con Acordes (Tono Actual)',
          onPress: async () => {
            setIsGeneratingPdf(true);
            try {
              await PdfService.generateAndShare(title, parsedLines, 'all', transpose, capo, bpm);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo generar el PDF');
            } finally {
              setIsGeneratingPdf(false);
            }
          }
        },
        {
          text: 'Solo Letra',
          onPress: async () => {
            setIsGeneratingPdf(true);
            try {
              await PdfService.generateAndShare(title, parsedLines, 'lyrics', transpose, capo, bpm);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo generar el PDF');
            } finally {
              setIsGeneratingPdf(false);
            }
          }
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
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
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 5 }]}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
          <ChevronLeft size={28} color={COLORS.foreground} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={handleSharePdf} 
            style={[styles.headerBtn, { marginRight: 8 }]} 
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Share2 size={22} color={COLORS.foreground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsStageMode(!isStageMode)} style={styles.headerBtn}>
            <Maximize2 size={24} color={isStageMode ? COLORS.accent : COLORS.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={e => { if (!isScrolling) scrollPosRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        scrollEnabled={isScrollEnabled}
      >
        <View style={styles.songContainer}>
          {parsedLines.map((line, lIndex) => {
            const isTitle = line.type === 'section' && line.blocks[0]?.text.toUpperCase().includes('TITULO');
            const sectionColor = isStageMode ? '#fbbf24' : COLORS.accent;

            return (
              <View key={lIndex}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => addFloatingNoteAtLine(lIndex)}
                  style={[styles.lineWrapper, line.type === 'section' && (isTitle ? styles.titleLine : styles.sectionLine)]}
                >
                  <View style={styles.blocksContainer}>
                    {line.blocks.map((block, bIndex) => (
                      <View key={bIndex} style={[
                        styles.block,
                        isTitle && { width: '100%', alignItems: 'center' },
                        line.isMetadata && { flexDirection: 'row', alignItems: 'baseline' }
                      ]}>
                        {block.chord && viewMode !== 'lyrics' && (
                          <Text style={[
                            styles.chordText,
                            { fontSize: fontSize * 0.9 },
                            line.isMetadata && { marginRight: 4 }
                          ]}>{block.chord}</Text>
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
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {Object.entries(musicianNotes).map(([noteId, noteData]: [string, any]) => {
          if (typeof noteData === 'string') return null; // Ignora viejas notas ancladas si quedaron colgadas, se limpia en BBDD de a poco.
          return (
            <DraggableNote
              key={noteId}
              id={noteId}
              initialText={noteData.text}
              initialX={noteData.x}
              initialY={noteData.y}
              isStageMode={isStageMode}
              isNew={noteData.isNew}
              onUpdate={(i: string, t: string, x: number, y: number) => setMusicianNotes((p: any) => ({ ...p, [i]: { text: t, x, y } }))}
              onDelete={(i: string) => {
                const n = { ...musicianNotes };
                delete n[i];
                setMusicianNotes(n);
              }}
              setScrollEnabled={setIsScrollEnabled}
            />
          );
        })}

        <View style={styles.footerContainer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>{FOOTER_TEXT}</Text>
        </View>
      </ScrollView>

      {/* Widget flotante draggable del Director o navegación de Lista local */}
      {(isDirector || (setlistSongs.length > 0 && !followSessionId)) && (() => {
        const idx = setlistSongs.findIndex(s => s.id === songId);
        const currentName = setlistSongs[idx]?.name || '';
        return (
          <Animated.View
            style={[
              styles.directorWidget,
              !isDirector && { backgroundColor: 'rgba(16, 185, 129, 0.92)' }, // green for local setlist navigation
              { left: dragPos.x, top: dragPos.y }
            ]}
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
                {isDirector ? (
                  <Radio size={10} color="#fff" />
                ) : (
                  <List size={10} color="#fff" />
                )}
                <Text style={styles.widgetBadgeText}>
                  {isDirector ? 'DIRECTOR' : 'LISTA'}
                </Text>
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
                  <ChevronLeft size={18} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.widgetCounter}>{idx + 1} / {setlistSongs.length}</Text>

                <TouchableOpacity
                  onPress={onDirectorNext}
                  style={[styles.widgetNavBtn, idx >= setlistSongs.length - 1 && styles.widgetNavBtnDisabled]}
                  disabled={idx >= setlistSongs.length - 1}
                >
                  <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        );
      })()}

      {/* Barra flotante */}
      {!isSettingsOpen ? (
        <View style={[styles.floatingBar, { bottom: Math.max(insets.bottom, 20) + 10 }]}>
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
              <TouchableOpacity onPress={() => setBpm((p: number) => Math.max(40, p - 5))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{bpm} BPM</Text>
              <TouchableOpacity onPress={() => setBpm((p: number) => Math.min(250, p + 5))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
            </View>

            {/* Tamaño letra */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Tamaño Letra</Text>
            <View style={styles.controlGroup}>
              <TouchableOpacity onPress={() => setFontSize((p: number) => Math.max(10, p - 2))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{fontSize}px</Text>
              <TouchableOpacity onPress={() => setFontSize((p: number) => Math.min(40, p + 2))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
            </View>

            {/* Auto-scroll speed */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Velocidad Auto-scroll</Text>
            <View style={styles.controlGroup}>
              <TouchableOpacity onPress={() => setScrollSpeed((p: number) => Math.max(0.1, +(p - 0.1).toFixed(1)))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{scrollSpeed}x</Text>
              <TouchableOpacity onPress={() => setScrollSpeed((p: number) => Math.min(10, +(p + 0.1).toFixed(1)))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
            </View>

            {/* Pedal speed */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Velocidad Pedal</Text>
            <View style={styles.controlGroup}>
              <TouchableOpacity onPress={() => setPedalSpeed((p: number) => Math.max(0.1, +(p - 0.1).toFixed(1)))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{pedalSpeed}x</Text>
              <TouchableOpacity onPress={() => setPedalSpeed((p: number) => Math.min(10, +(p + 0.1).toFixed(1)))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
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
    width: 170,
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
    padding: 10,
    alignItems: 'center',
    gap: 6,
  },
  widgetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  widgetBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  widgetSongName: {
    color: '#fff',
    fontSize: 12,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetNavBtnDisabled: {
    opacity: 0.25,
  },
  widgetCounter: {
    color: '#fff',
    fontSize: 12,
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
