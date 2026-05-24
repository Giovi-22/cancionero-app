import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, StyleSheet, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, CheckSquare, Square } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { COLORS } from '../constants/theme';

export const CreateSetlistModal = () => {
  const {
    isCreateSetlistOpen,
    setIsCreateSetlistOpen,
    handleCreateSetlist
  } = useAppContext();

  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (isCreateSetlistOpen) {
      setName('');
      setDate(undefined);
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

  const handleConfirm = () => {
    handleCreateSetlist(name, date);
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
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
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
              style={[styles.createModalConfirm, !name.trim() && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={!name.trim()}
            >
              <Text style={styles.createModalConfirmText}>Crear</Text>
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
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (isEditSetlistOpen && activeSetlist) {
      // Limpiar fecha previa del nombre si existe
      const cleanName = activeSetlist.name.split(' - ')[0];
      setName(cleanName);
      setDate(activeSetlist.date ? new Date(activeSetlist.date) : undefined);
      setSelectedSongIds([...activeSetlist.songIds]);
    }
  }, [isEditSetlistOpen, activeSetlist]);

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

  const handleSave = () => {
    handleSaveSetlistSongs(name, date, selectedSongIds);
  };

  return (
    <Modal
      visible={isEditSetlistOpen}
      animationType="slide"
      onRequestClose={() => setIsEditSetlistOpen(false)}
    >
      <View style={styles.editModalContainer}>
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
        </View>

        <ScrollView style={styles.editModalList} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {songs.map(song => {
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
          <TouchableOpacity style={styles.editModalSaveBtn} onPress={handleSave}>
            <Text style={styles.editModalSaveBtnText}>Guardar Lista</Text>
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
});
