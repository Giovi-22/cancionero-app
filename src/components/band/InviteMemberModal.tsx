import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Image,
  FlatList,
} from 'react-native';
import { X, UserPlus, Shield, User } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';
import {
  DriveFolderUser,
  DriveService,
} from '../../services/DriveService';
import AppModal from '../common/AppModal';

interface InviteMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (
    email: string,
    role: 'member' | 'director'
  ) => Promise<void>;
  canInviteDirector: boolean;
  folderId?: string;
}

export function InviteMemberModal({
  visible,
  onClose,
  onInvite,
  canInviteDirector,
  folderId,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'director'>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [driveUsers, setDriveUsers] = useState<DriveFolderUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [successModal, setSuccessModal] = useState<{
    visible: boolean;
    email: string;
    role: 'member' | 'director';
  }>({
    visible: false,
    email: '',
    role: 'member',
  });

  /**
   * Carga los usuarios de Drive cuando se abre el modal.
   */
  useEffect(() => {
    if (!visible || !folderId) {
      return;
    }

    let cancelled = false;

    const loadDriveUsers = async () => {
      setLoadingUsers(true);

      try {
        const users = await DriveService.getFolderUsers(folderId);

        if (!cancelled) {
          setDriveUsers(users);
        }
      } catch (e) {
        console.warn(
          '[InviteMemberModal] No se pudieron cargar los usuarios de Drive:',
          e
        );

        if (!cancelled) {
          setDriveUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    };

    loadDriveUsers();

    return () => {
      cancelled = true;
    };
  }, [visible, folderId]);

  /**
   * Filtra los usuarios de Drive por nombre o email.
   */
  const filteredUsers = useMemo(() => {
    const search = email.trim().toLowerCase();

    if (!search) {
      return driveUsers;
    }

    return driveUsers.filter(user => {
      const userEmail = user.email?.toLowerCase() ?? '';
      const userName = user.name?.toLowerCase() ?? '';

      return (
        userEmail.includes(search) ||
        userName.includes(search)
      );
    });
  }, [driveUsers, email]);

  /**
   * Selecciona un usuario de la lista.
   */
  const handleSelectUser = (user: DriveFolderUser) => {
    setEmail(user.email);
    setShowSuggestions(false);
    setError(null);

    Keyboard.dismiss();
  };

  /**
   * Envía la invitación.
   */
  const handleSubmit = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError(
        'Por favor ingresá una dirección de correo.'
      );
      return;
    }

    if (
      !trimmedEmail.includes('@') ||
      !trimmedEmail.includes('.')
    ) {
      setError(
        'Por favor ingresá un correo válido.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      await onInvite(trimmedEmail, role);

      setEmail('');
      setRole('member');

      setSuccessModal({
        visible: true,
        email: trimmedEmail,
        role,
      });
    } catch (e: any) {
      setError(
        e?.message ||
        'Error al enviar la invitación.'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cierra el modal de éxito y posteriormente
   * cierra el formulario de invitación.
   */
  const handleCloseSuccess = () => {
    setSuccessModal(prev => ({
      ...prev,
      visible: false,
    }));

    onClose();
  };

  /**
   * Cierra el modal y limpia su estado.
   */
  const handleClose = () => {
    if (loading || successModal.visible) {
      return;
    }

    Keyboard.dismiss();

    setEmail('');
    setRole('member');
    setError(null);
    setShowSuggestions(false);
    setDriveUsers([]);

    onClose();
  };

  /**
   * Cuando cambia el texto mostramos nuevamente
   * las sugerencias.
   */
  const handleEmailChange = (text: string) => {
    setEmail(text);
    setError(null);
    setShowSuggestions(true);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={styles.content}>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <UserPlus
                  color={COLORS.accent}
                  size={22}
                />

                <Text style={styles.title}>
                  Invitar Miembro
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                disabled={loading}
              >
                <X
                  color={COLORS.mutedForeground}
                  size={20}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              Ingresá el correo electrónico del músico.
              Recibirá una notificación al iniciar sesión.
            </Text>

            {error && (
              <Text style={styles.errorText}>
                {error}
              </Text>
            )}

            {/* Email */}
            <Text style={styles.label}>
              Correo Electrónico
            </Text>

            <TextInput
              style={styles.input}
              placeholder="ejemplo@correo.com"
              placeholderTextColor={
                COLORS.mutedForeground
              }
              value={email}
              onChangeText={handleEmailChange}
              onFocus={() => {
                setShowSuggestions(true);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* Lista de sugerencias */}
            {showSuggestions && (
              <View style={styles.suggestionsWrapper}>

                {loadingUsers ? (
                  <View style={styles.loadingSuggestions}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.accent}
                    />

                    <Text style={styles.loadingText}>
                      Cargando usuarios...
                    </Text>
                  </View>

                ) : filteredUsers.length > 0 ? (

                  <View style={styles.listContainer}>
                    <FlatList
                      data={filteredUsers}
                      keyExtractor={item => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.userSuggestion}
                          onPress={() =>
                            handleSelectUser(item)
                          }
                          activeOpacity={0.7}
                        >
                          {/* Avatar */}
                          {item.photoUrl ? (
                            <Image
                              source={{
                                uri: item.photoUrl,
                              }}
                              style={styles.avatarImage}
                            />
                          ) : (
                            <View style={styles.avatar}>
                              <Text style={styles.avatarText}>
                                {(
                                  item.name ||
                                  item.email
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </Text>
                            </View>
                          )}

                          {/* Nombre + email */}
                          <View style={styles.userInfo}>
                            <Text
                              style={styles.userName}
                              numberOfLines={1}
                            >
                              {item.name ||
                                item.email}
                            </Text>

                            <Text
                              style={styles.userEmail}
                              numberOfLines={1}
                            >
                              {item.email}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      style={styles.usersList}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={true}
                      scrollEnabled={true}
                      nestedScrollEnabled={true}
                    />
                  </View>

                ) : (

                  <View style={styles.emptySuggestions}>
                    <Text style={styles.emptySuggestionsText}>
                      No se encontraron usuarios.
                    </Text>
                  </View>

                )}
              </View>
            )}

            {/* Rol */}
            <Text style={styles.roleLabel}>
              Rol en la banda
            </Text>

            <View style={styles.roleContainer}>

              {/* Miembro */}
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  role === 'member' &&
                  styles.roleOptionSelected,
                ]}
                onPress={() =>
                  setRole('member')
                }
                disabled={loading}
              >
                <User
                  size={18}
                  color={
                    role === 'member'
                      ? COLORS.accent
                      : COLORS.mutedForeground
                  }
                />

                <Text
                  style={[
                    styles.roleText,
                    role === 'member' &&
                    styles.roleTextSelected,
                  ]}
                >
                  Miembro
                </Text>
              </TouchableOpacity>

              {/* Director */}
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  role === 'director' &&
                  styles.roleOptionSelected,
                  !canInviteDirector &&
                  styles.roleOptionDisabled,
                ]}
                onPress={() =>
                  canInviteDirector &&
                  setRole('director')
                }
                disabled={
                  loading ||
                  !canInviteDirector
                }
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
                    role === 'director' &&
                    styles.roleTextSelected,
                    !canInviteDirector &&
                    styles.roleTextDisabled,
                  ]}
                >
                  Director
                </Text>
              </TouchableOpacity>
            </View>

            {!canInviteDirector && (
              <Text style={styles.hintText}>
                * Únicamente el Propietario (Owner)
                puede invitar a otros Directores.
              </Text>
            )}

            {/* Actions */}
            <View style={styles.actions}>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  loading &&
                  styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator
                    color="#000"
                    size="small"
                  />
                ) : (
                  <Text style={styles.submitBtnText}>
                    Enviar invitación
                  </Text>
                )}
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmación de invitación enviada */}
      <AppModal
        visible={successModal.visible}
        type="success"
        title="Invitación enviada"
        message={`Se envió una invitación a ${successModal.email} con el rol de ${successModal.role.toUpperCase()}.`}
        confirmText="Aceptar"
        onConfirm={handleCloseSuccess}
        dismissOnBackdrop={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor:
      'rgba(0, 0, 0, 0.75)',
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

  label: {
    color: COLORS.foreground,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },

  input: {
    backgroundColor:
      'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.foreground,
    fontSize: 15,
  },

  /*
   * IMPORTANTE:
   * El dropdown ya NO es absolute.
   * Forma parte del layout normal del modal.
   */
  suggestionsWrapper: {
    marginTop: 8,
    marginBottom: 16,
  },

  listContainer: {
    height: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },

  usersList: {
    flex: 1,
  },

  loadingSuggestions: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },

  loadingText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
  },

  userSuggestion: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(255, 255, 255, 0.05)',
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor:
      'rgba(234, 179, 8, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },

  avatarText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '700',
  },

  userInfo: {
    flex: 1,
    minWidth: 0,
  },

  userName: {
    color: COLORS.foreground,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },

  userEmail: {
    color: COLORS.mutedForeground,
    fontSize: 12,
  },

  emptySuggestions: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },

  emptySuggestionsText: {
    color: COLORS.mutedForeground,
    fontSize: 13,
  },

  roleLabel: {
    color: COLORS.foreground,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
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
    backgroundColor:
      'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  roleOptionSelected: {
    borderColor: COLORS.accent,
    backgroundColor:
      'rgba(234, 179, 8, 0.1)',
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
    backgroundColor:
      'rgba(255, 255, 255, 0.05)',
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

