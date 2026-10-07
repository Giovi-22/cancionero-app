import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Folder,
  Users,
  ChevronLeft,
  X,
  CheckCircle2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '../context/AppContext';
import { COLORS } from '../constants/theme';

export const FolderPickerModal: React.FC = () => {
  const insets = useSafeAreaInsets();

  const {
    isFolderPickerOpen,
    setIsFolderPickerOpen,
    setFolderPickerCallback,
    folders,
    isLoadingFolders,
    navigationStack,
    showShared,
    openFolderPicker,
    navigateBack,
    selectFolder,
  } = useAppContext();

  const currentFolder =
    navigationStack[navigationStack.length - 1];

  const handleClose = () => {
    setIsFolderPickerOpen(false);
    setFolderPickerCallback(null);
  };

  return (
    <Modal
      visible={isFolderPickerOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <View style={styles.modalCard}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {navigationStack.length > 1 && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={navigateBack}
                  activeOpacity={0.7}
                >
                  <ChevronLeft
                    size={22}
                    color={COLORS.foreground}
                  />
                </TouchableOpacity>
              )}

              <View style={styles.headerTitleContainer}>
                <Text style={styles.title}>
                  Seleccionar carpeta
                </Text>

                <Text
                  style={styles.currentPath}
                  numberOfLines={1}
                >
                  {currentFolder?.name || 'Mi unidad'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X
                size={22}
                color={COLORS.mutedForeground}
              />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[
                styles.tab,
                !showShared && styles.activeTab,
              ]}
              onPress={() =>
                openFolderPicker(
                  'root',
                  'Mi unidad',
                  false
                )
              }
              activeOpacity={0.7}
            >
              <Folder
                size={18}
                color={
                  !showShared
                    ? COLORS.accent
                    : COLORS.mutedForeground
                }
              />

              <Text
                style={[
                  styles.tabText,
                  !showShared && styles.activeTabText,
                ]}
              >
                Mi unidad
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                showShared && styles.activeTab,
              ]}
              onPress={() =>
                openFolderPicker(
                  'root',
                  'Compartidos',
                  true
                )
              }
              activeOpacity={0.7}
            >
              <Users
                size={18}
                color={
                  showShared
                    ? COLORS.accent
                    : COLORS.mutedForeground
                }
              />

              <Text
                style={[
                  styles.tabText,
                  showShared && styles.activeTabText,
                ]}
              >
                Compartidos
              </Text>
            </TouchableOpacity>
          </View>

          {/* Breadcrumb */}
          <View style={styles.breadcrumb}>
            <Text
              style={styles.breadcrumbText}
              numberOfLines={1}
            >
              {navigationStack
                .map((folder) => folder.name)
                .join(' > ')}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {isLoadingFolders ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.accent}
                />

                <Text style={styles.loadingText}>
                  Cargando carpetas...
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.folderList}
                contentContainerStyle={styles.folderListContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {/* Back item */}
                {navigationStack.length > 1 && (
                  <TouchableOpacity
                    style={styles.backFolderItem}
                    onPress={navigateBack}
                    activeOpacity={0.7}
                  >
                    <Folder
                      size={24}
                      color={COLORS.mutedForeground}
                    />

                    <Text style={styles.backFolderText}>
                      .. (Volver)
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Folders */}
                {folders.map((folder) => (
                  <View
                    key={folder.id}
                    style={styles.folderItemRow}
                  >
                    <TouchableOpacity
                      style={styles.folderInfo}
                      onPress={() =>
                        openFolderPicker(
                          folder.id,
                          folder.name,
                          showShared
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Folder
                        size={24}
                        color={COLORS.accent}
                      />

                      <Text
                        style={styles.folderName}
                        numberOfLines={1}
                      >
                        {folder.name}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.selectButton}
                      onPress={() =>
                        selectFolder(
                          folder.id,
                          folder.name
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <View style={styles.selectButtonContent}>
                        <CheckCircle2
                          size={16}
                          color={COLORS.accent}
                        />

                        <Text style={styles.selectButtonText}>
                          Elegir
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Empty state */}
                {folders.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Folder
                      size={42}
                      color={COLORS.mutedForeground}
                    />

                    <Text style={styles.emptyTitle}>
                      No hay carpetas
                    </Text>

                    <Text style={styles.emptyText}>
                      No se encontraron carpetas disponibles
                      en esta ubicación.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 20,
  },

  modalCard: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  /* Header */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  headerTitleContainer: {
    flex: 1,
  },

  backButton: {
    padding: 4,
    marginRight: 8,
  },

  title: {
    color: COLORS.foreground,
    fontSize: 18,
    fontWeight: '700',
  },

  currentPath: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 3,
  },

  closeButton: {
    padding: 6,
    marginLeft: 8,
  },

  /* Tabs */

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },

  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },

  tabText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    fontWeight: '500',
  },

  activeTabText: {
    color: COLORS.foreground,
    fontWeight: '600',
  },

  /* Breadcrumb */

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

  /* Content */

  content: {
    flex: 1,
    minHeight: 0,
  },

  loadingContainer: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: COLORS.mutedForeground,
    marginTop: 12,
    fontSize: 14,
  },

  /* Folder list */

  folderList: {
    flex: 1,
  },

  folderListContent: {
    padding: 10,
    paddingBottom: 20,
  },

  backFolderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  backFolderText: {
    color: COLORS.mutedForeground,
    fontSize: 15,
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
    flex: 1,
  },

  /* Select button */

  selectButton: {
    padding: 12,
  },

  selectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },

  selectButtonText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Empty state */

  emptyContainer: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },

  emptyTitle: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },

  emptyText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
});
