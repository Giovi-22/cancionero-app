import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Mail, Check, X, Shield, User } from 'lucide-react-native';

import { COLORS } from '../../constants/theme';
import { Invitation } from '../../types/band';
import AppModal from '../common/AppModal';

interface PendingInvitationsListProps {
  invitations: Invitation[];
  onAccept: (invitationId: string) => Promise<void>;
  onReject: (invitationId: string) => Promise<void>;
}

type FeedbackModalType = 'danger' | 'success';

interface FeedbackModalState {
  type: FeedbackModalType;
  title: string;
  message: string;
}

export function PendingInvitationsList({
  invitations,
  onAccept,
  onReject,
}: PendingInvitationsListProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Invitación cuyo rechazo estamos confirmando
  const [rejectInvitation, setRejectInvitation] =
    useState<Invitation | null>(null);

  // Feedback de una acción ya realizada
  // null = no hay feedback pendiente de mostrar
  const [feedbackModal, setFeedbackModal] =
    useState<FeedbackModalState | null>(null);

  const handleAccept = async (invitation: Invitation) => {
    setProcessingId(invitation.id);

    try {
      // IMPORTANTE:
      // Primero completamos la aceptación.
      // Recién después mostramos el mensaje usando ESTA invitación.
      await onAccept(invitation.id);

      setFeedbackModal({
        type: 'success',
        title: '¡Bienvenido!',
        message: `Te uniste exitosamente a "${invitation.bandName}".`,
      });
    } catch (err: any) {
      setFeedbackModal({
        type: 'danger',
        title: 'Error',
        message:
          err?.message || 'No se pudo aceptar la invitación.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (invitation: Invitation) => {
    setRejectInvitation(invitation);
  };

  const handleCancelReject = () => {
    if (processingId) {
      return;
    }

    setRejectInvitation(null);
  };

  const handleConfirmReject = async () => {
    if (!rejectInvitation) {
      return;
    }

    const invitation = rejectInvitation;

    setProcessingId(invitation.id);

    try {
      await onReject(invitation.id);

      setRejectInvitation(null);
    } catch (err: any) {
      setRejectInvitation(null);

      setFeedbackModal({
        type: 'danger',
        title: 'Error',
        message:
          err?.message || 'No se pudo rechazar la invitación.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const closeFeedbackModal = () => {
    setFeedbackModal(null);
  };

  return (
    <>
      {invitations && invitations.length > 0 ? (
        <View style={styles.container}>
          <View style={styles.header}>
            <Mail color={COLORS.accent} size={18} />

            <Text style={styles.headerTitle}>
              Invitación
              {invitations.length > 1 ? 'es' : ''} Pendiente
              {invitations.length > 1 ? 's' : ''} ({invitations.length})
            </Text>
          </View>

          {invitations.map(invitation => {
            const isProcessing =
              processingId === invitation.id;

            const isDirector =
              invitation.role === 'director';

            return (
              <View
                key={invitation.id}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.bandInfo}>
                    <Text style={styles.bandName}>
                      {invitation.bandName}
                    </Text>

                    <Text style={styles.invitedBy}>
                      Invitado por{' '}
                      <Text style={styles.inviterName}>
                        {invitation.invitedByName}
                      </Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.roleBadge,
                      isDirector &&
                      styles.roleBadgeDirector,
                    ]}
                  >
                    {isDirector ? (
                      <Shield
                        size={12}
                        color="#000"
                      />
                    ) : (
                      <User
                        size={12}
                        color={COLORS.accent}
                      />
                    )}

                    <Text
                      style={[
                        styles.roleText,
                        isDirector &&
                        styles.roleTextDirector,
                      ]}
                    >
                      {invitation.role.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      styles.rejectBtn,
                    ]}
                    onPress={() =>
                      handleReject(invitation)
                    }
                    disabled={isProcessing}
                  >
                    <X
                      size={16}
                      color="#ef4444"
                    />

                    <Text
                      style={styles.rejectBtnText}
                    >
                      Rechazar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.btn,
                      styles.acceptBtn,
                    ]}
                    onPress={() =>
                      handleAccept(invitation)
                    }
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator
                        color="#000"
                        size="small"
                      />
                    ) : (
                      <>
                        <Check
                          size={16}
                          color="#000"
                        />

                        <Text
                          style={styles.acceptBtnText}
                        >
                          Aceptar
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Confirmación de rechazo */}
      <AppModal
        visible={!!rejectInvitation}
        type="danger"
        title="Rechazar invitación"
        message={
          rejectInvitation
            ? `¿Estás seguro de que querés rechazar la invitación a "${rejectInvitation.bandName}"?`
            : ''
        }
        confirmText="Rechazar"
        cancelText="Cancelar"
        onCancel={handleCancelReject}
        onConfirm={handleConfirmReject}
        loading={
          !!rejectInvitation &&
          processingId === rejectInvitation.id
        }
        dismissOnBackdrop={false}
      />

      {/* Resultado de aceptar/rechazar */}
      <AppModal
        visible={feedbackModal !== null}
        type={feedbackModal?.type ?? 'info'}
        title={feedbackModal?.title ?? ''}
        message={feedbackModal?.message ?? ''}
        confirmText="Aceptar"
        onConfirm={closeFeedbackModal}
        dismissOnBackdrop={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  headerTitle: {
    color: COLORS.foreground,
    fontSize: 15,
    fontWeight: '700',
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },

  bandInfo: {
    flex: 1,
    paddingRight: 8,
  },

  bandName: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },

  invitedBy: {
    color: COLORS.mutedForeground,
    fontSize: 13,
  },

  inviterName: {
    color: COLORS.foreground,
    fontWeight: '600',
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },

  roleBadgeDirector: {
    backgroundColor: COLORS.accent,
  },

  roleText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
  },

  roleTextDirector: {
    color: '#000',
  },

  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },

  rejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },

  rejectBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },

  acceptBtn: {
    backgroundColor: COLORS.accent,
  },

  acceptBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
});