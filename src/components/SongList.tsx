import React from 'react';
import { Dimensions, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
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
import { Music, ChevronRight, Trash2, GripVertical } from 'lucide-react-native';
import { SongMetadata } from '../types';

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
}: SortableItemProps) {
  const isDragging = useSharedValue(false);
  const startPosition = useSharedValue(-1);
  const top = useSharedValue(initialIndex * ITEM_HEIGHT);

  const notifyReorder = (from: number, to: number) => {
    if (from !== to) onReorder?.(from, to);
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      startPosition.value = positions.value[song.id];
    })
    .onUpdate((e) => {
      // Absolute position within the scrollable content
      const absoluteY = e.absoluteY + scrollY.value - HEADER_OFFSET;
      top.value = absoluteY;

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
      const newIndex = clamp(Math.floor(absoluteY / ITEM_HEIGHT), 0, total - 1);
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
          style={[styles.songItem, isSetlistMode && { marginBottom: 0 }]}
          onPress={() => onSongPress(song)}
          activeOpacity={0.7}
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
            <Text style={styles.songMeta}>
              {song.syncStatus === 'synced' ? '✓ Sincronizado' : '⌛ Pendiente'}
            </Text>
          </View>
          <ChevronRight size={20} color={COLORS.mutedForeground} />
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
}) => {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const positions = useSharedValue<Record<string, number>>({});

  // Actualizar positions de forma síncrona en el render phase para evitar lag/desincronización entre hilos
  positions.value = songs.reduce((acc, song, i) => {
    acc[song.id] = i;
    return acc;
  }, {} as Record<string, number>);

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
    <Animated.ScrollView
      key={songs.map(s => s.id).join(',')}
      ref={scrollRef}
      style={styles.container}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
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
          />
        ))}
      </View>
    </Animated.ScrollView>
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
  songItem: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    height: ITEM_HEIGHT - 12,
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
});
