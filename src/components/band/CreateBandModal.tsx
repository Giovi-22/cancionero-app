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
import { X, Users } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

interface CreateBandModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export const CreateBandModal: React.FC<CreateBandModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Por favor ingresá un nombre para la banda.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onCreate(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error al crear la banda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <TouchableOpacity
          style={[
            styles.overlay,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <Users color={COLORS.accent} size={22} />
                  <Text style={styles.title}>Crear Nueva Banda</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X color={COLORS.mutedForeground} size={20} />
                </TouchableOpacity>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.field}>
                <Text style={styles.label}>Nombre de la banda *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Banda Alabanza Domingo"
                  placeholderTextColor={COLORS.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Descripción (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ej. Grupo musical del servicio principal"
                  placeholderTextColor={COLORS.mutedForeground}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={loading}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={handleCreate}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.createText}>Crear Banda</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
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
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: COLORS.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.foreground,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cancelText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  createBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
});
