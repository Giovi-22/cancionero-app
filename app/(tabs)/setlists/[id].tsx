import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { ArrowLeft, Plus, Edit2, Play, Radio, Search, X, Square, FileText, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAppContext } from '../../../src/context/AppContext';
import { SongList } from '../../../src/components/SongList';
import { COLORS } from '../../../src/constants/theme';
import { SongMetadata, Setlist } from '../../../src/types';
import { StorageService } from '../../../src/services/StorageService';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SetlistDetailScreen() {
  const { id } = useLocalSearchParams();
  const {
    songs,
    activeSetlist,
    setActiveSetlist,
    activeLibrary,
    libraries,
    searchQuery,
    setSearchQuery,
    handleSongPress,
    handleSync,
    handleRemoveSongFromSetlist,
    handleMoveSong,
    handleStartSetlistLocally,
    handleUpdateSetlistNotes,
    setIsEditSetlistOpen,
    setlists,
    loadingActions,
    loadingSongId,
    handleUpdateSetlistSongNote
  } = useAppContext();

  const insets = useSafeAreaInsets();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [foreignSetlist, setForeignSetlist] = useState<Setlist | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingSetlist, setLoadingSetlist] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadTarget = async () => {
      if (!id || typeof id !== 'string') {
        if (isMounted) {
          setNotFound(true);
          setLoadingSetlist(false);
        }
        return;
      }

      // 1. Buscar en las listas de la biblioteca activa
      const foundInActive = setlists.find(s => s.id === id);
      if (foundInActive) {
        if (isMounted) {
          setActiveSetlist(foundInActive);
          setForeignSetlist(null);
          setNotFound(false);
          setLoadingSetlist(false);
        }
        return;
      }

      // 2. Si no está en la activa, consultar SQLite directamente
      try {
        const dbSetlist = await StorageService.getSetlist(id);
        if (!isMounted) return;

        if (dbSetlist) {
          setForeignSetlist(dbSetlist);
          setNotFound(false);
        } else {
          setNotFound(true);
          setForeignSetlist(null);
        }
      } catch (e) {
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoadingSetlist(false);
      }
    };

    loadTarget();

    return () => {
      isMounted = false;
    };
  }, [id, setlists, activeLibrary?.id]);

  useEffect(() => {
    if (activeSetlist) {
      setNotesText(activeSetlist.notes || '');
      // Expand automatically if there are notes
      if (activeSetlist.notes && activeSetlist.notes.trim().length > 0) {
        setIsNotesExpanded(true);
      }
    }
  }, [activeSetlist?.id, activeSetlist?.notes]);

  if (loadingSetlist) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={styles.errorTitle}>Lista no encontrada</Text>
        <Text style={styles.errorSubtitle}>
          La lista solicitada no existe o ha sido eliminada.
        </Text>
        <TouchableOpacity
          style={styles.errorBackButton}
          onPress={() => {
            setActiveSetlist(null);
            router.back();
          }}
        >
          <Text style={styles.errorBackButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (foreignSetlist && (!activeSetlist || activeSetlist.id !== id || activeSetlist.libraryId !== activeLibrary?.id)) {
    const foreignLib = libraries.find(l => l.id === foreignSetlist.libraryId);
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={styles.errorTitle}>Esta lista pertenece a otra biblioteca</Text>
        <Text style={styles.errorSubtitle}>
          La lista "{foreignSetlist.name}" pertenece a la biblioteca "{foreignLib?.name || foreignSetlist.libraryId}".
          {'\n\n'}
          Para verla o editarla, selecciona esa biblioteca desde el selector de bibliotecas.
        </Text>
        <TouchableOpacity
          style={styles.errorBackButton}
          onPress={() => {
            setActiveSetlist(null);
            router.back();
          }}
        >
          <Text style={styles.errorBackButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  const handleSaveSongNote = async (
    songId: string,
    note: string
  ) => {
    if (!activeSetlist) return;

    await handleUpdateSetlistSongNote(
      activeSetlist.id,
      songId,
      note
    );
  };

  const handleDeleteSongNote = async (
    songId: string
  ) => {
    if (!activeSetlist) return;

    await handleUpdateSetlistSongNote(
      activeSetlist.id,
      songId,
      ''
    );
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

      {/* Acciones de Play */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.startShowHeaderBtn}
          onPress={() => handleStartSetlistLocally(activeSetlist)}
        >
          <Play size={16} color="#fff" />
          <Text style={styles.startShowHeaderText}>Iniciar Local</Text>
        </TouchableOpacity>
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
        loadingSongId={loadingSongId}
        songNotes={activeSetlist?.songNotes}
        onSaveSongNote={handleSaveSongNote}
        onDeleteSongNote={handleDeleteSongNote}
        canManageSetlist={true}
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
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.foreground,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  errorBackButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorBackButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
