import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Music, ChevronRight, Trash2 } from 'lucide-react-native';
import { SongMetadata } from '../types';

const COLORS = {
  background: '#020617',
  foreground: '#f8fafc',
  accent: '#8b5cf6',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
};

interface SongListProps {
  songs: SongMetadata[];
  onSongPress: (song: SongMetadata) => void;
  onSyncPress: () => void;
  isSetlistMode?: boolean;
  onRemoveFromSetlist?: (songId: string) => void;
  onAddSongsPress?: () => void;
}

export const SongList: React.FC<SongListProps> = ({ 
  songs, onSongPress, onSyncPress, isSetlistMode, onRemoveFromSetlist, onAddSongsPress 
}) => {
  if (songs.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Music size={64} color={COLORS.muted} />
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
      {songs.map((song) => (
        <View key={song.id} style={isSetlistMode ? styles.songItemRow : null}>
          <TouchableOpacity 
            style={[styles.songItem, isSetlistMode && { flex: 1, marginBottom: 0 }]}
            onPress={() => onSongPress(song)}
          >
            <View style={styles.songInfo}>
              <Text style={styles.songName} numberOfLines={1}>{song.name}</Text>
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
              <Trash2 size={20} color="#ef4444" />
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
    padding: 20,
    paddingBottom: 100, // Space for tab bar
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
  songItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  songItem: {
    backgroundColor: COLORS.muted,
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  songInfo: {
    flex: 1,
    marginRight: 10,
  },
  songName: {
    color: COLORS.foreground,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  songMeta: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    marginTop: 4,
  },
  removeBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#ef444415',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ef444430',
  },
});
