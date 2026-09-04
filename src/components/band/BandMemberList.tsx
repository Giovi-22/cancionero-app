import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  User,
  Crown,
  Radio,
  Shield,
  MoreVertical,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react-native';

import { BandMember, BandRole } from '../../types/band';
import { COLORS } from '../../constants/theme';
import AppModal from '../common/AppModal';


interface BandMemberListProps {
  members: BandMember[];
  currentUserId?: string;
  canChangeRole?: boolean;
  canRemoveMember?: boolean;
  onChangeRole?: (
    memberUserId: string,
    newRole: 'member' | 'director'
  ) => Promise<void>;
  onRemoveMember?: (memberUserId: string) => Promise<void>;
}

type ActionType = 'changeRole' | 'remove';

export const BandMemberList: React.FC<BandMemberListProps> = ({
  members,
  currentUserId,
  canChangeRole,
  canRemoveMember,
  onChangeRole,
  onRemoveMember,
}) => {
  const [selectedMember, setSelectedMember] = useState<BandMember | null>(null);

  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    message: string;
  }>({
    visible: false,
    message: '',
  });

  const getRoleBadge = (role: BandRole) => {
    switch (role) {
      case 'owner':
        return (
          <View style={[styles.badge, styles.ownerBadge]}>
            <Crown size={12} color="#f59e0b" />
            <Text style={[styles.badgeText, { color: '#f59e0b' }]}>
              OWNER
            </Text>
          </View>
        );

      case 'director':
        return (
          <View style={[styles.badge, styles.directorBadge]}>
            <Radio size={12} color="#a855f7" />
            <Text style={[styles.badgeText, { color: '#a855f7' }]}>
              DIRECTOR
            </Text>
          </View>
        );

      default:
        return (
          <View style={[styles.badge, styles.memberBadge]}>
            <Shield size={12} color={COLORS.mutedForeground} />
            <Text
              style={[
                styles.badgeText,
                { color: COLORS.mutedForeground },
              ]}
            >
              MIEMBRO
            </Text>
          </View>
        );
    }
  };

  const handleMemberPress = (member: BandMember) => {
    // Si no tiene permisos administrativos o el miembro seleccionado
    // es el propio Owner, no abrir opciones.
    if (
      (!canChangeRole && !canRemoveMember) ||
      member.role === 'owner'
    ) {
      return;
    }

    setSelectedMember(member);
  };

  const handleToggleRole = () => {
    if (!selectedMember || !onChangeRole || isProcessing) {
      return;
    }

    setPendingAction('changeRole');
  };

  const handleRemove = () => {
    if (!selectedMember || !onRemoveMember || isProcessing) {
      return;
    }

    setPendingAction('remove');
  };

  const handleCancelAction = () => {
    if (isProcessing) {
      return;
    }

    setPendingAction(null);
  };

  const handleConfirmAction = async () => {
    if (!selectedMember || !pendingAction || isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      if (pendingAction === 'changeRole') {
        if (!onChangeRole) {
          return;
        }

        const targetRole =
          selectedMember.role === 'director'
            ? 'member'
            : 'director';

        await onChangeRole(
          selectedMember.userId,
          targetRole
        );
      } else {
        if (!onRemoveMember) {
          return;
        }

        await onRemoveMember(selectedMember.userId);
      }

      setPendingAction(null);
      setSelectedMember(null);
    } catch (err: any) {
      console.error(
        '[BandMemberList] Error al procesar acción:',
        err
      );

      setPendingAction(null);

      setErrorModal({
        visible: true,
        message:
          err?.message ||
          (pendingAction === 'changeRole'
            ? 'No se pudo cambiar el rol del miembro.'
            : 'No se pudo eliminar al miembro.'),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseError = () => {
    setErrorModal({
      visible: false,
      message: '',
    });
  };

  const isChangingRole = pendingAction === 'changeRole';

  const confirmationTitle = isChangingRole
    ? selectedMember?.role === 'director'
      ? 'Degradar a Miembro'
      : 'Ascender a Director'
    : 'Eliminar Miembro';

  const confirmationMessage = isChangingRole
    ? `¿Estás seguro de cambiar el rol de ${selectedMember?.displayName} a ${selectedMember?.role === 'director'
      ? 'MIEMBRO'
      : 'DIRECTOR'
    }?`
    : `¿Estás seguro de eliminar a ${selectedMember?.displayName} de la banda?`;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        Miembros ({members.length})
      </Text>

      {members.map(member => {
        const isSelf = member.userId === currentUserId;

        const canManageThisMember =
          (canChangeRole || canRemoveMember) &&
          member.role !== 'owner';

        return (
          <TouchableOpacity
            key={member.userId}
            style={styles.memberCard}
            onPress={() => handleMemberPress(member)}
            activeOpacity={canManageThisMember ? 0.7 : 1}
          >
            <View style={styles.avatarContainer}>
              {member.photoURL ? (
                <Image
                  source={{ uri: member.photoURL }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User
                    size={18}
                    color={COLORS.mutedForeground}
                  />
                </View>
              )}
            </View>

            <View style={styles.info}>
              <Text
                style={styles.name}
                numberOfLines={1}
              >
                {member.displayName}{' '}
                {isSelf && (
                  <Text style={styles.selfText}>
                    (Tú)
                  </Text>
                )}
              </Text>

              <Text
                style={styles.email}
                numberOfLines={1}
              >
                {member.email}
              </Text>
            </View>

            <View style={styles.rightContent}>
              {getRoleBadge(member.role)}

              {canManageThisMember && (
                <View style={styles.moreIconBtn}>
                  <MoreVertical
                    size={18}
                    color={COLORS.mutedForeground}
                  />
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Modal de Opciones de Miembro */}
      {selectedMember && (
        <Modal
          visible={!!selectedMember}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!isProcessing && !pendingAction) {
              setSelectedMember(null);
            }
          }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              if (!isProcessing && !pendingAction) {
                setSelectedMember(null);
              }
            }}
          >
            <View style={styles.actionSheet}>
              <Text style={styles.sheetTitle}>
                Gestionar a {selectedMember.displayName}
              </Text>

              <Text style={styles.sheetSubtitle}>
                {selectedMember.email}
              </Text>

              {canChangeRole && onChangeRole && (
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={handleToggleRole}
                  disabled={isProcessing}
                >
                  {selectedMember.role === 'member' ? (
                    <>
                      <ArrowUpRight
                        size={20}
                        color="#a855f7"
                      />

                      <Text style={styles.sheetOptionText}>
                        Ascender a Director
                      </Text>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight
                        size={20}
                        color={COLORS.mutedForeground}
                      />

                      <Text style={styles.sheetOptionText}>
                        Cambiar a Miembro normal
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {canRemoveMember && onRemoveMember && (
                <TouchableOpacity
                  style={[
                    styles.sheetOption,
                    styles.sheetOptionDanger,
                  ]}
                  onPress={handleRemove}
                  disabled={isProcessing}
                >
                  <Trash2
                    size={20}
                    color="#ef4444"
                  />

                  <Text style={styles.sheetOptionTextDanger}>
                    Eliminar de la banda
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => setSelectedMember(null)}
                disabled={isProcessing}
              >
                <Text style={styles.sheetCancelText}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Confirmación de acción */}
      <AppModal
        visible={pendingAction !== null && !!selectedMember}
        type={pendingAction === 'remove' ? 'danger' : 'warning'}
        title={confirmationTitle}
        message={confirmationMessage}
        confirmText={
          pendingAction === 'remove'
            ? 'Eliminar'
            : 'Confirmar'
        }
        cancelText="Cancelar"
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        loading={isProcessing}
        dismissOnBackdrop={false}
      />

      {/* Error */}
      <AppModal
        visible={errorModal.visible}
        type="danger"
        title="Error"
        message={errorModal.message}
        confirmText="Aceptar"
        onConfirm={handleCloseError}
        dismissOnBackdrop={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },

  sectionTitle: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  avatarContainer: {
    marginRight: 12,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },

  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  info: {
    flex: 1,
    marginRight: 8,
  },

  name: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: '600',
  },

  selfText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '500',
  },

  email: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },

  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  moreIconBtn: {
    padding: 2,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },

  ownerBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },

  directorBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },

  memberBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: COLORS.border,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },

  actionSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },

  sheetTitle: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '700',
  },

  sheetSubtitle: {
    color: COLORS.mutedForeground,
    fontSize: 13,
    marginBottom: 16,
  },

  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },

  sheetOptionDanger: {
    borderBottomWidth: 0,
  },

  sheetOptionText: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: '500',
  },

  sheetOptionTextDanger: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },

  sheetCancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },

  sheetCancelText: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
});
