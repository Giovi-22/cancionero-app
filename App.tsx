import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { RefreshCcw, Music, Settings as SettingsIcon } from 'lucide-react-native';
import { StorageService } from './src/services/StorageService';
import { SyncService } from './src/services/SyncService';
import { FileSystemService } from './src/services/FileSystemService';
import { SongMetadata } from './src/types';
import { SongList } from './src/components/SongList';
import { SongViewer } from './src/components/SongViewer';

const COLORS = {
  background: '#020617',
  foreground: '#f8fafc',
  accent: '#8b5cf6',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
};

export default function App() {
  const [songs, setSongs] = useState<SongMetadata[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedSong, setSelectedSong] = useState<SongMetadata | null>(null);
  const [songContent, setSongContent] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    const loadedSongs = await StorageService.getAllSongs();
    setSongs(loadedSongs);
  };

  const handleSongPress = async (song: SongMetadata) => {
    const content = await FileSystemService.getSongContent(song.id);
    setSelectedSong(song);
    setSongContent(content);
  };

  const handleSync = async () => {
    // In a real app, we'd get this from Auth
    const folderId = process.env.EXPO_PUBLIC_DRIVE_FOLDER_ID!;
    const accessToken = 'YOUR_GOOGLE_ACCESS_TOKEN'; // TODO: Implement Auth

    setIsSyncing(true);
    try {
      // For now, if we don't have a token, we just simulate or warn
      if (accessToken === 'YOUR_GOOGLE_ACCESS_TOKEN') {
        console.warn('Sync requested but no Google Access Token available.');
        // Simulation for UI feedback
        setTimeout(() => setIsSyncing(false), 2000);
        return;
      }
      
      await SyncService.syncFullRepertoire(accessToken, folderId);
      await loadSongs();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (selectedSong && songContent) {
    return (
      <SongViewer 
        title={selectedSong.name} 
        content={songContent} 
        onBack={() => setSelectedSong(null)} 
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cancionero</Text>
          <Text style={styles.subtitle}>{songs.length} canciones disponibles</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleSync}
            disabled={isSyncing}
          >
            <RefreshCcw 
              size={24} 
              color={isSyncing ? COLORS.mutedForeground : COLORS.foreground} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <SettingsIcon size={24} color={COLORS.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <SongList 
          songs={songs} 
          onSongPress={handleSongPress} 
          onSyncPress={handleSync} 
        />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Music size={24} color={COLORS.accent} />
          <Text style={[styles.tabLabel, { color: COLORS.accent }]}>Canciones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={handleSync}>
          <RefreshCcw size={24} color={COLORS.mutedForeground} />
          <Text style={styles.tabLabel}>Sincronizar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <SettingsIcon size={24} color={COLORS.mutedForeground} />
          <Text style={styles.tabLabel}>Ajustes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.muted,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.foreground,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: COLORS.muted,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
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
  songItem: {
    backgroundColor: COLORS.muted,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  songName: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  songMeta: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    height: 65,
    backgroundColor: COLORS.muted,
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    paddingBottom: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    color: COLORS.mutedForeground,
  }
});
