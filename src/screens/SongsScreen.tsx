import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { ArrowLeft, Plus, Edit2, Play, Radio, Search, X } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { SongList } from '../components/SongList';
import { COLORS } from '../constants/theme';
import { SongMetadata } from '../types';

export const SongsScreen = () => {
  const {
    songs,
    activeSetlist,
    setActiveSetlist,
    setActiveTab,
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
    setIsEditSetlistOpen
  } = useAppContext();

  // Filtrar canciones según si estamos en un Setlist o en la lista general
  const getDisplaySongs = (): SongMetadata[] => {
    let list: SongMetadata[] = [];
    if (activeSetlist) {
      list = activeSetlist.songIds
        .map(id => songs.find(s => s.id === id))
        .filter(Boolean) as SongMetadata[];
    } else {
      list = songs;
    }

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
      {/* Cabecera de Setlist Activo */}
      {activeSetlist && (
        <View style={styles.activeSetlistHeader}>
          <TouchableOpacity 
            onPress={() => { setActiveSetlist(null); setActiveTab('setlists'); }} 
            style={styles.closeSetlistBtn}
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.activeSetlistTitle} numberOfLines={1}>
            {activeSetlist.name}
          </Text>

          <View style={{ flexDirection: 'row', gap: 5 }}>
            <TouchableOpacity onPress={handleOpenEditSetlist} style={styles.editSetlistBtn}>
              <Plus size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleOpenEditSetlist} style={styles.editSetlistBtn}>
              <Edit2 size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.startShowHeaderBtn}
            onPress={() => handleStartSetlistLocally(activeSetlist)}
          >
            <Play size={14} color="#fff" />
            <Text style={styles.startShowHeaderText}>Iniciar</Text>
          </TouchableOpacity>
          {user && (
            <TouchableOpacity
              style={[
                styles.startShowHeaderBtn, 
                myDirectorSession?.setlist_id === activeSetlist.id && styles.startShowHeaderBtnActive
              ]}
              onPress={() => handleStartShowFromSetlist(activeSetlist)}
            >
              <Radio size={14} color="#fff" />
              <Text style={styles.startShowHeaderText}>
                {myDirectorSession?.setlist_id === activeSetlist.id ? 'En Vivo' : 'Iniciar Show'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Buscador de canciones */}
      <View style={styles.searchContainer}>
        <Search size={18} color={COLORS.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeSetlist ? "Buscar en esta lista..." : "Buscar canción..."}
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
        isSetlistMode={!!activeSetlist}
        onRemoveFromSetlist={activeSetlist ? handleRemoveSongFromSetlist : undefined}
        onAddSongsPress={handleOpenEditSetlist}
        onReorder={activeSetlist ? handleMoveSong : undefined}
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
