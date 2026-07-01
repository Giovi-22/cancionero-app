import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Dimensions, TextInput, Keyboard, Platform, AppState,
  PanResponder, Animated, Alert, ActivityIndicator, KeyboardAvoidingView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronRight, Settings, Play, Pause, Maximize2,
  Plus, Minus, X, StickyNote, Clock, Radio, Edit2, List, Share2,
  Music, Hash, FastForward, Activity, AlertTriangle
} from 'lucide-react-native';
import {
  parseChordPro, transposeChordPro
} from '../utils/chordpro';
import { transposeChord } from '../utils/chordUtils';
import { LiveSessionService } from '../services/LiveSessionService';
import { SongMetadata } from '../types';
import { PdfService } from '../services/PdfService';
import { PedalHandler } from './PedalHandler';

const COLORS = {
  background: '#0a0a0a', surface: '#1a1a1a', foreground: '#ffffff',
  mutedForeground: '#a0a0a0', accent: '#3b82f6', border: '#333333'
};

const FOOTER_TEXT = "Ministerio de Alabanza ICBS";

// ── Calculadora de Capo ─────────────────────────────────────────────────
const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};
const NOTES_DISPLAY = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_LABELS: Record<string, string> = {
  'C#': 'C#/D♭', 'D#': 'D#/E♭', 'F#': 'F#/G♭', 'G#': 'G#/A♭', 'A#': 'A#/B♭'
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

/**
 * DraggableNote simplificado: solo muestra el badge de la nota y permite
 * arrastrarla. La edición se delega al overlay del SongViewer para evitar
 * que el teclado tape el input.
 */
const DraggableNote = ({ id, initialText, initialX, initialY, isStageMode, onRequestEdit, onUpdate, onDelete, setScrollEnabled }: any) => {
  const pan = useRef(new Animated.ValueXY({ x: initialX || 0, y: initialY || 0 })).current;
  const offset = useRef({ x: initialX || 0, y: initialY || 0 });

  // Ref con valores dinámicos para evitar stale closures en PanResponder
  const stateRef = useRef({ id, initialText, onUpdate, setScrollEnabled, isStageMode });
  stateRef.current = { id, initialText, onUpdate, setScrollEnabled, isStageMode };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !stateRef.current.isStageMode,
      onMoveShouldSetPanResponder: (_, g) => !stateRef.current.isStageMode && (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5),
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
          stateRef.current.initialText,
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

  // No mostrar notas sin texto (aún no guardadas)
  if (!initialText) return null;

  return (
    <Animated.View
      style={{ position: 'absolute', transform: pan.getTranslateTransform(), zIndex: 100 }}
      {...(isStageMode ? {} : panResponder.panHandlers)}
    >
      <View style={[styles.noteBadge, !isStageMode && { borderColor: '#dc2626', borderWidth: 1 }]}>
        <StickyNote size={12} color="#000" />
        <Text style={styles.noteBadgeText}>{initialText}</Text>
        {!isStageMode && (
          <TouchableOpacity
            onPress={() => onRequestEdit(id, initialText)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 5 }}
          >
            <Edit2 size={12} color="#000" />
          </TouchableOpacity>
        )}
        {!isStageMode && (
          <TouchableOpacity
            onPress={() => onDelete(id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 5 }}
          >
            <X size={14} color="#dc2626" />
          </TouchableOpacity>
        )}
      </View>
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
  const [scrollSpeed, setScrollSpeed] = useState<number>(initialSettings?.scrollSpeed || 0.2);
  const [pedalSpeed, setPedalSpeed] = useState<number>(initialSettings?.pedalSpeed || 0.2);
  const [isStageMode, setIsStageMode] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [musicianNotes, setMusicianNotes] = useState<any>(initialSettings?.musicianNotes || {});
  const [bpm, setBpm] = useState(initialSettings?.bpm || 120);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const [beat, setBeat] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  // Estado del overlay de edición de notas
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);

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
  const pedalRafRef = useRef<number | null>(null);
  const pedalLastTickRef = useRef<number>(0);
  // Ref espejo de pedalSpeed para leer el valor actual dentro del rAF
  // sin necesidad de recrear el callback (evita stale closure).
  const pedalSpeedRef = useRef(0.2);
  // Ref para medir la posición en pantalla del área de scroll
  // (necesario para convertir coordenadas de toque a coordenadas del contenido)
  const scrollAreaRef = useRef<View>(null);
  const scrollAreaPageY = useRef(0);
  const scrollAreaPageX = useRef(0);

  const measureScrollArea = () => {
    scrollAreaRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      scrollAreaPageX.current = pageX;
      scrollAreaPageY.current = pageY;
    });
  };


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
    const transposed = transposeChordPro(contentWithoutFooter, transpose - capo);
    const result = parseChordPro(transposed);

    return result;
  }, [content, transpose, capo]);

  const { originalTone, transposedTone } = useMemo(() => {
    // 1. Intentar buscar directiva de ChordPro {key: C} o {tono: C} o {t: C} (con/sin corchetes)
    let match = content.match(/\{\s*(?:key|tono|t)\s*:\s*\[?([A-G][b#]?[m]?)\]?\s*\}/i);
    if (!match) {
      // 2. Si no, buscar línea estándar Tono: C o Key: C (con/sin espacios iniciales y con/sin corchetes)
      match = content.match(/^\s*(?:TONO|KEY):\s*\[?([A-G][b#]?[m]?)\]?/mi);
    }
    const orig = match ? match[1] : null;
    let trans = orig;
    if (orig && (transpose - capo) !== 0) {
      trans = transposeChord(orig, transpose - capo);
    }
    return { originalTone: orig, transposedTone: trans };
  }, [content, transpose, capo]);

  // ── Calculadora de Capo: tono que suena (independiente del capo físico) ──
  const soundingKeySemitone = useMemo(() => {
    if (!originalTone) return null;
    const baseNote = originalTone.replace('m', '').trim();
    const baseSemitone = NOTE_SEMITONES[baseNote];
    if (baseSemitone === undefined) return null;
    return (baseSemitone + transpose + 120) % 12; // +120 cubre transposes negativos
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

  // ── Pedal BT: Scroll Fluido (requestAnimationFrame + time-delta) ────────────
  // Modelo: PedalHandler notifica START (dirección) y STOP (botón suelto).
  // Usamos rAF en lugar de setInterval para sincronizarnos con el ciclo de
  // render del display y evitar artefactos visuales en el primer frame.
  // El avance es proporcional al delta de tiempo real (px/ms), lo que garantiza
  // velocidad constante independientemente de la frecuencia de pantalla.

  const pedalScrollDirRef = useRef<'up' | 'down' | null>(null);

  // Mantener ref sincronizado con el estado
  useEffect(() => { pedalSpeedRef.current = pedalSpeed; }, [pedalSpeed]);

  const startPedalScroll = useCallback((direction: 'up' | 'down') => {
    // Si ya estamos desplazándonos en la misma dirección, ignoramos el evento redundante
    // (los eventos de repetición de teclado HID disparan esto repetidamente y reiniciar el rAF causaría saltos)
    if (pedalRafRef.current !== null && pedalScrollDirRef.current === direction) {
      return;
    }
    
    pedalScrollDirRef.current = direction;

    // Detener cualquier loop previo
    if (pedalRafRef.current !== null) {
      cancelAnimationFrame(pedalRafRef.current);
      pedalRafRef.current = null;
    }
    pedalLastTickRef.current = 0; // Resetear para que el primer frame calcule bien

    const tick = (timestamp: number) => {
      // En el primer frame inicializamos el tiempo sin mover nada
      if (pedalLastTickRef.current === 0) {
        pedalLastTickRef.current = timestamp;
        pedalRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = Math.min(timestamp - pedalLastTickRef.current, 50); // cap 50ms
      pedalLastTickRef.current = timestamp;

      // pedalSpeedRef.current * 0.3 -> px/ms.
      const step = pedalSpeedRef.current * 0.3 * delta;
      const nextY = direction === 'down'
        ? scrollPosRef.current + step
        : Math.max(0, scrollPosRef.current - step);

      scrollRef.current?.scrollTo({ y: nextY, animated: false });
      scrollPosRef.current = nextY;

      pedalRafRef.current = requestAnimationFrame(tick);
    };

    pedalRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopPedalScroll = useCallback(() => {
    if (pedalRafRef.current !== null) {
      cancelAnimationFrame(pedalRafRef.current);
      pedalRafRef.current = null;
    }
    pedalLastTickRef.current = 0;
    pedalScrollDirRef.current = null;
  }, []);

  const handlePedalScrollUp = useCallback(() => startPedalScroll('up'), [startPedalScroll]);
  const handlePedalScrollDown = useCallback(() => startPedalScroll('down'), [startPedalScroll]);

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

  const addFloatingNoteAtLine = (tapPageX: number, tapPageY: number) => {
    // Solo permitir agregar notas cuando NO está en modo escenario
    if (isStageMode) return;
    const newId = `note_${Date.now()}`;
    // Convertir coordenadas de pantalla a coordenadas del contenido del ScrollView
    const noteX = Math.max(0, tapPageX - scrollAreaPageX.current);
    const noteY = Math.max(0, tapPageY - scrollAreaPageY.current + scrollPosRef.current);
    // Crear la nota y abrir el overlay de edición inmediatamente
    setMusicianNotes((p: any) => ({
      ...p,
      [newId]: { text: '', x: noteX, y: noteY }
    }));
    setEditingNote({ id: newId, text: '' });
  };

  const handleRequestEdit = useCallback((id: string, currentText: string) => {
    setEditingNote({ id, text: currentText });
  }, []);

  const handleSaveNote = useCallback(() => {
    if (!editingNote) return;
    const { id, text } = editingNote;
    setEditingNote(null);
    if (!text.trim()) {
      // Nota vacía → eliminar
      setMusicianNotes((p: any) => { const n = { ...p }; delete n[id]; return n; });
    } else {
      setMusicianNotes((p: any) => ({ ...p, [id]: { ...p[id], text } }));
    }
  }, [editingNote]);

  const handleCancelNote = useCallback(() => {
    if (!editingNote) return;
    const { id } = editingNote;
    setEditingNote(null);
    // Si la nota no tenía texto previo (nueva), eliminarla al cancelar
    setMusicianNotes((p: any) => {
      if (p[id] && !p[id].text) {
        const n = { ...p }; delete n[id]; return n;
      }
      return p;
    });
  }, [editingNote]);

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

  const getRenderItems = useCallback((blocks: any[], isTitle: boolean) => {
    if (isTitle) {
      return blocks.map(b => ({ text: b.text.replace(/\[TITULO\]/i, '').trim() }));
    }

    const items: { chord?: string; text: string }[] = [];
    let pendingSpaces = '';

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const rawText = block.text || '';
      
      const match = rawText.match(/^(\s*)(.*?)(\s*)$/);
      const leading = match ? match[1] : '';
      const body = match ? match[2] : '';
      const trailing = match ? match[3] : '';

      const currentPending = pendingSpaces + leading;
      if (currentPending && items.length > 0) {
        items[items.length - 1].text += currentPending;
      }
      pendingSpaces = trailing;

      if (body) {
        const words = body.match(/\S+\s*/g) || [];
        
        if (block.chord) {
          items.push({
            chord: block.chord,
            text: words[0] || ''
          });
          for (let w = 1; w < words.length; w++) {
            items.push({
              text: words[w]
            });
          }
        } else {
          for (let w = 0; w < words.length; w++) {
            items.push({
              text: words[w]
            });
          }
        }
      } else if (block.chord) {
        items.push({
          chord: block.chord,
          text: ''
        });
      }
    }

    if (pendingSpaces && items.length > 0) {
      items[items.length - 1].text += pendingSpaces;
    }

    return items;
  }, []);

  return (
    <View style={styles.container}>
      {/* Header principal */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 5 }]}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
          <ChevronLeft size={28} color={COLORS.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 10 }}>
          <Text style={[styles.title, { marginHorizontal: 0, flex: 0 }]} numberOfLines={1}>{title}</Text>
        </View>
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

      {/* Barra de Información de Estado */}
      <View style={styles.infoBar}>
        <View style={[
          styles.infoBadge,
          (!originalTone && transpose === 0) && styles.infoBadgeInactive,
          transpose !== 0 && { borderColor: COLORS.accent, borderWidth: 1, backgroundColor: 'transparent' }
        ]}>
          <Music size={12} color={transpose !== 0 ? COLORS.accent : (originalTone ? COLORS.foreground : COLORS.mutedForeground)} />
          <Text style={[
            styles.infoBadgeText,
            (!originalTone && transpose === 0) && styles.infoBadgeTextInactive,
            transpose !== 0 && { color: COLORS.accent }
          ]}>
            {originalTone ? `${originalTone}${transposedTone && transposedTone !== originalTone ? ` → ${transposedTone}` : ''}` : 'Tono'}
            {transpose !== 0 ? ` (${transpose > 0 ? `+${transpose}` : transpose})` : ''}
          </Text>
        </View>
        <View style={[styles.infoBadge, capo === 0 && styles.infoBadgeInactive]}>
          <Hash size={12} color={capo > 0 ? COLORS.foreground : COLORS.mutedForeground} />
          <Text style={[styles.infoBadgeText, capo === 0 && styles.infoBadgeTextInactive]}>
            {capo > 0 ? `Capo ${capo}` : 'Capo'}
          </Text>
        </View>
        <View style={[styles.infoBadge, !isScrolling && styles.infoBadgeInactive]}>
          <FastForward size={12} color={isScrolling ? COLORS.foreground : COLORS.mutedForeground} />
          <Text style={[styles.infoBadgeText, !isScrolling && styles.infoBadgeTextInactive]}>
            {isScrolling ? `${scrollSpeed}x` : 'Scroll'}
          </Text>
        </View>
        <View style={[styles.infoBadge, !isMetronomeActive && styles.infoBadgeInactive]}>
          <Activity size={12} color={isMetronomeActive ? (beat ? COLORS.accent : COLORS.foreground) : COLORS.mutedForeground} />
          <Text style={[styles.infoBadgeText, !isMetronomeActive && styles.infoBadgeTextInactive]}>
            {isMetronomeActive ? `${bpm} BPM` : 'BPM'}
          </Text>
        </View>
      </View>

      {/* Sub-header de navegación de lista (reemplaza el widget flotante) */}
      {(isDirector || followSessionId || setlistSongs.length > 0) && (() => {
        const idx = setlistSongs.findIndex(s => s.id === songId);
        const isFollower = !!followSessionId && !isDirector;
        return (
          <View style={styles.subHeader}>
            {/* Badge de modo */}
            <View style={[styles.subHeaderBadge, isFollower ? styles.followerBadge : isDirector ? styles.directorBadge : styles.localBadge]}>
              <Radio size={10} color="#fff" />
              <Text style={styles.subHeaderBadgeText}>
                {isFollower ? 'EN VIVO' : isDirector ? 'DIRECTOR' : 'LISTA'}
              </Text>
            </View>

            {/* Controles de navegación */}
            <TouchableOpacity
              onPress={onDirectorPrev}
              style={[styles.subNavBtn, idx <= 0 && styles.subNavBtnDisabled]}
              disabled={idx <= 0 || isFollower}
            >
              <ChevronLeft size={20} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.subHeaderCounter}>{idx + 1} / {setlistSongs.length}</Text>

            <TouchableOpacity
              onPress={onDirectorNext}
              style={[styles.subNavBtn, idx >= setlistSongs.length - 1 && styles.subNavBtnDisabled]}
              disabled={idx >= setlistSongs.length - 1 || isFollower}
            >
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Contenido */}
      <View ref={scrollAreaRef} style={{ flex: 1 }} onLayout={measureScrollArea}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={e => { scrollPosRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={1}
        scrollEnabled={isScrollEnabled}
      >
        <View style={styles.songContainer}>
          {parsedLines.map((line, lIndex) => {
            const isTitle = line.type === 'section' && line.blocks[0]?.text.toUpperCase().includes('TITULO');
            const sectionColor = isStageMode ? '#fbbf24' : COLORS.accent;
            const fullLineText = line.blocks.map(b => b.text).join('');
            const isNonPlayableMetadata = line.isMetadata && /^(NOTA|TONO|KEY|BPM|TEMPO|CAPO|COMP[ÁA]S):/i.test(fullLineText);

            return (
              <View key={lIndex}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={(e) => addFloatingNoteAtLine(e.nativeEvent.pageX, e.nativeEvent.pageY)}
                  style={[styles.lineWrapper, line.type === 'section' && (isTitle ? styles.titleLine : styles.sectionLine)]}
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
                              { fontSize: fontSize * 1.5, textAlign: 'center', fontWeight: 'bold' },
                              isDebugMode && { backgroundColor: 'rgba(59, 130, 246, 0.15)' }
                            ]}>
                              {item.text}
                            </Text>
                          </View>
                        );
                      }

                      const hasChord = !!item.chord;

                      // Si no tiene acorde y es vacío o solo espacios, lo renderizamos plano (sin caja/altura del acorde)
                      if (!hasChord && (!item.text || /^\s+$/.test(item.text))) {
                        return (
                          <Text
                            key={`item-${bIndex}`}
                            style={[
                              styles.lyricText,
                              { fontSize },
                              line.type === 'section' && { color: sectionColor, fontWeight: 'bold' },
                            ]}
                          >
                            {item.text || ' '}
                          </Text>
                        );
                      }

                      // Si tiene texto o acorde, lo normalizamos dentro del View con altura de acorde
                      return (
                        <View
                          key={`item-${bIndex}`}
                          style={[
                            styles.block,
                            line.isMetadata && { flexDirection: 'row', alignItems: 'baseline' },
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
                                { fontSize: fontSize },
                                line.isMetadata && { marginRight: 4 },
                                isNonPlayableMetadata && { color: COLORS.foreground, fontWeight: 'normal' },
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
                            { fontSize },
                            line.type === 'section' && { color: sectionColor, fontWeight: 'bold' },
                            isDebugMode && { backgroundColor: hasChord ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.15)' }
                          ]}>
                            {item.text}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {Object.entries(musicianNotes).map(([noteId, noteData]: [string, any]) => {
          if (typeof noteData === 'string') return null;
          return (
            <DraggableNote
              key={noteId}
              id={noteId}
              initialText={noteData.text}
              initialX={noteData.x}
              initialY={noteData.y}
              isStageMode={isStageMode}
              onRequestEdit={handleRequestEdit}
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
      </View>{/* scrollAreaRef */}

      {/* Barra flotante de controles */}
      {!isSettingsOpen ? (
        <View style={[styles.floatingBar, { bottom: Math.max(insets.bottom, 20) + 10 }]}>
          <View style={styles.controlGroup}>
            <TouchableOpacity onPress={() => setTranspose(p => p - 1)} style={styles.smallBtn}>
              <Minus size={18} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.mutedForeground, fontSize: 9, fontWeight: 'bold', marginBottom: 1 }}>TONO</Text>
              <Text style={[styles.ctrlText, { minWidth: 30, fontSize: 14 }]}>{transpose > 0 ? `+${transpose}` : transpose}</Text>
            </View>
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

            {/* Calculadora de Capo */}
            {soundingKeySemitone !== null ? (
              <>
                <View style={styles.capoCalcHeader}>
                  <Text style={[styles.settingLabel, { marginTop: 20, marginBottom: 0, flex: 1 }]}>Calculadora de Capo</Text>
                  <View style={styles.capoCalcKeyBadge}>
                    <Text style={styles.capoCalcKeyBadgeText}>
                      Suena en {soundingKeyName}
                    </Text>
                  </View>
                </View>
                <Text style={styles.capoCalcSubtitle}>
                  Tocá en la tonalidad que quieras — el capo se ajusta solo.
                </Text>
                <View style={styles.capoCalcGrid}>
                  {NOTES_DISPLAY.map(note => {
                    const targetSemitone = NOTE_SEMITONES[note];
                    const fret = (soundingKeySemitone - targetSemitone + 12) % 12;
                    const isPractical = fret >= 1 && fret <= 7;
                    const isCurrent = fret === 0;
                    const isActive = capo === fret && !isCurrent;
                    return (
                      <TouchableOpacity
                        key={note}
                        style={[
                          styles.capoCalcBtn,
                          isCurrent && styles.capoCalcBtnCurrent,
                          isActive && styles.capoCalcBtnActive,
                          !isPractical && !isCurrent && styles.capoCalcBtnDim,
                        ]}
                        onPress={() => setCapo(fret)}
                      >
                        <Text style={[
                          styles.capoCalcNote,
                          isCurrent && { color: COLORS.accent },
                          isActive && { color: '#fff' },
                          !isPractical && !isCurrent && { color: COLORS.mutedForeground },
                        ]}>
                          {NOTE_LABELS[note] || note}
                        </Text>
                        <Text style={[
                          styles.capoCalcFret,
                          isPractical && !isCurrent && { color: '#4ade80' },
                          isCurrent && { color: COLORS.accent },
                          isActive && { color: '#fff' },
                          !isPractical && !isCurrent && { color: COLORS.mutedForeground },
                        ]}>
                          {isCurrent ? 'sin capo' : `traste ${fret}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.capoCalcWarning}>
                <AlertTriangle size={16} color="#fbbf24" style={{ marginRight: 8 }} />
                <Text style={styles.capoCalcWarningText}>
                  La calculadora de capo no está disponible porque esta canción no tiene especificado su tono original (Tono:).
                </Text>
              </View>
            )}

            {/* Metrónomo */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Metrónomo</Text>
            <View style={styles.controlGroup}>
              <TouchableOpacity onPress={() => setIsMetronomeActive(!isMetronomeActive)} style={[styles.smallBtn, isMetronomeActive && { backgroundColor: COLORS.accent }]}>
                <Clock size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBpm((p: number) => Math.max(40, p - 1))} style={styles.smallBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
              <Text style={styles.ctrlText}>{bpm} BPM</Text>
              <TouchableOpacity onPress={() => setBpm((p: number) => Math.min(250, p + 1))} style={styles.smallBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
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

            {/* Modo Depuración */}
            <Text style={[styles.settingLabel, { marginTop: 20 }]}>Modo Depuración (Alineación)</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity style={[styles.toggleBtn, !isDebugMode && styles.toggleBtnActive]} onPress={() => setIsDebugMode(false)}>
                <Text style={[styles.toggleText, !isDebugMode && styles.toggleTextActive]}>Apagado</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, isDebugMode && styles.toggleBtnActive]} onPress={() => setIsDebugMode(true)}>
                <Text style={[styles.toggleText, isDebugMode && styles.toggleTextActive]}>Encendido</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={() => setIsSettingsOpen(false)}>
              <Text style={styles.doneBtnText}>Listo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
      <PedalHandler
        onScrollUp={handlePedalScrollUp}
        onScrollDown={handlePedalScrollDown}
        onScrollStop={stopPedalScroll}
        enabled={isStageMode && !isSettingsOpen}
      />

      {/* ── Overlay de edición de notas ─────────────────────────────────────
           Posicionado FUERA del ScrollView para que el KeyboardAvoidingView
           funcione correctamente y el teclado no tape el input.
      */}
      {editingNote && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="box-none"
        >
          {/* Fondo semi-transparente: toca para cancelar */}
          <TouchableOpacity
            style={styles.noteOverlayBackdrop}
            activeOpacity={1}
            onPress={handleCancelNote}
          />
          <View style={styles.noteEditSheet}>
            <View style={styles.noteEditHeader}>
              <StickyNote size={16} color={COLORS.accent} />
              <Text style={styles.noteEditTitle}>Nota de músico</Text>
              <TouchableOpacity onPress={handleCancelNote} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TextInput
              autoFocus
              style={styles.noteEditInput}
              value={editingNote.text}
              onChangeText={(t) => setEditingNote(prev => prev ? { ...prev, text: t } : null)}
              placeholder="Escribe tu nota aquí..."
              placeholderTextColor={COLORS.mutedForeground}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.noteEditSaveBtn} onPress={handleSaveNote}>
              <Text style={styles.noteEditSaveBtnText}>Guardar nota</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // Barra de información de estado
  infoBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoBadgeInactive: {
    backgroundColor: 'transparent',
    opacity: 0.4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoBadgeText: {
    color: COLORS.foreground,
    fontSize: 11,
    fontWeight: 'bold',
  },
  infoBadgeTextInactive: {
    color: COLORS.mutedForeground,
  },
  // sub-header de navegación de lista
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(26,26,26,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  subHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 80,
  },
  directorBadge: { backgroundColor: '#dc2626' },
  followerBadge: { backgroundColor: '#7c3aed' },
  localBadge: { backgroundColor: '#059669' },
  subHeaderBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subHeaderCounter: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  subNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subNavBtnDisabled: { opacity: 0.25 },
  // Estilos de indicadores legados (follower)
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
  // Overlay de edición de notas
  noteOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  noteEditSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
    gap: 16,
  },
  noteEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteEditTitle: {
    flex: 1,
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteEditInput: {
    backgroundColor: COLORS.background,
    color: COLORS.foreground,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  noteEditSaveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  noteEditSaveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  floatingBar: { position: 'absolute', bottom: 30, left: 20, right: 20, height: 60, backgroundColor: 'rgba(26,26,26,0.95)', borderRadius: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, elevation: 5 },
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
  // Calculadora de Capo
  capoCalcHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 10 },
  capoCalcKeyBadge: {
    backgroundColor: COLORS.accent + '22',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capoCalcKeyBadgeText: { color: COLORS.accent, fontSize: 11, fontWeight: 'bold' },
  capoCalcSubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  capoCalcGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  capoCalcBtn: {
    width: '22%',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 3,
  },
  capoCalcBtnCurrent: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '15',
  },
  capoCalcBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  capoCalcBtnDim: { opacity: 0.4 },
  capoCalcNote: { color: COLORS.foreground, fontSize: 13, fontWeight: 'bold' },
  capoCalcFret: { color: COLORS.mutedForeground, fontSize: 10 },
  capoCalcWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbbf2415',
    borderWidth: 1,
    borderColor: '#fbbf2430',
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
  },
  capoCalcWarningText: {
    color: '#fbbf24',
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
    lineHeight: 16,
  },
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
