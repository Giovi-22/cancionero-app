/**
 * SongCard — tarjeta individual de canción con soporte para:
 *  - Drag & drop (reordenamiento en setlists)
 *  - Indicador de carga mientras se abre la canción
 *  - Nota compacta de setlist
 *  - Estados de disponibilidad (available / offline / downloading / unavailable)
 *
 * Extraído de SongList.tsx para facilitar su reutilización y mantenimiento.
 */

import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  runOnJS,
  scrollTo,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  ChevronRight,
  FileText,
  GripVertical,
  Trash2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { SongMetadata } from '../types';
import { COLORS } from '../constants/theme';
import { SongAvailabilityStatus } from './SongList';

// ── Constantes (deben coincidir con SongList) ────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SONG_CARD_HEIGHT = 85;
const AUTOSCROLL_THRESHOLD = 100;
const AUTOSCROLL_SPEED = 12;

// ── Worklet helpers ──────────────────────────────────────────────────────────

function clamp(value: number, lower: number, upper: number) {
  'worklet';
  return Math.min(Math.max(value, lower), upper);
}

function objectMove(
  object: Record<string, number>,
  from: number,
  to: number
) {
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

// ── Props ────────────────────────────────────────────────────────────────────

export interface SongCardProps {
  song: SongMetadata;
  initialIndex: number;
  positions: SharedValue<Record<string, number>>;
  scrollY: SharedValue<number>;
  scrollRef: any;
  total: number;

  isSetlistMode?: boolean;
  canManageSetlist?: boolean;

  onSongPress: (song: SongMetadata) => void;
  onRemoveFromSetlist?: (songId: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEditSongNote?: (song: SongMetadata) => void;

  songNote?: string;
  loadingSongId?: string | null;
  songStatus?: SongAvailabilityStatus;
}

// ── Componente ───────────────────────────────────────────────────────────────

export function SongCard({
  song,
  initialIndex,
  positions,
  scrollY,
  scrollRef,
  total,
  isSetlistMode,
  canManageSetlist,
  onSongPress,
  onRemoveFromSetlist,
  onReorder,
  onEditSongNote,
  songNote,
  loadingSongId,
  songStatus,
}: SongCardProps) {
  const isLoading = loadingSongId === song.id;

  const status =
    songStatus ??
    (song.syncStatus === 'synced' ? 'available' : 'unavailable');

  const isDragging = useSharedValue(false);
  const startPosition = useSharedValue(-1);
  const startTop = useSharedValue(0);
  const top = useSharedValue(initialIndex * SONG_CARD_HEIGHT);

  const notifyReorder = (from: number, to: number) => {
    if (from !== to) onReorder?.(from, to);
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      startPosition.value = positions.value[song.id];
      startTop.value = positions.value[song.id] * SONG_CARD_HEIGHT;
    })
    .onUpdate((e) => {
      top.value = startTop.value + e.translationY;

      if (e.absoluteY < AUTOSCROLL_THRESHOLD) {
        const nextScroll = Math.max(0, scrollY.value - AUTOSCROLL_SPEED);
        scrollTo(scrollRef, 0, nextScroll, false);
        scrollY.value = nextScroll;
      }

      if (e.absoluteY > SCREEN_HEIGHT - AUTOSCROLL_THRESHOLD) {
        const maxScroll = Math.max(0, total * SONG_CARD_HEIGHT - SCREEN_HEIGHT);
        const nextScroll = Math.min(maxScroll, scrollY.value + AUTOSCROLL_SPEED);
        scrollTo(scrollRef, 0, nextScroll, false);
        scrollY.value = nextScroll;
      }

      const centerOfCard = top.value + SONG_CARD_HEIGHT / 2;
      const newIndex = clamp(
        Math.floor(centerOfCard / SONG_CARD_HEIGHT),
        0,
        total - 1
      );
      const currentIndex = positions.value[song.id];
      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
      }
    })
    .onEnd(() => {
      const finalIdx = positions.value[song.id];
      top.value = withSpring(finalIdx * SONG_CARD_HEIGHT);
      isDragging.value = false;
      runOnJS(notifyReorder)(startPosition.value, finalIdx);
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (!isDragging.value) {
      const pos = positions.value[song.id];
      const targetPos = pos !== undefined ? pos : initialIndex;
      top.value = withSpring(targetPos * SONG_CARD_HEIGHT);
    }
    return {
      position: 'absolute' as const,
      top: top.value,
      left: 0,
      right: 0,
      height: SONG_CARD_HEIGHT,
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
        {isSetlistMode && canManageSetlist && (
          <GestureDetector gesture={gesture}>
            <View style={styles.gripHandle}>
              <GripVertical size={22} color={COLORS.mutedForeground} />
            </View>
          </GestureDetector>
        )}

        {/* Tarjeta principal */}
        <TouchableOpacity
          style={[styles.songItemWrapper, isSetlistMode && { marginBottom: 0 }]}
          onPress={() => !loadingSongId && onSongPress(song)}
          activeOpacity={loadingSongId ? 1 : 0.8}
        >
          <LinearGradient
            colors={['#18181b', '#0f172a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.songItemGradient,
              isLoading && styles.songItemGradientLoading,
            ]}
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
                  onPress={() => canManageSetlist && onEditSongNote?.(song)}
                  activeOpacity={canManageSetlist ? 0.7 : 1}
                >
                  <FileText size={10} color={COLORS.accent} />
                  <Text style={styles.songNoteBadgeText} numberOfLines={1}>
                    {songNote}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.songMeta}>
                  {status === 'available' && '✓ Disponible'}
                  {status === 'offline' && '✓ Disponible sin conexión'}
                  {status === 'downloading' && '↓ Descargando...'}
                  {status === 'unavailable' && '⚠ No disponible'}
                </Text>
              )}
            </View>

            {/* Botón de nota compacto */}
            {isSetlistMode && canManageSetlist && onEditSongNote && (
              <TouchableOpacity
                style={[
                  styles.compactNoteBadgeBtn,
                  !!songNote && styles.compactNoteBadgeBtnActive,
                ]}
                onPress={() => onEditSongNote(song)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <FileText
                  size={13}
                  color={songNote ? COLORS.accent : COLORS.mutedForeground}
                />
                {songNote ? (
                  <Text style={styles.compactNoteBadgeText}>Nota</Text>
                ) : null}
              </TouchableOpacity>
            )}

            {/* Spinner / chevron */}
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <ChevronRight size={20} color={COLORS.mutedForeground} />
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Botón eliminar */}
        {isSetlistMode && canManageSetlist && onRemoveFromSetlist && (
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

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: SONG_CARD_HEIGHT,
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
    height: SONG_CARD_HEIGHT - 12,
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
  songItemGradientLoading: {
    borderColor: COLORS.accent + '70',
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
});
