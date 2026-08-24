import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedRef,
  withSpring,
  runOnJS,
  scrollTo,
  SharedValue,
} from 'react-native-reanimated';
import { Music, ChevronRight, Trash2, GripVertical, FileText, Check, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SongMetadata } from '../types';
import { useAppContext } from '../context/AppContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333',
};

// Approximate height of everything above the song list (tabs, header, safe area)
// Adjust if the list is offset more/less on your device
const HEADER_OFFSET = 130;
const ITEM_HEIGHT = 85;
const AUTOSCROLL_THRESHOLD = 100;
const AUTOSCROLL_SPEED = 12;

// ── Props ───────────────────────────────────────────────────────────────────

interface SongListProps {
  songs: SongMetadata[];
  onSongPress: (song: SongMetadata) => void;
  onSyncPress: () => void;
  isSetlistMode?: boolean;
  onRemoveFromSetlist?: (songId: string) => void;
  onAddSongsPress?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  scrollEnabled?: boolean;
}

// ── Worklet helpers ─────────────────────────────────────────────────────────

function clamp(value: number, lower: number, upper: number) {
  'worklet';
  return Math.min(Math.max(value, lower), upper);
}

function objectMove(object: Record<string, number>, from: number, to: number) {
  'worklet';
  const newObject = { ...object };
  for (const id in object) {
    if (object[id] === from) {
      newObject[id] = to;
    } else if (from < to) {
      if (object[id] > from && object[id] <= to) newObject[id] = object[id] - 1;
    } else {
      if (object[id] < from && object[id] >= to) newObject[id] = object[id] + 1;
    }
  }
  return newObject;
}

// ── SortableItem ────────────────────────────────────────────────────────────

