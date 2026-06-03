import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { ArrowLeft, Plus, Edit2, Play, Radio, Search, X } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { SongList } from '../components/SongList';
import { COLORS } from '../constants/theme';
import { SongMetadata } from '../types';
import { router } from 'expo-router';
import { AppHeader } from '../components/layout/AppHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const SongsScreen = () => {
  const {
    songs,
    searchQuery,
    setSearchQuery,
    handleSongPress,
    handleSync,
    user,
    isSyncing
  } = useAppContext();

  const insets = useSafeAreaInsets();

  const getDisplaySongs = (): SongMetadata[] => {
    let list: SongMetadata[] = songs;

    if (searchQuery.trim().length > 0) {
      return list.filter(song =>
        song.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return list;
  };

  const displaySongs = getDisplaySongs();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Canciones"
        isSyncing={isSyncing}
        onSync={handleSync}
        onSettings={() => router.push("/(tabs)/user")}
        hasUser={!!user}
      />

      {/* Buscador de canciones */}
      <View style={styles.searchContainer}>
        <Search size={18} color={COLORS.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar canción..."
          placeholderTextColor={COLORS.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
            <X size={16} color={COLORS.foreground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Listado de canciones */}
      <SongList
        songs={displaySongs}
        onSongPress={handleSongPress}
        onSyncPress={handleSync}
        isSetlistMode={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  activeSetlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeSetlistBtn: {
    padding: 5,
  },
  activeSetlistTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  editSetlistBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startShowHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  startShowHeaderBtnActive: {
    backgroundColor: '#ef4444',
  },
  startShowHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    margin: 15,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.foreground,
    paddingVertical: 10,
    fontSize: 15,
  },
  clearSearchBtn: {
    padding: 5,
  },
});
