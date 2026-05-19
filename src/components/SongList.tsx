import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Music, ChevronRight, Trash2, GripVertical } from 'lucide-react-native';
import { SongMetadata } from '../types';

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333',
};

const ITEM_HEIGHT = 85;

interface SongListProps {
  songs: SongMetadata[];
  onSongPress: (song: SongMetadata) => void;
  onSyncPress: () => void;
  isSetlistMode?: boolean;
  onRemoveFromSetlist?: (songId: string) => void;
  onAddSongsPress?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

// ── Helpers (must be worklets) ─────────────────────────────────────────────

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
      if (object[id] > from && object[id] <= to) {
        newObject[id] = object[id] - 1;
      }
    } else {
      if (object[id] < from && object[id] >= to) {
        newObject[id] = object[id] + 1;
      }
    }
  }
  return newObject;
}

// ── SortableItem ────────────────────────────────────────────────────────────

interface SortableItemProps {
  song: SongMetadata;
  initialIndex: number;
  positions: Animated.SharedValue<Record<string, number>>;
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
  total,
  isSetlistMode,
  onSongPress,
  onRemoveFromSetlist,
  onReorder,
}: SortableItemProps) {
  const isDragging = useSharedValue(false);
  const startPosition = useSharedValue(-1);
  // Use the plain JS initialIndex (not positions.value) to avoid reading SharedValue during render
  const translateY = useSharedValue(initialIndex * ITEM_HEIGHT);

  const notifyReorder = (from: number, to: number) => {
    if (from !== to) onReorder?.(from, to);
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      startPosition.value = positions.value[song.id];
    })
    .onUpdate((e) => {
      translateY.value = startPosition.value * ITEM_HEIGHT + e.translationY;

      const newPosition = clamp(
        Math.floor(translateY.value / ITEM_HEIGHT + 0.5),
        0,
        total - 1,
      );
      const currentPosition = positions.value[song.id];

      if (newPosition !== currentPosition) {
        positions.value = objectMove(positions.value, currentPosition, newPosition);
      }
    })
    .onEnd(() => {
      const finalIdx = positions.value[song.id];
      translateY.value = withSpring(finalIdx * ITEM_HEIGHT);
      isDragging.value = false;
      runOnJS(notifyReorder)(startPosition.value, finalIdx);
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (!isDragging.value) {
      translateY.value = withSpring(positions.value[song.id] * ITEM_HEIGHT);
    }
    return {
      position: 'absolute',
      width: '100%',
      height: ITEM_HEIGHT,
      top: 0,
      transform: [
        { translateY: translateY.value },
        { scale: withSpring(isDragging.value ? 1.03 : 1) },
      ],
      zIndex: isDragging.value ? 100 : 0,
      shadowColor: isDragging.value ? '#000' : 'transparent',
      shadowOffset: { width: 0, height: isDragging.value ? 10 : 0 },
      shadowOpacity: isDragging.value ? 0.4 : 0,
      shadowRadius: isDragging.value ? 10 : 0,
      elevation: isDragging.value ? 15 : 2,
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <View style={styles.songRow}>
        {/* Grip handle — only visible in setlist mode */}
        {isSetlistMode && (
          <GestureDetector gesture={gesture}>
            <View style={styles.gripHandle}>
              <GripVertical size={22} color={COLORS.mutedForeground} />
            </View>
          </GestureDetector>
        )}

        {/* Song card */}
        <TouchableOpacity
          style={[styles.songItem, isSetlistMode && { flex: 1, marginBottom: 0 }]}
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
  // Build the positions shared value — index by song.id
  const positions = useSharedValue<Record<string, number>>(
    songs.reduce((acc, song, i) => {
      acc[song.id] = i;
      return acc;
    }, {} as Record<string, number>),
  );

  // Sync positions when the songs array changes from outside (e.g. after save)
  React.useEffect(() => {
    positions.value = songs.reduce((acc, song, i) => {
      acc[song.id] = i;
      return acc;
    }, {} as Record<string, number>);
  }, [songs]);

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

  const listHeight = songs.length * ITEM_HEIGHT;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
    >
      <View style={{ height: listHeight, position: 'relative' }}>
        {songs.map((song, i) => (
          <SortableItem
            key={song.id}
            song={song}
            initialIndex={i}
            positions={positions}
            total={songs.length}
            isSetlistMode={isSetlistMode}
            onSongPress={onSongPress}
            onRemoveFromSetlist={onRemoveFromSetlist}
            onReorder={handleReorder}
          />
        ))}
      </View>
    </ScrollView>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
