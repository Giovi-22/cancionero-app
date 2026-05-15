import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Music, ChevronRight, Trash2, ChevronUp, ChevronDown } from 'lucide-react-native';
import { SongMetadata } from '../types';

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333',
};

interface SongListProps {
  songs: SongMetadata[];
  onSongPress: (song: SongMetadata) => void;
  onSyncPress: () => void;
  isSetlistMode?: boolean;
  onRemoveFromSetlist?: (songId: string) => void;
  onAddSongsPress?: () => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
}

export const SongList: React.FC<SongListProps> = ({ 
  songs, onSongPress, onSyncPress, isSetlistMode, onRemoveFromSetlist, onAddSongsPress, onMoveUp, onMoveDown
}) => {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {songs.map((song, index) => (
        <View key={song.id} style={styles.songRow}>
          {isSetlistMode && (
            <View style={styles.reorderControls}>
              <TouchableOpacity 
                onPress={() => onMoveUp?.(index)}
                disabled={index === 0}
                style={[styles.reorderBtn, index === 0 && { opacity: 0.2 }]}
              >
                <ChevronUp size={28} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => onMoveDown?.(index)}
                disabled={index === songs.length - 1}
                style={[styles.reorderBtn, index === songs.length - 1 && { opacity: 0.2 }]}
              >
                <ChevronDown size={28} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.songItem, isSetlistMode && { flex: 1, marginBottom: 0 }]} 
            onPress={() => onSongPress(song)}
          >
            <View style={styles.songInfo}>
              <View style={styles.titleRow}>
                {isSetlistMode && (
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexText}>{index + 1}</Text>
                  </View>
                )}
                <Text style={styles.songName} numberOfLines={1}>{song.name}</Text>
              </View>
              <Text style={styles.songMeta}>
                {song.syncStatus === 'synced' ? '✓ Sincronizado' : '⌛ Pendiente'}
              </Text>
            </View>
            <ChevronRight size={20} color={COLORS.mutedForeground} />
          </TouchableOpacity>

          {isSetlistMode && onRemoveFromSetlist && (
            <TouchableOpacity 
              style={styles.removeBtn} 
              onPress={() => onRemoveFromSetlist(song.id)}
            >
              <Trash2 size={22} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
    marginBottom: 16,
    gap: 12,
  },
  reorderControls: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  songItem: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
