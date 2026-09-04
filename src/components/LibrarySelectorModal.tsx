import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  BookOpen,
  Music,
  Star,
  Heart,
  Settings,
  Folder,
  Mic,
  Headphones,
  Radio,
  Bookmark,
  List,
  Play,
  Volume2,
} from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { COLORS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Library } from '../types';
import AppModal from './common/AppModal';


interface LibrarySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = {
  colors: [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
    '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#78716c'
  ],
  icons: [
    'book-open', 'music', 'star', 'heart', 'settings',
    'folder', 'mic', 'headphones', 'radio', 'bookmark', 'list', 'play', 'volume2'
  ]
};

type FeedbackModal = {
  visible: boolean;
  type: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  onConfirm?: () => void;
};

export const LibrarySelectorModal = ({
  isOpen,
  onClose,
}: LibrarySelectorModalProps) => {
  const insets = useSafeAreaInsets();

  const {
    libraries,
    activeLibrary,
    setActiveLibrary,
    handleCreateLibrary,
    handleUpdateLibrary,
    handleDeleteLibrary,
    loadingActions,
    openFolderPicker,
  } = useAppContext();

  // Estados del modal
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingLib, setEditingLib] = useState<Library | null>(null);

  // Formulario
  const [name, setName] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESETS.colors[0]);
  const [selectedIcon, setSelectedIcon] = useState(PRESETS.icons[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Feedback
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModal>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showFeedback = (
    type: FeedbackModal['type'],
    title: string,
    message: string,
    options?: {
      confirmText?: string;
      onConfirm?: () => void;
    },
  ) => {
    setFeedbackModal({
      visible: true,
      type,
      title,
      message,
      confirmText: options?.confirmText,
      onConfirm: options?.onConfirm,
    });
  };

  const closeFeedback = () => {
    setFeedbackModal(prev => ({
      ...prev,
      visible: false,
    }));
  };

  const handleOpenCreate = () => {
    setName('');
    setDriveFolderId('');
    setSelectedColor(PRESETS.colors[0]);
    setSelectedIcon(PRESETS.icons[0]);
    setView('create');
  };

  const handleOpenEdit = (lib: Library) => {
    setEditingLib(lib);
    setName(lib.name);
    setDriveFolderId(lib.driveFolderId || '');
    setSelectedColor(lib.color || PRESETS.colors[0]);
    setSelectedIcon(lib.icon || PRESETS.icons[0]);
    setView('edit');
  };

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      showFeedback(
        'warning',
        'Nombre requerido',
        'El nombre de la biblioteca es requerido.',
      );
      return;
    }

    setIsSaving(true);

    try {
      if (view === 'create') {
        await handleCreateLibrary(
          trimmedName,
          driveFolderId.trim(),
          selectedIcon,
          selectedColor,
        );

        showFeedback(
          'success',
          'Biblioteca creada',
          `La biblioteca "${trimmedName}" fue creada correctamente.`,
          {
            confirmText: 'Aceptar',
            onConfirm: () => {
              closeFeedback();
              setView('list');
            },
          },
        );
      } else if (view === 'edit' && editingLib) {
        await handleUpdateLibrary({
          ...editingLib,
          name: trimmedName,
          driveFolderId: driveFolderId.trim(),
          color: selectedColor,
          icon: selectedIcon,
        });

        showFeedback(
          'success',
          'Biblioteca actualizada',
          'La biblioteca fue actualizada correctamente.',
          {
            confirmText: 'Aceptar',
            onConfirm: () => {
              closeFeedback();
              setView('list');
            },
          },
        );
      }
    } catch (e) {
      console.error(
        '[LibrarySelectorModal] Error al guardar biblioteca:',
        e,
      );

      showFeedback(
        'danger',
        'Error',
        'No se pudo guardar la biblioteca.',
        {
          confirmText: 'Aceptar',
          onConfirm: closeFeedback,
        },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderIcon = (
    iconName: string,
    color: string,
    size: number = 20,
  ) => {
    switch (iconName) {
      case 'music':
        return <Music size={size} color={color} />;
      case 'star':
        return <Star size={size} color={color} />;
      case 'heart':
        return <Heart size={size} color={color} />;
      case 'settings':
        return <Settings size={size} color={color} />;
      case 'folder':
        return <Folder size={size} color={color} />;
      case 'mic':
        return <Mic size={size} color={color} />;
      case 'headphones':
        return <Headphones size={size} color={color} />;
      case 'radio':
        return <Radio size={size} color={color} />;
      case 'bookmark':
        return <Bookmark size={size} color={color} />;
      case 'list':
        return <List size={size} color={color} />;
      case 'play':
        return <Play size={size} color={color} />;
      case 'volume2':
        return <Volume2 size={size} color={color} />;
      case 'book-open':
      default:
        return <BookOpen size={size} color={color} />;
    }
  };

  return (
    <>
      <Modal
        visible={isOpen}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View
          style={[
            styles.container,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {view === 'list' && 'Mis Bibliotecas'}
              {view === 'create' && 'Nueva Biblioteca'}
              {view === 'edit' && 'Editar Biblioteca'}
            </Text>

            <TouchableOpacity
              onPress={() => {
                if (view !== 'list') {
                  setView('list');
                } else {
                  onClose();
                }
              }}
              style={styles.closeBtn}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* CONTENIDO */}
          <View style={styles.content}>
            {view === 'list' ? (
              <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.listContainer}>
                  {libraries.map(lib => {
                    const isActive = activeLibrary?.id === lib.id;
                    const isChangingActive =
                      loadingActions?.['setActiveLibrary'];
                    const isThisChanging =
                      isChangingActive && isActive;

                    return (
                      <TouchableOpacity
                        key={lib.id}
                        style={[
                          styles.libCard,
                          isActive && styles.libCardActive,
                        ]}
                        disabled={isChangingActive}
                        onPress={async () => {
                          await setActiveLibrary(lib);
                          onClose();
                        }}
                      >
                        <View style={styles.libCardLeft}>
                          <View
                            style={[
                              styles.iconWrapper,
                              {
                                backgroundColor:
                                  lib.color || COLORS.accent,
                              },
                            ]}
                          >
                            {renderIcon(
                              lib.icon || 'book-open',
                              '#fff',
                            )}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={styles.libName}>
                              {lib.name}
                            </Text>

                            <Text
                              style={styles.libFolder}
                              numberOfLines={1}
                            >
                              {lib.driveFolderId
                                ? `Carpeta: ${lib.driveFolderId}`
                                : 'Sin carpeta vinculada'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.libCardRight}>
                          {isActive && (
                            <View style={styles.activeBadge}>
                              {isThisChanging ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#fff"
                                  style={{
                                    transform: [{ scale: 0.75 }],
                                  }}
                                />
                              ) : (
                                <Check size={16} color="#fff" />
                              )}
                            </View>
                          )}

                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleOpenEdit(lib)}
                            disabled={isChangingActive}
                          >
                            <Edit2
                              size={16}
                              color={COLORS.mutedForeground}
                            />
                          </TouchableOpacity>

                          {lib.id !== 'default' && (
                            <TouchableOpacity
                              style={styles.actionBtn}
                              onPress={() =>
                                handleDeleteLibrary(lib.id)
                              }
                              disabled={isChangingActive}
                            >
                              <Trash2
                                size={16}
                                color="#ef4444"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={handleOpenCreate}
                >
                  <Plus size={20} color="#fff" />

                  <Text style={styles.createBtnText}>
                    Crear Nueva Biblioteca
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* FORMULARIO CREAR / EDITAR */
              <ScrollView
                contentContainerStyle={styles.formContainer}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Nombre de la Biblioteca
                  </Text>

                  <TextInput
                    style={styles.formInput}
                    placeholder="Ej. Banda Principal, Acústico, Iglesia..."
                    placeholderTextColor={
                      COLORS.mutedForeground
                    }
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Google Drive Folder ID (Opcional)
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                    }}
                  >
                    <TextInput
                      style={[
                        styles.formInput,
                        { flex: 1 },
                      ]}
                      placeholder="Identificador de la carpeta de Drive..."
                      placeholderTextColor={
                        COLORS.mutedForeground
                      }
                      value={driveFolderId}
                      onChangeText={setDriveFolderId}
                    />

                    <TouchableOpacity
                      style={{
                        backgroundColor: COLORS.surface,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        borderRadius: 8,
                        paddingHorizontal: 15,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      onPress={() =>
                        openFolderPicker(
                          'root',
                          'Mi unidad',
                          false,
                          id => setDriveFolderId(id),
                        )
                      }
                    >
                      <Folder
                        size={20}
                        color={COLORS.accent}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.formHelp}>
                    Si la dejas vacía, podrás configurarla después
                    en la sección de Ajustes.
                  </Text>
                </View>

                {/* Color Preset Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Color de Identificación
                  </Text>

                  <View style={styles.presetRow}>
                    {PRESETS.colors.map(color => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorDot,
                          { backgroundColor: color },
                          selectedColor === color &&
                          styles.colorDotActive,
                        ]}
                        onPress={() =>
                          setSelectedColor(color)
                        }
                      >
                        {selectedColor === color && (
                          <Check
                            size={14}
                            color="#fff"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Icon Preset Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Ícono Representativo
                  </Text>

                  <View style={styles.presetRow}>
                    {PRESETS.icons.map(iconName => {
                      const isSelected =
                        selectedIcon === iconName;

                      return (
                        <TouchableOpacity
                          key={iconName}
                          style={[
                            styles.iconDot,
                            isSelected && {
                              borderColor: selectedColor,
                              backgroundColor:
                                selectedColor + '20',
                            },
                          ]}
                          onPress={() =>
                            setSelectedIcon(iconName)
                          }
                        >
                          {renderIcon(
                            iconName,
                            isSelected
                              ? selectedColor
                              : COLORS.mutedForeground,
                            18,
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Acciones del formulario */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelFormBtn}
                    onPress={() => setView('list')}
                  >
                    <Text style={styles.cancelFormText}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.saveFormBtn,
                      {
                        backgroundColor: selectedColor,
                      },
                      isSaving && { opacity: 0.7 },
                    ]}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator
                        size="small"
                        color="#fff"
                      />
                    ) : (
                      <Text style={styles.saveFormText}>
                        Guardar
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Feedback reutilizable */}
      <AppModal
        visible={feedbackModal.visible}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        confirmText={feedbackModal.confirmText || 'Aceptar'}
        onConfirm={
          feedbackModal.onConfirm || closeFeedback
        }
        dismissOnBackdrop={false}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },

  closeBtn: {
    padding: 5,
  },

  content: {
    flex: 1,
  },

  listContainer: {
    padding: 20,
    gap: 12,
  },

  libCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  libCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surface + 'e0',
  },

  libCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    flex: 1,
  },

  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  libName: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: 'bold',
  },

  libFolder: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },

  libCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  activeBadge: {
    backgroundColor: COLORS.accent,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },

  actionBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  createBtn: {
    margin: 20,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },

  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  formContainer: {
    padding: 20,
    gap: 20,
  },

  formGroup: {
    gap: 8,
  },

  formLabel: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '600',
  },

  formInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: COLORS.foreground,
    fontSize: 15,
  },

  formHelp: {
    color: COLORS.mutedForeground,
    fontSize: 11,
  },

  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },

  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  colorDotActive: {
    borderWidth: 2,
    borderColor: COLORS.foreground,
  },

  iconDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  formActions: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 20,
  },

  cancelFormBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },

  cancelFormText: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: 'bold',
  },

  saveFormBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },

  saveFormText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
