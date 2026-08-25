import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, UserPlus, Shield, User } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';
import { BandRole } from '../../types/band';

interface InviteMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (email: string, role: 'member' | 'director') => Promise<void>;
  canInviteDirector: boolean; // Únicamente true si es Owner
}

export function InviteMemberModal({
  visible,
  onClose,
  onInvite,
  canInviteDirector,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'director'>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Por favor ingresá una dirección de correo.');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Por favor ingresá un correo válido.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onInvite(trimmedEmail, role);
      Alert.alert(
        'Invitación enviada',
        `Se envió una invitación a ${trimmedEmail} con el rol de ${role.toUpperCase()}.`
      );
      setEmail('');
      setRole('member');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error al enviar la invitación.');
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
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <UserPlus color={COLORS.accent} size={22} />
              <Text style={styles.title}>Invitar Miembro</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={COLORS.mutedForeground} size={20} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Ingresá el correo electrónico del músico. Recibirá una notificación al iniciar sesión.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="ejemplo@correo.com"
              placeholderTextColor={COLORS.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Selección de Rol */}
          <Text style={styles.label}>Rol en la banda</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[
                styles.roleOption,
                role === 'member' && styles.roleOptionSelected,
              ]}
              onPress={() => setRole('member')}
              disabled={loading}
            >
              <User
                size={18}
                color={role === 'member' ? COLORS.accent : COLORS.mutedForeground}
              />
              <Text
                style={[
                  styles.roleText,
                  role === 'member' && styles.roleTextSelected,
                ]}
              >
                Miembro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleOption,
                role === 'director' && styles.roleOptionSelected,
                !canInviteDirector && styles.roleOptionDisabled,
              ]}
              onPress={() => canInviteDirector && setRole('director')}
              disabled={loading || !canInviteDirector}
            >
              <Shield
                size={18}
                color={
                  !canInviteDirector
                    ? 'rgba(255, 255, 255, 0.2)'
                    : role === 'director'
                    ? COLORS.accent
                    : COLORS.mutedForeground
                }
              />
              <Text
                style={[
                  styles.roleText,
                  role === 'director' && styles.roleTextSelected,
                  !canInviteDirector && styles.roleTextDisabled,
                ]}
              >
                Director
              </Text>
            </TouchableOpacity>
          </View>

          {!canInviteDirector && (
            <Text style={styles.hintText}>
              * Únicamente el Propietario (Owner) puede invitar a otros Directores.
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Enviar invitación</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: COLORS.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: COLORS.foreground,
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
    paddingVertical: 12,
    color: COLORS.foreground,
    fontSize: 15,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleOptionSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
  },
  roleOptionDisabled: {
    opacity: 0.4,
  },
  roleText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  roleTextSelected: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  roleTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  hintText: {
    color: COLORS.mutedForeground,
    fontSize: 11,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelBtnText: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
});
