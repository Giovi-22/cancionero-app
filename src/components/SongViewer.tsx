import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  Animated,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Platform,
  Slider
} from 'react-native';
import { 
  ChevronLeft, 
  Settings, 
  Play, 
  Pause, 
  Maximize2, 
  Minimize2,
  Type,
  Music,
  Plus,
  Minus,
  X,
  StickyNote,
  Clock
} from 'lucide-react-native';
import { 
  transposeText, 
  trimCommonIndentation, 
  cleanSongText, 
  parseSongToBlocks 
} from '../utils/chordUtils';

const { width, height } = Dimensions.get('window');

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333'
};

interface SongViewerProps {
  content: string;
  title: string;
  onClose: () => void;
  initialSettings?: any;
  onSaveSettings?: (settings: any) => void;
}

export const SongViewer: React.FC<SongViewerProps> = ({ 
  content, 
  title, 
  onClose,
  initialSettings,
  onSaveSettings 
}) => {
  const [transpose, setTranspose] = useState(initialSettings?.transpose || 0);
  const [capo, setCapo] = useState(initialSettings?.capo || 0);
  const [fontSize, setFontSize] = useState(initialSettings?.fontSize || 16);
  const [viewMode, setViewMode] = useState<'all' | 'lyrics'>(initialSettings?.viewMode || 'all');
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(initialSettings?.scrollSpeed || 1);
  const [isStageMode, setIsStageMode] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [musicianNotes, setMusicianNotes] = useState<Record<number, string>>(initialSettings?.musicianNotes || {});
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState('');
  
  // Metrónomo
  const [bpm, setBpm] = useState(initialSettings?.bpm || 120);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const [beat, setBeat] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const scrollPosRef = useRef(0);
  const scrollIntervalRef = useRef<any>(null);

  // Lógica de Metrónomo
  useEffect(() => {
    let interval: any;
    if (isMetronomeActive) {
      const msPerBeat = 60000 / bpm;
      interval = setInterval(() => {
        setBeat(true);
        setTimeout(() => setBeat(false), 100);
      }, msPerBeat);
    }
    return () => clearInterval(interval);
  }, [isMetronomeActive, bpm]);

  // Procesar canción (igual que en la web: transpose - capo)
  const parsedLines = useMemo(() => {
    const cleaned = cleanSongText(content);
    const transposed = transposeText(cleaned, transpose - capo);
    const trimmed = trimCommonIndentation(transposed);
    return parseSongToBlocks(trimmed);
  }, [content, transpose, capo]);

  // Motor de Auto-scroll
  useEffect(() => {
    if (isScrolling) {
      scrollIntervalRef.current = setInterval(() => {
        scrollPosRef.current += (scrollSpeed * 0.5);
        scrollRef.current?.scrollTo({ y: scrollPosRef.current, animated: false });
      }, 16);
    } else {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    }
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [isScrolling, scrollSpeed]);

  const handleSaveSettings = () => {
    onSaveSettings?.({
      transpose,
      capo,
      fontSize,
      viewMode,
      scrollSpeed,
      musicianNotes,
      bpm
    });
  };

  useEffect(() => {
    handleSaveSettings();
  }, [transpose, capo, fontSize, viewMode, scrollSpeed, musicianNotes, bpm]);

  const toggleNote = (index: number) => {
    if (editingLine === index) {
      setEditingLine(null);
    } else {
      setTempNote(musicianNotes[index] || '');
      setEditingLine(index);
    }
  };

  const saveNote = () => {
    if (editingLine !== null) {
      const newNotes = { ...musicianNotes };
      if (tempNote.trim()) {
        newNotes[editingLine] = tempNote;
      } else {
        delete newNotes[editingLine];
      }
      setMusicianNotes(newNotes);
      setEditingLine(null);
      Keyboard.dismiss();
    }
  };

  return (
    <View style={[styles.container, isStageMode && styles.stageContainer]}>
      {/* Visual Metronome Beat Indicator */}
      {isMetronomeActive && (
        <View style={[styles.metronomeDot, beat && styles.metronomeDotActive]} />
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <ChevronLeft size={28} color={COLORS.foreground} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={() => setIsStageMode(!isStageMode)} style={styles.iconButton}>
          {isStageMode ? <Minimize2 size={24} color={COLORS.accent} /> : <Maximize2 size={24} color={COLORS.foreground} />}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => {
          if (!isScrolling) {
            scrollPosRef.current = e.nativeEvent.contentOffset.y;
          }
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.songContainer}>
          {parsedLines.map((line, lIndex) => {
            const isTitle = line.type === 'section' && line.blocks[0]?.text.toUpperCase().includes('TITULO');
            const sectionColor = isStageMode ? '#fbbf24' : '#3b82f6';

            return (
              <TouchableOpacity 
                key={lIndex} 
                activeOpacity={0.7}
                onPress={() => toggleNote(lIndex)}
                style={[
                  styles.lineWrapper,
                  line.type === 'section' && (isTitle ? styles.titleLine : styles.sectionLine)
                ]}
              >
                <View style={styles.blocksContainer}>
                  {line.blocks.map((block, bIndex) => (
                    <View key={bIndex} style={[styles.block, isTitle && { width: '100%', alignItems: 'center' }]}>
                      {block.chord && viewMode !== 'lyrics' && (
                        <Text style={[styles.chordText, { fontSize: fontSize * 0.9 }]}>
                          {block.chord}
                        </Text>
                      )}
                      {!block.chord && viewMode === 'all' && line.type === 'chords-lyrics' && (
                         <Text style={[styles.chordText, { fontSize: fontSize * 0.9, opacity: 0 }]}> </Text>
                      )}
                      <Text style={[
                        styles.lyricText, 
                        { fontSize: fontSize },
                        line.type === 'section' && { color: sectionColor, fontWeight: 'bold' },
                        isTitle && { fontSize: fontSize * 1.5, textAlign: 'center' }
                      ]}>
                        {isTitle ? block.text.replace(/\[TITULO\]/i, '').trim() : (block.text || ' ')}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Nota del músico */}
                {musicianNotes[lIndex] && (
                  <View style={styles.noteBadge}>
                    <StickyNote size={10} color="#000" />
                    <Text style={styles.noteBadgeText}>{musicianNotes[lIndex]}</Text>
                  </View>
                )}

                {/* Editor de nota rápido */}
                {editingLine === lIndex && (
                  <View style={styles.noteEditor}>
                    <TextInput 
                      autoFocus
                      style={styles.noteInput}
                      value={tempNote}
                      onChangeText={setTempNote}
                      placeholder="Añadir nota..."
                      placeholderTextColor={COLORS.mutedForeground}
                      onSubmitEditing={saveNote}
                      onBlur={saveNote}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Bar - Más compacta como en la web */}
      {!isSettingsOpen ? (
        <View style={styles.floatingBar}>
          <View style={styles.controlGroup}>
            <TouchableOpacity onPress={() => setTranspose(prev => prev - 1)} style={styles.smallButton}>
              <Minus size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.controlText}>{transpose > 0 ? `+${transpose}` : transpose}</Text>
            <TouchableOpacity onPress={() => setTranspose(prev => prev + 1)} style={styles.smallButton}>
              <Plus size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={[styles.playButton, isScrolling && styles.activePlayButton]} 
            onPress={() => setIsScrolling(!isScrolling)}
          >
            {isScrolling ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" />}
            <Text style={styles.playText}>{isScrolling ? `${scrollSpeed}x` : 'Scroll'}</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={styles.iconButton}>
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
            <View style={styles.settingItemCol}>
              <Text style={styles.settingLabel}>Capodastro</Text>
              <View style={styles.capoGrid}>
                {[0, 1, 2, 3, 4, 5].map(val => (
                  <TouchableOpacity 
                    key={val}
                    style={[styles.capoBtn, capo === val && styles.activeCapoBtn]}
                    onPress={() => setCapo(val)}
                  >
                    <Text style={[styles.capoText, capo === val && styles.activeCapoText]}>
                      {val === 0 ? 'Off' : val}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Metrónomo */}
            <View style={styles.settingItemCol}>
              <Text style={styles.settingLabel}>Metrónomo (BPM: {bpm})</Text>
              <View style={styles.metronomeGroup}>
                <TouchableOpacity 
                  onPress={() => setIsMetronomeActive(!isMetronomeActive)}
                  style={[styles.metroToggle, isMetronomeActive && styles.metroToggleActive]}
                >
                  <Clock size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setBpm(prev => Math.max(40, prev - 5))} style={styles.smallButton}>
                  <Minus size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.controlText}>{bpm}</Text>
                <TouchableOpacity onPress={() => setBpm(prev => Math.min(250, prev + 5))} style={styles.smallButton}>
                  <Plus size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Tamaño Letra</Text>
              <View style={styles.controlGroup}>
                <TouchableOpacity onPress={() => setFontSize(prev => Math.max(10, prev - 2))} style={styles.smallButton}>
                  <Minus size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.controlText}>{fontSize}</Text>
                <TouchableOpacity onPress={() => setFontSize(prev => Math.min(40, prev + 2))} style={styles.smallButton}>
                  <Plus size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Vista</Text>
              <View style={styles.toggleGroup}>
                <TouchableOpacity 
                  style={[styles.toggleBtn, viewMode === 'all' && styles.activeToggle]}
                  onPress={() => setViewMode('all')}
                >
                  <Text style={[styles.toggleText, viewMode === 'all' && styles.activeToggleText]}>Todo</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleBtn, viewMode === 'lyrics' && styles.activeToggle]}
                  onPress={() => setViewMode('lyrics')}
                >
                  <Text style={[styles.toggleText, viewMode === 'lyrics' && styles.activeToggleText]}>Letra</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.doneButton}
              onPress={() => setIsSettingsOpen(false)}
            >
              <Text style={styles.doneButtonText}>Listo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  stageContainer: {
    backgroundColor: COLORS.background,
  },
  metronomeDot: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  metronomeDotActive: {
    backgroundColor: COLORS.accent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 5,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.foreground,
    marginHorizontal: 10,
  },
  iconButton: {
    padding: 8,
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
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  lyricText: {
    color: COLORS.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 22,
  },
  noteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  noteBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  noteEditor: {
    marginTop: 5,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
    padding: 8,
  },
  noteInput: {
    color: COLORS.foreground,
    fontSize: 14,
  },
  floatingBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    height: 60,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 5,
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallButton: {
    width: 30,
    height: 30,
    backgroundColor: COLORS.border,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 35,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activePlayButton: {
    backgroundColor: COLORS.accent,
  },
  playText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  settingsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  settingItemCol: {
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingLabel: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  capoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  capoBtn: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeCapoBtn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  capoText: {
    color: COLORS.mutedForeground,
    fontWeight: 'bold',
  },
  activeCapoText: {
    color: '#fff',
  },
  metronomeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  metroToggle: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metroToggleActive: {
    backgroundColor: COLORS.accent,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeToggle: {
    backgroundColor: COLORS.surface,
  },
  toggleText: {
    color: COLORS.mutedForeground,
  },
  activeToggleText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  doneButton: {
    backgroundColor: COLORS.accent,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
