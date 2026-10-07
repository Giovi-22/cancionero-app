import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Users, Folder } from 'lucide-react-native';

import { COLORS } from '../../constants/theme';
import { useAppContext } from '../../context/AppContext';

interface CreateBandModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    description: string,
    driveFolderId: string,
    driveFolderName: string
  ) => Promise<void>;
}

export const CreateBandModal: React.FC<CreateBandModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const insets = useSafeAreaInsets();

  const { openFolderPicker } = useAppContext();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveFolderName, setDriveFolderName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = () => {
    openFolderPicker(
      'root',
      'Mi unidad',
      false,
      (id, folderName) => {
        setDriveFolderId(id);
        setDriveFolderName(folderName);
        setError(null);
      }
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Por favor ingresá un nombre para la banda.');
      return;
    }

    if (!driveFolderId) {
      setError(
        'Debés seleccionar una carpeta de Google Drive para la banda.'
      );
      return;
    }

    if (!driveFolderName.trim()) {
      setError(
        'La carpeta de canciones seleccionada no es válida.'
      );
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await onCreate(
        name.trim(),
        description.trim(),
        driveFolderId,
        driveFolderName.trim()
      );

      setName('');
      setDescription('');
      setDriveFolderId('');
      setDriveFolderName('');

      onClose();
    } catch (e: any) {
      setError(
        e?.message || 'Error al crear la banda'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;

    setName('');
    setDescription('');
    setDriveFolderId('');
    setDriveFolderName('');
    setError(null);

    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View
            style={[
              styles.modalCard,
              {
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Users
                  size={22}
                  color={COLORS.primary}
                />

                <Text style={styles.title}>
                  Crear banda
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={loading}
              >
                <X
                  size={22}
                  color={COLORS.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>
                    {error}
                  </Text>
                </View>
              )}

              {/* Nombre */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Nombre de la banda *
                </Text>

                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej. Banda de alabanza"
                  placeholderTextColor={COLORS.mutedForeground}
                  editable={!loading}
                  autoCapitalize="sentences"
                />
              </View>

              {/* Descripción */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Descripción (opcional)
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Una breve descripción..."
                  placeholderTextColor={COLORS.mutedForeground}
                  editable={!loading}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Carpeta de canciones */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Carpeta de canciones *
                </Text>

                <Text style={styles.helperText}>
                  Esta carpeta será la fuente de canciones de la banda.
                </Text>

                <TouchableOpacity
                  style={styles.folderButton}
                  onPress={handleSelectFolder}
                  disabled={loading}
                >
                  <Folder
                    size={24}
                    color={COLORS.primary}
                  />

                  <View style={styles.folderTextContainer}>
                    <Text
                      style={styles.folderTitle}
                      numberOfLines={1}
                    >
                      {driveFolderName
                        ? driveFolderName
                        : 'Seleccionar carpeta de Google Drive'}
                    </Text>

                    <Text style={styles.folderSubtitle}>
                      {driveFolderName
                        ? 'Carpeta seleccionada'
                        : 'Elegí la carpeta que utilizará la banda'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelText}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleCreate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                  />
                ) : (
                  <Text style={styles.createText}>
                    Crear banda
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  title: {
    color: COLORS.foreground,
    fontSize: 18,
    fontWeight: '700',
  },

  closeButton: {
    padding: 4,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },

  errorText: {
    color: '#ef4444',
    fontSize: 13,
    lineHeight: 18,
  },

  field: {
    marginBottom: 18,
  },

  label: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  helperText: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 9,
  },

  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.foreground,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  textArea: {
    minHeight: 80,
    paddingTop: 11,
  },

  folderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  folderTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  folderTitle: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '600',
  },

  folderSubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 3,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  cancelBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },

  cancelText: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '600',
  },

  createBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },

  createText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});