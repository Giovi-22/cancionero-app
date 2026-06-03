import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { ArrowLeft, Plus, Edit2, Play, Radio, Search, X } from 'lucide-react-native';
import { useAppContext } from '../../../src/context/AppContext';
import { SongList } from '../../../src/components/SongList';
import { COLORS } from '../../../src/constants/theme';
import { SongMetadata } from '../../../src/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SetlistDetailScreen() {
  const { id } = useLocalSearchParams();
  const {
    songs,
    activeSetlist,
    setActiveSetlist,
    searchQuery,
    setSearchQuery,
    handleSongPress,
    handleSync,
    handleRemoveSongFromSetlist,
    handleMoveSong,
    handleStartSetlistLocally,
    handleStartShowFromSetlist,
    myDirectorSession,
    user,
    setIsEditSetlistOpen,
    setlists
  } = useAppContext();

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!activeSetlist || activeSetlist.id !== id) {
      const found = setlists.find(s => s.id === id);
      if (found) {
        setActiveSetlist(found);
      }
    }
  }, [id, setlists]);

  if (!activeSetlist) {
    return <View style={styles.container} />;
  }

  const getDisplaySongs = (): SongMetadata[] => {
    let list = activeSetlist.songIds
      .map(songId => songs.find(s => s.id === songId))
      .filter(Boolean) as SongMetadata[];

    if (searchQuery.trim().length > 0) {
      return list.filter(song =>
        song.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return list;
  };

  const displaySongs = getDisplaySongs();

  const handleOpenEditSetlist = () => {
    setIsEditSetlistOpen(true);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.activeSetlistHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => { setActiveSetlist(null); router.back(); }} 
          style={styles.closeSetlistBtn}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.activeSetlistTitle} numberOfLines={1}>
          {activeSetlist.name}
        </Text>

        <View style={{ flexDirection: 'row', gap: 5 }}>
          <TouchableOpacity onPress={handleOpenEditSetlist} style={styles.editSetlistBtn}>
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenEditSetlist} style={styles.editSetlistBtn}>
            <Edit2 size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Acciones de Play / Vivo */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.startShowHeaderBtn}
          onPress={() => handleStartSetlistLocally(activeSetlist)}
        >
          <Play size={16} color="#fff" />
          <Text style={styles.startShowHeaderText}>Iniciar Local</Text>
        </TouchableOpacity>
        {user && (
          <TouchableOpacity
            style={[
              styles.startShowHeaderBtn, 
              myDirectorSession?.setlist_id === activeSetlist.id && styles.startShowHeaderBtnActive,
              { flex: 1 }
            ]}
            onPress={() => handleStartShowFromSetlist(activeSetlist)}
          >
            <Radio size={16} color="#fff" />
            <Text style={styles.startShowHeaderText}>
              {myDirectorSession?.setlist_id === activeSetlist.id ? 'En Vivo' : 'Iniciar Show'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={COLORS.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar en esta lista..."
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

      <SongList
        songs={displaySongs}
        onSongPress={handleSongPress}
        onSyncPress={handleSync}
        isSetlistMode={true}
        onRemoveFromSetlist={handleRemoveSongFromSetlist}
        onAddSongsPress={handleOpenEditSetlist}
        onReorder={handleMoveSong}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  activeSetlistHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    padding: 15, gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeSetlistBtn: { padding: 5, marginRight: 5 },
  activeSetlistTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', flex: 1 },
  editSetlistBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)', width: 36, height: 36, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: 10, padding: 15, paddingBottom: 0 },
  startShowHeaderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8,
  },
  startShowHeaderBtnActive: { backgroundColor: '#ef4444' },
  startShowHeaderText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 10, margin: 15, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.foreground, paddingVertical: 12, fontSize: 15 },
  clearSearchBtn: { padding: 5 },
});