interface SortableItemProps {
  song: SongMetadata;
  initialIndex: number;
  positions: SharedValue<Record<string, number>>;
  scrollY: SharedValue<number>;
  scrollRef: any;
  total: number;
  isSetlistMode?: boolean;
  onSongPress: (song: SongMetadata) => void;
  onRemoveFromSetlist?: (songId: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEditSongNote?: (song: SongMetadata) => void;
}

function SortableItem({
  song,
  initialIndex,
  positions,
  scrollY,
  scrollRef,
  total,
  isSetlistMode,
  onSongPress,
  onRemoveFromSetlist,
  onReorder,
  onEditSongNote,
}: SortableItemProps) {
  const { loadingSongId, activeSetlist } = useAppContext();
  const isLoading = loadingSongId === song.id;
  const songNote = isSetlistMode ? activeSetlist?.songNotes?.[song.id] : undefined;
  const isDragging = useSharedValue(false);
  const startPosition = useSharedValue(-1);
  const startTop = useSharedValue(0);
  const top = useSharedValue(initialIndex * ITEM_HEIGHT);

  const notifyReorder = (from: number, to: number) => {
    if (from !== to) onReorder?.(from, to);
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      startPosition.value = positions.value[song.id];
      startTop.value = positions.value[song.id] * ITEM_HEIGHT;
    })
    .onUpdate((e) => {
      // Relative movement prevents jumping
      top.value = startTop.value + e.translationY;

      // ── Autoscroll up ──────────────────────────────────────
      if (e.absoluteY < AUTOSCROLL_THRESHOLD) {
        const nextScroll = Math.max(0, scrollY.value - AUTOSCROLL_SPEED);
        scrollTo(scrollRef, 0, nextScroll, false);
        scrollY.value = nextScroll;
      }

      // ── Autoscroll down ────────────────────────────────────
      if (e.absoluteY > SCREEN_HEIGHT - AUTOSCROLL_THRESHOLD) {
        const maxScroll = total * ITEM_HEIGHT - SCREEN_HEIGHT;
        const nextScroll = Math.min(maxScroll, scrollY.value + AUTOSCROLL_SPEED);
        scrollTo(scrollRef, 0, nextScroll, false);
        scrollY.value = nextScroll;
      }

      // ── Swap logic ─────────────────────────────────────────
      const centerOfCard = top.value + ITEM_HEIGHT / 2;
      const newIndex = clamp(Math.floor(centerOfCard / ITEM_HEIGHT), 0, total - 1);
      const currentIndex = positions.value[song.id];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
      }
    })
    .onEnd(() => {
      const finalIdx = positions.value[song.id];
      top.value = withSpring(finalIdx * ITEM_HEIGHT);
      isDragging.value = false;
      runOnJS(notifyReorder)(startPosition.value, finalIdx);
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (!isDragging.value) {
      const pos = positions.value[song.id];
      // Guard: si pos es undefined (timing entre JS y UI thread), usar initialIndex
      const targetPos = pos !== undefined ? pos : initialIndex;
      top.value = withSpring(targetPos * ITEM_HEIGHT);
    }
    return {
      position: 'absolute',
      top: top.value,
      left: 0,
      right: 0,
      height: ITEM_HEIGHT,
      zIndex: isDragging.value ? 999 : 0,
      shadowColor: isDragging.value ? '#000' : 'transparent',
      shadowOffset: { width: 0, height: isDragging.value ? 10 : 0 },
      shadowOpacity: isDragging.value ? 0.4 : 0,
      shadowRadius: isDragging.value ? 10 : 0,
      elevation: isDragging.value ? 15 : 2,
      transform: [{ scale: withSpring(isDragging.value ? 1.03 : 1) }],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <View style={styles.songRow}>
        {/* Grip handle */}
        {isSetlistMode && (
          <GestureDetector gesture={gesture}>
            <View style={styles.gripHandle}>
              <GripVertical size={22} color={COLORS.mutedForeground} />
            </View>
          </GestureDetector>
        )}

        {/* Song card */}
        <TouchableOpacity
          style={[styles.songItemWrapper, isSetlistMode && { marginBottom: 0 }]}
          onPress={() => !loadingSongId && onSongPress(song)}
          activeOpacity={loadingSongId ? 1 : 0.8}
        >
          <LinearGradient
            colors={['#18181b', '#0f172a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.songItemGradient}
          >
            <View style={styles.songInfo}>
              <View style={styles.titleRow}>
                {isSetlistMode && (
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexText}>{initialIndex + 1}</Text>
                  </View>
                )}
                <Text style={styles.songName} numberOfLines={1}>
                  {song.name}
                </Text>
              </View>
              {songNote ? (
                <TouchableOpacity
                  style={styles.songNoteBadge}
                  onPress={(e) => {
                    onEditSongNote?.(song);
                  }}
                  activeOpacity={0.7}
                >
                  <FileText size={10} color={COLORS.accent} />
                  <Text style={styles.songNoteBadgeText} numberOfLines={1}>{songNote}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.songMeta}>
                  {song.syncStatus === 'synced' ? '✓ Sincronizado' : '⌛ Pendiente'}
                </Text>
              )}
            </View>

            {/* Compact note badge button inside the card */}
            {isSetlistMode && (
              <TouchableOpacity
                style={[styles.compactNoteBadgeBtn, !!songNote && styles.compactNoteBadgeBtnActive]}
                onPress={(e) => {
                  onEditSongNote?.(song);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <FileText size={13} color={songNote ? COLORS.accent : COLORS.mutedForeground} />
                {songNote ? (
                  <Text style={styles.compactNoteBadgeText}>Nota</Text>
                ) : null}
              </TouchableOpacity>
            )}

            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <ChevronRight size={20} color={COLORS.mutedForeground} />
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Remove button */}
        {isSetlistMode && onRemoveFromSetlist && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => onRemoveFromSetlist(song.id)}
          >
            <Trash2 size={22} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

// ── SongList (exported) ─────────────────────────────────────────────────────

export const SongList: React.FC<SongListProps> = ({
  songs,
  onSongPress,
  onSyncPress,
  isSetlistMode,
  onRemoveFromSetlist,
  onAddSongsPress,
  onReorder,
  scrollEnabled = true,
}) => {
  const { activeSetlist, handleUpdateSetlistSongNote } = useAppContext();
  const insets = useSafeAreaInsets();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  const [editingSong, setEditingSong] = React.useState<SongMetadata | null>(null);
  const [songNoteText, setSongNoteText] = React.useState('');
  const [isSavingNote, setIsSavingNote] = React.useState(false);

  const handleOpenSongNote = (song: SongMetadata) => {
    setEditingSong(song);
    const existing = activeSetlist?.songNotes?.[song.id] || '';
    setSongNoteText(existing);
  };

  const handleSaveSongNote = async () => {
    if (!editingSong || !activeSetlist) return;
    setIsSavingNote(true);
    try {
      await handleUpdateSetlistSongNote(activeSetlist.id, editingSong.id, songNoteText);
      setEditingSong(null);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteSongNote = async () => {
    if (!editingSong || !activeSetlist) return;
    setIsSavingNote(true);
    try {
      await handleUpdateSetlistSongNote(activeSetlist.id, editingSong.id, '');
      setEditingSong(null);
    } finally {
      setIsSavingNote(false);
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const initialPositions = useMemo(() => {
    return songs.reduce((acc, song, i) => {
      acc[song.id] = i;
      return acc;
    }, {} as Record<string, number>);
  }, [songs]);

  const positions = useSharedValue<Record<string, number>>(initialPositions);

  useEffect(() => {
    positions.value = initialPositions;
  }, [initialPositions]);

  const handleReorder = (from: number, to: number) => {
    onReorder?.(from, to);
  };

  if (songs.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Music size={64} color={COLORS.border} />
        <Text style={styles.emptyText}>
          {isSetlistMode ? 'La lista está vacía.' : 'No hay canciones guardadas.'}
        </Text>
        {isSetlistMode ? (
          <TouchableOpacity style={styles.syncButton} onPress={onAddSongsPress}>
            <Text style={styles.syncButtonText}>Agregar canciones</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.syncButton} onPress={onSyncPress}>
            <Text style={styles.syncButtonText}>Sincronizar ahora</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const listHeight = songs.length * ITEM_HEIGHT + 100; // +100 bottom padding

  return (
    <>
      <Animated.ScrollView
        key={songs.map(s => s.id).join(',')}
        ref={scrollRef}
        style={styles.container}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={{ height: listHeight, paddingHorizontal: 16 }}
      >
        <View style={{ height: listHeight, position: 'relative' }}>
          {songs.map((song, i) => (
            <SortableItem
              key={song.id}
              song={song}
              initialIndex={i}
              positions={positions}
              scrollY={scrollY}
              scrollRef={scrollRef}
              total={songs.length}
              isSetlistMode={isSetlistMode}
              onSongPress={onSongPress}
              onRemoveFromSetlist={onRemoveFromSetlist}
              onReorder={handleReorder}
              onEditSongNote={handleOpenSongNote}
            />
          ))}
        </View>
      </Animated.ScrollView>

      {/* Modal para Editar Nota de Canción Específica */}
      <Modal
        visible={!!editingSong}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSong(null)}
      >
        <TouchableOpacity
          style={[styles.songNoteModalOverlay, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}
          activeOpacity={1}
          onPress={() => setEditingSong(null)}
        >
          <View style={styles.songNoteModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.songNoteModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <FileText size={18} color={COLORS.accent} />
                <Text style={styles.songNoteModalTitle} numberOfLines={1}>
                  Nota: {editingSong?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditingSong(null)} style={{ padding: 4 }}>
                <X size={20} color={COLORS.foreground} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.songNoteInput}
              value={songNoteText}
              onChangeText={setSongNoteText}
              placeholder="Ej: Entrar directo al coro, tono F#, sin intro..."
              placeholderTextColor={COLORS.mutedForeground}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.songNoteModalActions}>
              {activeSetlist?.songNotes?.[editingSong?.id || ''] ? (
                <TouchableOpacity
                  style={styles.deleteSongNoteBtn}
                  onPress={handleDeleteSongNote}
                  disabled={isSavingNote}
                >
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={styles.deleteSongNoteBtnText}>Eliminar</Text>
                </TouchableOpacity>
              ) : <View style={{ flex: 1 }} />}

              <TouchableOpacity
                style={styles.saveSongNoteBtn}
                onPress={handleSaveSongNote}
                disabled={isSavingNote}
              >
                {isSavingNote ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.saveSongNoteBtnText}>Guardar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: COLORS.mutedForeground,
    fontSize: 16,
    marginTop: 20,
    marginBottom: 30,
  },
  syncButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
  },
  syncButtonText: {
    color: COLORS.foreground,
    fontWeight: '600',
    fontSize: 16,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: ITEM_HEIGHT,
    paddingVertical: 6,
  },
  gripHandle: {
    width: 36,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songItemWrapper: {
    flex: 1,
    borderRadius: 16,
    height: ITEM_HEIGHT - 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  songItemGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#3f3f46',
    flex: 1,
  },
  songInfo: {
    flex: 1,
    marginRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indexBadge: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  indexText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  songName: {
    color: COLORS.foreground,
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  songMeta: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 4,
  },
  removeBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#ef444410',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ef444420',
  },
  compactNoteBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 6,
  },
  compactNoteBadgeBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  compactNoteBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  songNoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  songNoteBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 200,
  },
  // Modal de notas de canción
  songNoteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  songNoteModalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  songNoteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  songNoteModalTitle: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: 'bold',
  },
  songNoteInput: {
    backgroundColor: COLORS.background,
    color: COLORS.foreground,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 100,
    marginBottom: 16,
  },
  songNoteModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  deleteSongNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  deleteSongNoteBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  saveSongNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  saveSongNoteBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
