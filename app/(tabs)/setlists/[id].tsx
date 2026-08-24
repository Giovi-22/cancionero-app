import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { ArrowLeft, Plus, Edit2, Play, Radio, Search, X, Square, FileText, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
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
    handleEndShow,
    handleUpdateSetlistNotes,
    myDirectorSession,
    user,
    setIsEditSetlistOpen,
    setlists,
    loadingActions
  } = useAppContext();

  const insets = useSafeAreaInsets();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (!activeSetlist || activeSetlist.id !== id) {
      const found = setlists.find(s => s.id === id);
      if (found) {
        setActiveSetlist(found);
      }
    }
  }, [id, setlists]);

  useEffect(() => {
    if (activeSetlist) {
      setNotesText(activeSetlist.notes || '');
      // Expand automatically if there are notes
      if (activeSetlist.notes && activeSetlist.notes.trim().length > 0) {
        setIsNotesExpanded(true);
      }
    }
  }, [activeSetlist?.id, activeSetlist?.notes]);

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

  const handleSaveNotes = async () => {
    if (!activeSetlist) return;
    setIsSavingNotes(true);
    try {
      await handleUpdateSetlistNotes(activeSetlist.id, notesText);
      setIsEditingNotes(false);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const isStartingShow = loadingActions['startShow'];
  const isEndingShow = loadingActions['endShow'];

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
            disabled={isStartingShow || isEndingShow}
          >
            {isStartingShow ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Radio size={16} color="#fff" />
            )}
            <Text style={styles.startShowHeaderText}>
              {myDirectorSession?.setlist_id === activeSetlist.id ? 'En Vivo' : 'Iniciar Show'}
            </Text>
          </TouchableOpacity>
        )}
        {/* Botón Terminar: solo cuando hay una sesión activa para ESTA lista */}
        {myDirectorSession?.setlist_id === activeSetlist.id && (
          <TouchableOpacity
            style={styles.stopShowBtn}
            onPress={handleEndShow}
            disabled={isStartingShow || isEndingShow}
          >
            {isEndingShow ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Square size={16} color="#fff" fill="#fff" />
            )}
            <Text style={styles.startShowHeaderText}>Terminar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sección de Notas de la Lista */}
      <View style={styles.notesContainer}>
        <TouchableOpacity
          style={styles.notesHeader}
          onPress={() => setIsNotesExpanded(!isNotesExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.notesTitleRow}>
            <FileText size={16} color={COLORS.accent} />
            <Text style={styles.notesTitle}>Notas de la Lista</Text>
            {activeSetlist.notes && activeSetlist.notes.trim().length > 0 && (
              <View style={styles.notesBadge}>
                <Text style={styles.notesBadgeText}>1</Text>
              </View>
            )}
          </View>
          <View style={styles.notesHeaderActions}>
            <TouchableOpacity
              style={styles.editNotesBtn}
              onPress={() => {
                if (!isNotesExpanded) setIsNotesExpanded(true);
                setIsEditingNotes(!isEditingNotes);
              }}
            >
              <Text style={styles.editNotesBtnText}>
                {isEditingNotes ? 'Cancelar' : activeSetlist.notes ? 'Editar' : '+ Añadir'}
              </Text>
            </TouchableOpacity>
            {isNotesExpanded ? (
              <ChevronUp size={18} color={COLORS.mutedForeground} />
            ) : (
              <ChevronDown size={18} color={COLORS.mutedForeground} />
            )}
          </View>
        </TouchableOpacity>

        {isNotesExpanded && (
          <View style={styles.notesBody}>
            {isEditingNotes ? (
              <View style={styles.notesEditWrapper}>
                <TextInput
                  style={styles.notesInput}
                  value={notesText}
                  onChangeText={setNotesText}
                  placeholder="Escribe notas, recordatorios u observaciones..."
                  placeholderTextColor={COLORS.mutedForeground}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={styles.saveNotesBtn}
                  onPress={handleSaveNotes}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Check size={16} color="#fff" />
                      <Text style={styles.saveNotesBtnText}>Guardar Notas</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setIsEditingNotes(true)}
                activeOpacity={0.8}
              >
                {activeSetlist.notes && activeSetlist.notes.trim().length > 0 ? (
                  <Text style={styles.notesText}>{activeSetlist.notes}</Text>
                ) : (
                  <Text style={styles.notesPlaceholder}>
                    Sin notas para esta lista. Toca para añadir observaciones, orden del servicio, etc.
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
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
  stopShowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#7f1d1d', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: '#ef4444',
  },
  startShowHeaderText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 10, margin: 15, marginTop: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.foreground, paddingVertical: 12, fontSize: 15 },
  clearSearchBtn: { padding: 5 },

  // Notes styles
  notesContainer: {
    marginHorizontal: 15,
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  notesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notesTitle: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  notesBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  notesBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  notesHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editNotesBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  editNotesBtnText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  notesBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  notesEditWrapper: {
    gap: 10,
  },
  notesInput: {
    backgroundColor: COLORS.background,
    color: COLORS.foreground,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 90,
  },
  saveNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  saveNotesBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  notesText: {
    color: COLORS.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  notesPlaceholder: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
