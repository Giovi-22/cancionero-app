import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { X, Folder, Users, ChevronRight } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { COLORS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const FolderPickerModal = () => {
  const insets = useSafeAreaInsets();
  const {
    isFolderPickerOpen,
    setIsFolderPickerOpen,
    folders,
    isLoadingFolders,
    navigationStack,
    showShared,
    openFolderPicker,
    navigateBack,
    selectFolder
  } = useAppContext();

  if (!isFolderPickerOpen) return null;

  return (
    <View style={[styles.pickerOverlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.pickerContent}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Seleccionar Carpeta</Text>
          <TouchableOpacity onPress={() => setIsFolderPickerOpen(false)}>
            <X size={24} color={COLORS.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.pickerTabs}>
          <TouchableOpacity
            style={[styles.pickerTab, !showShared && styles.activePickerTab]}
            onPress={() => openFolderPicker('root', 'Mi unidad', false)}
          >
            <Folder size={18} color={!showShared ? COLORS.accent : COLORS.mutedForeground} />
            <Text style={[styles.pickerTabText, !showShared && styles.activePickerTabText]}>Mi unidad</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerTab, showShared && styles.activePickerTab]}
            onPress={() => openFolderPicker('root', 'Compartidos', true)}
          >
            <Users size={18} color={showShared ? COLORS.accent : COLORS.mutedForeground} />
            <Text style={[styles.pickerTabText, showShared && styles.activePickerTabText]}>Compartidos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.breadcrumb}>
          <Text style={styles.breadcrumbText} numberOfLines={1}>
            {navigationStack.map(f => f.name).join(' > ')}
          </Text>
        </View>

        {isLoadingFolders ? (
          <ActivityIndicator style={{ flex: 1 }} color={COLORS.accent} />
        ) : (
          <ScrollView style={styles.folderList} keyboardShouldPersistTaps="handled">
            {navigationStack.length > 1 && (
              <TouchableOpacity
                style={styles.folderItem}
                onPress={navigateBack}
                delayPressIn={100}
              >
                <Folder size={24} color={COLORS.mutedForeground} />
                <Text style={styles.folderName}>.. (Volver)</Text>
              </TouchableOpacity>
            )}
            {folders.map(folder => (
              <View key={folder.id} style={styles.folderItemRow}>
                <TouchableOpacity
                  style={styles.folderInfo}
                  onPress={() => openFolderPicker(folder.id, folder.name, showShared)}
                  delayPressIn={100}
                >
                  <Folder size={24} color={COLORS.accent} />
                  <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => selectFolder(folder.id)}
                >
                  <ChevronRight size={24} color={COLORS.accent} />
                </TouchableOpacity>
              </View>
            ))}
            {folders.length === 0 && (
              <Text style={styles.emptyText}>No hay subcarpetas aquí.</Text>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  pickerContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  pickerTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activePickerTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  pickerTabText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    fontWeight: '500',
  },
  activePickerTabText: {
    color: COLORS.foreground,
    fontWeight: '600',
  },
  breadcrumb: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  breadcrumbText: {
    color: COLORS.mutedForeground,
    fontSize: 12,
  },
  folderList: {
    flex: 1,
    padding: 10,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  folderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  folderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  folderName: {
    color: COLORS.foreground,
    fontSize: 15,
  },
  selectButton: {
    padding: 12,
  },
  emptyText: {
    color: COLORS.mutedForeground,
    textAlign: 'center',
    marginTop: 30,
    fontSize: 14,
  },
});
