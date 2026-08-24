import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, StyleSheet, Keyboard, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, CheckSquare, Square, Folder, ChevronRight, ArrowLeft, Search } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { COLORS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CreateSetlistModal = () => {
  const {
    isCreateSetlistOpen,
    setIsCreateSetlistOpen,
    handleCreateSetlist
  } = useAppContext();

  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isCreateSetlistOpen) {
      setName('');
      setDate(undefined);
      setNotes('');
    }
  }, [isCreateSetlistOpen]);

  if (!isCreateSetlistOpen) return null;

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  const handleConfirm = async () => {
    if (isCreating) return;
    setIsCreating(true);
    await handleCreateSetlist(name, date, notes);
    setIsCreating(false);
  };

  return (
    <Modal
      visible={isCreateSetlistOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setIsCreateSetlistOpen(false)}
    >
      <View style={styles.createModalOverlay}>
        <View style={styles.createModalCard}>
          <Text style={styles.createModalTitle}>Nueva Lista</Text>
          <TextInput
            style={styles.createModalInput}
            placeholder="Nombre de la lista..."
            placeholderTextColor={COLORS.mutedForeground}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
          />
          <TextInput
            style={[styles.createModalInput, { height: 70, textAlignVertical: 'top', marginTop: 10 }]}
            placeholder="Notas / Observaciones (Opcional)..."
            placeholderTextColor={COLORS.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.datePickerText}>
              {date
                ? `Fecha: ${formatDate(date.toISOString())}`
                : 'Añadir Fecha (Opcional)'}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
          <View style={styles.createModalActions}>
            <TouchableOpacity
              style={styles.createModalCancel}
              onPress={() => setIsCreateSetlistOpen(false)}
            >
              <Text style={styles.createModalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createModalConfirm, (!name.trim() || isCreating) && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createModalConfirmText}>Crear</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const EditSetlistModal = () => {
  const {
    isEditSetlistOpen,
    setIsEditSetlistOpen,
    activeSetlist,
    songs,
    handleSaveSetlistSongs
  } = useAppContext();

  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isEditSetlistOpen && activeSetlist) {
      const cleanName = activeSetlist.name.split(' - ')[0];
      setName(cleanName);
      setDate(activeSetlist.date ? new Date(activeSetlist.date) : undefined);
      setNotes(activeSetlist.notes || '');
      setSelectedSongIds([...activeSetlist.songIds]);
      setCurrentFolder(null);
      setSearchQuery('');
    }
  }, [isEditSetlistOpen, activeSetlist]);

  const folders = useMemo(() => {
    const names = new Set<string>();
    songs.forEach(song => {
      if (song.folderName) {
        names.add(song.folderName);
      }
    });
    return Array.from(names).map(name => ({
      name,
      songCount: songs.filter(s => s.folderName === name).length
    })).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [songs]);

  const displaySongs = useMemo(() => {
    let list = [...songs];
    if (searchQuery.trim().length > 0) {
      list = list.filter(song =>
        song.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      list = list.filter(song => {
        if (currentFolder === null) {
          return !song.folderName;
        }
        return song.folderName === currentFolder;
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [songs, searchQuery, currentFolder]);

  if (!isEditSetlistOpen || !activeSetlist) return null;

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  const handleToggleSong = (songId: string) => {
    setSelectedSongIds(prev =>
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await handleSaveSetlistSongs(name, date, selectedSongIds, notes);
    } finally {
      setIsSaving(false);
    }
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <Modal
      visible={isEditSetlistOpen}
      animationType="slide"
      onRequestClose={() => setIsEditSetlistOpen(false)}
    >
      <View style={[styles.editModalContainer, { paddingTop: insets.top }]}>
        <View style={styles.editModalHeader}>
          <Text style={styles.editModalTitle}>Editar Lista</Text>
          <TouchableOpacity onPress={() => setIsEditSetlistOpen(false)} style={{ padding: 5 }}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20, backgroundColor: COLORS.surface }}>
          <TextInput
            style={styles.createModalInput}
            placeholder="Nombre de la lista..."
            placeholderTextColor={COLORS.mutedForeground}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.createModalInput, { height: 60, textAlignVertical: 'top', marginTop: 10 }]}
            placeholder="Notas / Observaciones de la lista..."
            placeholderTextColor={COLORS.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.datePickerText}>
              {date
                ? `Fecha: ${formatDate(date.toISOString())}`
                : 'Añadir Fecha (Opcional)'}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}

          {/* Buscador dentro de Editar Lista */}
          <View style={styles.searchRow}>
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
          </View>
        </View>

        <ScrollView style={styles.editModalList} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {/* Breadcrumb de navegación */}
          {!isSearching && currentFolder !== null && (
            <View style={styles.breadcrumbContainer}>
              <TouchableOpacity onPress={() => setCurrentFolder(null)} style={styles.backButton}>
                <ArrowLeft size={20} color={COLORS.accent} />
              </TouchableOpacity>
              <Text style={styles.breadcrumbText}>
                Inicio / <Text style={styles.breadcrumbCurrent}>{currentFolder}</Text>
              </Text>
            </View>
          )}

          {/* Listado de carpetas raíz */}
          {!isSearching && currentFolder === null && folders.length > 0 && (
            <View style={styles.foldersContainer}>
              {folders.map(folder => (
                <TouchableOpacity
                  key={folder.name}
                  style={styles.folderRow}
                  onPress={() => setCurrentFolder(folder.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.folderIconContainer}>
                    <Folder size={22} color={COLORS.accent} />
                  </View>
                  <View style={styles.folderInfo}>
                    <Text style={styles.folderNameText}>{folder.name}</Text>
                    <Text style={styles.folderMetaText}>{folder.songCount} canciones</Text>
                  </View>
                  <ChevronRight size={20} color={COLORS.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Encabezado canciones sueltas */}
          {!isSearching && currentFolder === null && folders.length > 0 && displaySongs.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Canciones</Text>
            </View>
          )}

          {/* Listado de canciones */}
          {displaySongs.map(song => {
            const isSelected = selectedSongIds.includes(song.id);
            return (
              <TouchableOpacity
                key={song.id}
                style={[styles.editModalItem, isSelected && styles.editModalItemActive]}
                onPress={() => handleToggleSong(song.id)}
              >
                <View style={styles.editModalItemInfo}>
                  <Text style={[styles.editModalItemName, isSelected && styles.editModalItemNameActive]}>
                    {song.name}
                  </Text>
                </View>
                {isSelected ? (
                  <CheckSquare size={24} color={COLORS.accent} />
                ) : (
                  <Square size={24} color={COLORS.mutedForeground} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.editModalFooter}>
          <TouchableOpacity
            style={[styles.editModalSaveBtn, isSaving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.editModalSaveBtnText}>Guardar Lista</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  createModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  createModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    gap: 15,
  },
  createModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createModalInput: {
    backgroundColor: COLORS.card,
    color: COLORS.foreground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 15,
  },
  datePickerBtn: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  datePickerText: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
  createModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  createModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  createModalCancelText: {
    color: COLORS.mutedForeground,
    fontWeight: 'bold',
  },
  createModalConfirm: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createModalConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  editModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editModalList: {
    flex: 1,
  },
  editModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editModalItemActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surface + '80',
  },
  editModalItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  editModalItemName: {
    color: COLORS.mutedForeground,
    fontSize: 15,
  },
  editModalItemNameActive: {
    color: COLORS.foreground,
    fontWeight: 'bold',
  },
  editModalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  editModalSaveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  editModalSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Buscador
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
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
  // Breadcrumb navigation
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.accent}12`,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  breadcrumbText: {
    fontSize: 15,
    color: COLORS.mutedForeground,
    fontWeight: '500',
  },
  breadcrumbCurrent: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  // Folder browser items
  foldersContainer: {
    gap: 10,
    marginBottom: 15,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  folderIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${COLORS.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderInfo: {
    flex: 1,
    gap: 4,
  },
  folderNameText: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  folderMetaText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
  },
  // Section Headers
  sectionHeader: {
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sectionHeaderText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
