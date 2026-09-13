import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { Clock, Mail, X } from 'lucide-react-native';

import { Invitation } from '../../types/band';
import { COLORS } from '../../constants/theme';
import AppModal from '../common/AppModal';

interface SentInvitationsListProps {
    invitations: Invitation[];
    onCancel: (invitationId: string) => Promise<void>;
}

interface ErrorModalState {
    title: string;
    message: string;
}

export function SentInvitationsList({
    invitations,
    onCancel,
}: SentInvitationsListProps) {
    const [selectedInvitation, setSelectedInvitation] =
        useState<Invitation | null>(null);

    const [errorModal, setErrorModal] =
        useState<ErrorModalState | null>(null);

    const [loading, setLoading] = useState(false);

    if (invitations.length === 0) {
        return null;
    }

    const handleCancel = (invitation: Invitation) => {
        setSelectedInvitation(invitation);
    };

    const handleConfirmCancel = async () => {
        if (!selectedInvitation) {
            return;
        }

        try {
            setLoading(true);

            await onCancel(selectedInvitation.id);

            setSelectedInvitation(null);
        } catch (error: any) {
            setSelectedInvitation(null);

            setErrorModal({
                title: 'Error',
                message:
                    error?.message ||
                    'No se pudo cancelar la invitación.',
            });
        } finally {
            setLoading(false);
        }
    };

    const closeErrorModal = () => {
        setErrorModal(null);
    };

    return (
        <>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Clock size={17} color={COLORS.accent} />
                        <Text style={styles.title}>
                            Invitaciones pendientes
                        </Text>
                    </View>

                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>
                            {invitations.length}
                        </Text>
                    </View>
                </View>

                <Text style={styles.subtitle}>
                    Personas invitadas que todavía no aceptaron.
                </Text>

                <View style={styles.list}>
                    {invitations.map(invitation => (
                        <View
                            key={invitation.id}
                            style={styles.invitationCard}
                        >
                            <View style={styles.iconCircle}>
                                <Mail
                                    size={18}
                                    color={COLORS.mutedForeground}
                                />
                            </View>

                            <View style={styles.info}>
                                <Text style={styles.email}>
                                    {invitation.invitedEmail}
                                </Text>

                                <Text style={styles.role}>
                                    {invitation.role === 'director'
                                        ? 'Director'
                                        : 'Miembro'}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancel(invitation)}
                                disabled={loading}
                            >
                                <X
                                    size={16}
                                    color={COLORS.mutedForeground}
                                />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </View>

            <AppModal
                visible={selectedInvitation !== null}
                type="warning"
                title="Cancelar invitación"
                message={
                    selectedInvitation
                        ? `¿Querés cancelar la invitación enviada a ${selectedInvitation.invitedEmail}?`
                        : undefined
                }
                confirmText="Cancelar invitación"
                cancelText="No"
                onConfirm={handleConfirmCancel}
                onCancel={() => setSelectedInvitation(null)}
                loading={loading}
            />

            <AppModal
                visible={errorModal !== null}
                type="danger"
                title={errorModal?.title ?? 'Error'}
                message={errorModal?.message}
                confirmText="Aceptar"
                onConfirm={closeErrorModal}
                onCancel={closeErrorModal}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    title: {
        color: COLORS.foreground,
        fontSize: 15,
        fontWeight: '700',
    },

    countBadge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 7,
    },

    countText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '800',
    },

    subtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 5,
        marginBottom: 12,
    },

    list: {
        gap: 8,
    },

    invitationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },

    iconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },

    info: {
        flex: 1,
    },

    email: {
        color: COLORS.foreground,
        fontSize: 13,
        fontWeight: '600',
    },

    role: {
        color: COLORS.mutedForeground,
        fontSize: 11,
        marginTop: 2,
    },

    cancelButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
});
