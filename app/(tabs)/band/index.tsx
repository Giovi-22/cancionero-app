import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Users,
    Plus,
    Radio,
    ListMusic,
    UserPlus,
    ChevronRight,
    Sparkles,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useBandContext } from '../../../src/context/BandContext';
import { useBandInvitations } from '../../../src/hooks/useBandInvitations';
import { useDirectorSession } from '../../../src/hooks/useDirectorSession';
import { BandService } from '../../../src/services/BandService';
import { COLORS } from '../../../src/constants/theme';
import { CreateBandModal } from '../../../src/components/band/CreateBandModal';
import { InviteMemberModal } from '../../../src/components/band/InviteMemberModal';
import { PendingInvitationsList } from '../../../src/components/band/PendingInvitationsList';
import { BandMemberList } from '../../../src/components/band/BandMemberList';
import { useAppContext } from '../../../src/context/AppContext';
import { SentInvitationsList } from '../../../src/components/band/SentInvitationsList';
import AppModal from '../../../src/components/common/AppModal';
import { useUserContext } from '../../../src/context/UserContext';

type FeedbackModalType =
    | 'danger'
    | 'warning'
    | 'success'
    | 'info';

interface FeedbackModalState {
    visible: boolean;
    type: FeedbackModalType;
    title: string;
    message: string;
}

export default function BandScreen() {
    const insets = useSafeAreaInsets();

    const {
        driveFolderId,
    } = useAppContext();

    const { user } = useUserContext();

    // ============================================================
    // BandContext
    //
    // Fuente única de verdad para banda activa, rol y permisos.
    // Antes esta pantalla usaba useBands() directamente, lo que
    // creaba una instancia independiente (y su propio listener de
    // Firestore) desincronizada del resto de la app. Ver plan de
    // refactorización arquitectónica.
    // ============================================================
    const {
        bands,
        selectedBand,
        userRole,
        permissions,
        members,
        loading,
        selectBand,
        createBand,
    } = useBandContext();

    const {
        activeSession,
        isDirectorOfSession,
        endSession,
    } = useDirectorSession(selectedBand?.id || null);

    const {
        pendingInvitations,
        sentPendingInvitations,
        sendInvitation,
        acceptInvitation,
        rejectInvitation,
        cancelInvitation,
    } = useBandInvitations(
        selectedBand?.id || null,
        userRole
    );

    const [isCreateModalOpen, setIsCreateModalOpen] =
        useState(false);

    const [isInviteModalOpen, setIsInviteModalOpen] =
        useState(false);

    // ============================================================
    // AppModal - Finalizar sesión
    // ============================================================
    const [
        isEndSessionModalOpen,
        setIsEndSessionModalOpen,
    ] = useState(false);

    const [
        isEndingSession,
        setIsEndingSession,
    ] = useState(false);

    // ============================================================
    // AppModal - Feedback general
    // ============================================================
    const [feedbackModal, setFeedbackModal] =
        useState<FeedbackModalState>({
            visible: false,
            type: 'info',
            title: '',
            message: '',
        });

    const showFeedbackModal = (
        type: FeedbackModalType,
        title: string,
        message: string
    ) => {
        setFeedbackModal({
            visible: true,
            type,
            title,
            message,
        });
    };

    const closeFeedbackModal = () => {
        setFeedbackModal(prev => ({
            ...prev,
            visible: false,
        }));
    };

    const currentUserId = user?.uid || user?.id;

    // ============================================================
    // Navegar a la sesión activa
    // ============================================================
    const handleGoToActiveSession = () => {
        if (!selectedBand || !activeSession) {
            return;
        }

        router.push({
            pathname: '/setlist-player/[setlistId]',
            params: {
                setlistId: activeSession.setlistId,
                bandId: selectedBand.id,
            },
        });
    };

    // ============================================================
    // Abrir modal para finalizar sesión
    // ============================================================
    const handleEndActiveSession = () => {
        if (
            !selectedBand ||
            !activeSession ||
            !isDirectorOfSession
        ) {
            return;
        }

        setIsEndSessionModalOpen(true);
    };

    // ============================================================
    // Confirmar finalización de sesión
    // ============================================================
    const handleConfirmEndSession = async () => {
        if (
            !selectedBand ||
            !activeSession ||
            !isDirectorOfSession
        ) {
            return;
        }

        try {
            setIsEndingSession(true);

            await endSession();

            setIsEndSessionModalOpen(false);
        } catch (error) {
            console.error(
                '[BandScreen] Error al finalizar sesión:',
                error
            );

            setIsEndSessionModalOpen(false);

            showFeedbackModal(
                'danger',
                'Error',
                'No se pudo finalizar la sesión. Intentá nuevamente.'
            );
        } finally {
            setIsEndingSession(false);
        }
    };

    // ============================================================
    // Seleccionar banda
    // ============================================================
    const handleSelectBand = (
        band: typeof bands[number]
    ) => {
        selectBand(band);
    };

    // ============================================================
    // Crear banda
    // ============================================================
    const handleCreateBand = async (
        name: string,
        description: string
    ) => {
        await createBand(
            name,
            description
        );
    };

    // ============================================================
    // Invitaciones
    // ============================================================
    const handleSendInvitation = async (
        email: string,
        role: 'member' | 'director'
    ) => {
        if (!selectedBand) {
            return;
        }

        await sendInvitation(
            selectedBand,
            email,
            role
        );
    };

    const handleChangeMemberRole = async (
        memberUserId: string,
        newRole: 'member' | 'director'
    ) => {
        if (!selectedBand) {
            return;
        }

        await BandService.updateMemberRole(
            selectedBand.id,
            memberUserId,
            newRole
        );
    };

    const handleRemoveMember = async (
        memberUserId: string
    ) => {
        if (!selectedBand) {
            return;
        }

        await BandService.removeMember(
            selectedBand.id,
            memberUserId
        );
    };

    // ============================================================
    // Director Mode
    // ============================================================
    const handleDirectorClick = () => {
        if (!selectedBand) {
            showFeedbackModal(
                'warning',
                'Sin banda seleccionada',
                'Seleccioná una banda para continuar.'
            );
            return;
        }

        // Seguridad adicional:
        // si existe una sesión activa, volver directamente a ella.
        if (activeSession) {
            handleGoToActiveSession();
            return;
        }

        // Si no hay sesión activa, solamente Director u Owner
        // pueden iniciar una nueva.
        if (!permissions.canCreateDirectorSession) {
            showFeedbackModal(
                'warning',
                'Acceso restringido',
                'Únicamente el Director u Owner de la banda puede iniciar Director Mode.'
            );
            return;
        }

        // Navegar al repertorio compartido de la banda.
        router.push({
            pathname: '/(tabs)/band/setlists',
            params: {
                bandId: selectedBand.id,
            },
        });
    };

    // ============================================================
    // Repertorio
    // ============================================================
    const handleRepertorioClick = () => {
        if (!selectedBand) {
            showFeedbackModal(
                'warning',
                'Sin banda seleccionada',
                'Seleccioná una banda para ver el repertorio compartido.'
            );
            return;
        }

        router.push({
            pathname: '/(tabs)/band/setlists',
            params: {
                bandId: selectedBand.id,
            },
        });
    };

    // ============================================================
    // Invitar miembros
    // ============================================================
    const handleInviteClick = () => {
        if (!permissions.canInviteMembers) {
            showFeedbackModal(
                'warning',
                'Acceso restringido',
                'No tenés permisos para invitar miembros a esta banda.'
            );
            return;
        }

        setIsInviteModalOpen(true);
    };

    // ============================================================
    // Loading
    // ============================================================
    if (loading && bands.length === 0) {
        return (
            <View
                style={[
                    styles.container,
                    styles.center,
                    { paddingTop: insets.top },
                ]}
            >
                <ActivityIndicator
                    size="large"
                    color={COLORS.accent}
                />

                <Text style={styles.loadingText}>
                    Cargando bandas...
                </Text>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top },
            ]}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <Users
                        color={COLORS.accent}
                        size={24}
                    />

                    <Text style={styles.headerTitle}>
                        Banda
                    </Text>
                </View>

                {bands.length > 0 && (
                    <TouchableOpacity
                        style={styles.addSmallBtn}
                        onPress={() =>
                            setIsCreateModalOpen(true)
                        }
                    >
                        <Plus
                            color={COLORS.foreground}
                            size={18}
                        />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingBottom:
                            insets.bottom + 100,
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Banner de Invitaciones Pendientes Recibidas */}
                <PendingInvitationsList
                    invitations={pendingInvitations}
                    onAccept={acceptInvitation}
                    onReject={rejectInvitation}
                />

                {/* ESTADO 1: USUARIO SIN BANDAS */}
                {bands.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View
                            style={styles.emptyIconCircle}
                        >
                            <Users
                                size={36}
                                color={COLORS.accent}
                            />
                        </View>

                        <Text style={styles.emptyTitle}>
                            Tu Banda
                        </Text>

                        <Text style={styles.emptySubtitle}>
                            {pendingInvitations.length > 0
                                ? 'Tenés invitaciones pendientes arriba. Aceptá una para unirte o creá tu propio grupo.'
                                : 'Todavía no pertenecés a ninguna banda. Creá tu propio grupo o unite mediante una invitación.'}
                        </Text>

                        <View style={styles.emptyActions}>
                            <TouchableOpacity
                                style={styles.primaryBtn}
                                onPress={() =>
                                    setIsCreateModalOpen(true)
                                }
                            >
                                <Plus
                                    size={18}
                                    color="#000"
                                />

                                <Text
                                    style={
                                        styles.primaryBtnText
                                    }
                                >
                                    Crear banda
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    /* ESTADO 2: USUARIO CON BANDAS */
                    <View>
                        {/* Selector de Bandas */}
                        {bands.length > 1 && (
                            <View
                                style={
                                    styles.selectorContainer
                                }
                            >
                                <Text
                                    style={
                                        styles.selectorLabel
                                    }
                                >
                                    Mis Bandas
                                </Text>

                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={
                                        false
                                    }
                                    style={
                                        styles.chipScroll
                                    }
                                >
                                    {bands.map(b => {
                                        const isSelected =
                                            selectedBand?.id ===
                                            b.id;

                                        const isLive =
                                            !!b.activeSessionId;

                                        return (
                                            <TouchableOpacity
                                                key={b.id}
                                                style={[
                                                    styles.chip,
                                                    isLive &&
                                                    styles.chipLive,
                                                    isSelected &&
                                                    styles.chipSelected,
                                                ]}
                                                onPress={() =>
                                                    handleSelectBand(
                                                        b
                                                    )
                                                }
                                            >
                                                {isLive && (
                                                    <View
                                                        style={
                                                            styles.liveDot
                                                        }
                                                    />
                                                )}

                                                <Text
                                                    style={[
                                                        styles.chipText,
                                                        isSelected &&
                                                        styles.chipTextSelected,
                                                    ]}
                                                >
                                                    {b.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        {/* Tarjeta de la Banda Seleccionada */}
                        {selectedBand && (
                            <View
                                style={styles.bandCard}
                            >
                                <View
                                    style={
                                        styles.bandHeader
                                    }
                                >
                                    <View
                                        style={
                                            styles.bandBadgeRow
                                        }
                                    >
                                        <Sparkles
                                            size={16}
                                            color={
                                                COLORS.accent
                                            }
                                        />

                                        <Text
                                            style={
                                                styles.bandBadgeText
                                            }
                                        >
                                            ROL:{' '}
                                            {userRole?.toUpperCase()}
                                        </Text>
                                    </View>

                                    <Text
                                        style={
                                            styles.bandName
                                        }
                                    >
                                        {selectedBand.name}
                                    </Text>

                                    {selectedBand.description ? (
                                        <Text
                                            style={
                                                styles.bandDesc
                                            }
                                        >
                                            {
                                                selectedBand.description
                                            }
                                        </Text>
                                    ) : null}
                                </View>

                                {/* ====================================================
                                    SESIÓN DE DIRECTOR MODE ACTIVA
                                ==================================================== */}
                                {activeSession && (
                                    <View
                                        style={
                                            styles.activeSessionCard
                                        }
                                    >
                                        <View
                                            style={
                                                styles.activeSessionHeader
                                            }
                                        >
                                            <View
                                                style={
                                                    styles.activeSessionTitleRow
                                                }
                                            >
                                                <View
                                                    style={
                                                        styles.activeSessionDot
                                                    }
                                                />

                                                <Text
                                                    style={
                                                        styles.activeSessionTitle
                                                    }
                                                >
                                                    SESIÓN ACTIVA
                                                </Text>
                                            </View>

                                            {isDirectorOfSession && (
                                                <View
                                                    style={
                                                        styles.directorBadge
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.directorBadgeText
                                                        }
                                                    >
                                                        DIRIGIENDO
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <Text
                                            style={
                                                styles.activeSessionSetlist
                                            }
                                        >
                                            {activeSession.setlistName}
                                        </Text>

                                        <Text
                                            style={
                                                styles.activeSessionDirector
                                            }
                                        >
                                            {isDirectorOfSession
                                                ? 'Estás dirigiendo este repertorio'
                                                : `${activeSession.directorName} está dirigiendo`}
                                        </Text>

                                        {/* Volver a la sesión */}
                                        <TouchableOpacity
                                            style={
                                                styles.activeSessionButton
                                            }
                                            onPress={
                                                handleGoToActiveSession
                                            }
                                        >
                                            <Radio
                                                size={18}
                                                color="#000"
                                            />

                                            <Text
                                                style={
                                                    styles.activeSessionButtonText
                                                }
                                            >
                                                Volver a la sesión
                                            </Text>

                                            <ChevronRight
                                                size={18}
                                                color="#000"
                                            />
                                        </TouchableOpacity>

                                        {/* Finalizar sesión */}
                                        {isDirectorOfSession && (
                                            <TouchableOpacity
                                                style={
                                                    styles.endSessionButton
                                                }
                                                onPress={
                                                    handleEndActiveSession
                                                }
                                                disabled={
                                                    isEndingSession
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.endSessionButtonText
                                                    }
                                                >
                                                    Finalizar sesión
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                {/* Secciones de Funcionalidades */}
                                <View
                                    style={
                                        styles.actionsGrid
                                    }
                                >
                                    {/* ====================================================
                                        Director Mode

                                        Solo se muestra cuando NO hay una sesión activa.
                                    ==================================================== */}
                                    {!activeSession && (
                                        <TouchableOpacity
                                            style={[
                                                styles.actionCard,
                                                permissions.canCreateDirectorSession
                                                    ? styles.actionCardActive
                                                    : styles.actionCardDisabled,
                                            ]}
                                            onPress={
                                                handleDirectorClick
                                            }
                                        >
                                            <View
                                                style={
                                                    styles.actionIconCircle
                                                }
                                            >
                                                <Radio
                                                    size={20}
                                                    color={
                                                        permissions.canCreateDirectorSession
                                                            ? COLORS.accent
                                                            : COLORS.mutedForeground
                                                    }
                                                />
                                            </View>

                                            <View
                                                style={
                                                    styles.actionInfo
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.actionTitle
                                                    }
                                                >
                                                    Director Mode
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.actionSubtitle
                                                    }
                                                >
                                                    {permissions.canCreateDirectorSession
                                                        ? 'Iniciar o controlar sesión'
                                                        : 'Solo Director u Owner'}
                                                </Text>
                                            </View>

                                            <ChevronRight
                                                size={18}
                                                color={
                                                    COLORS.mutedForeground
                                                }
                                            />
                                        </TouchableOpacity>
                                    )}

                                    {/* Repertorio */}
                                    <TouchableOpacity
                                        style={
                                            styles.actionCard
                                        }
                                        onPress={
                                            handleRepertorioClick
                                        }
                                    >
                                        <View
                                            style={
                                                styles.actionIconCircle
                                            }
                                        >
                                            <ListMusic
                                                size={20}
                                                color="#3b82f6"
                                            />
                                        </View>

                                        <View
                                            style={
                                                styles.actionInfo
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.actionTitle
                                                }
                                            >
                                                Repertorio Compartido
                                            </Text>

                                            <Text
                                                style={
                                                    styles.actionSubtitle
                                                }
                                            >
                                                Listas de la banda
                                            </Text>
                                        </View>

                                        <ChevronRight
                                            size={18}
                                            color={
                                                COLORS.mutedForeground
                                            }
                                        />
                                    </TouchableOpacity>

                                    {/* Invitar Miembros */}
                                    {permissions.canInviteMembers && (
                                        <TouchableOpacity
                                            style={
                                                styles.actionCard
                                            }
                                            onPress={
                                                handleInviteClick
                                            }
                                        >
                                            <View
                                                style={
                                                    styles.actionIconCircle
                                                }
                                            >
                                                <UserPlus
                                                    size={20}
                                                    color="#10b981"
                                                />
                                            </View>

                                            <View
                                                style={
                                                    styles.actionInfo
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.actionTitle
                                                    }
                                                >
                                                    Invitar Miembro
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.actionSubtitle
                                                    }
                                                >
                                                    {userRole ===
                                                        'owner'
                                                        ? 'Invitar miembros o directores'
                                                        : 'Invitar miembros'}
                                                </Text>
                                            </View>

                                            <ChevronRight
                                                size={18}
                                                color={
                                                    COLORS.mutedForeground
                                                }
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Lista de Miembros */}
                                <BandMemberList
                                    members={members}
                                    currentUserId={
                                        currentUserId
                                    }
                                    canChangeRole={
                                        permissions.canChangeMemberRole
                                    }
                                    canRemoveMember={
                                        permissions.canRemoveMembers
                                    }
                                    onChangeRole={
                                        handleChangeMemberRole
                                    }
                                    onRemoveMember={
                                        handleRemoveMember
                                    }
                                />

                                {permissions.canInviteMembers && (
                                    <SentInvitationsList
                                        invitations={
                                            sentPendingInvitations
                                        }
                                        onCancel={
                                            cancelInvitation
                                        }
                                    />
                                )}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* ============================================================
                AppModal - Finalizar sesión
            ============================================================ */}
            <AppModal
                visible={isEndSessionModalOpen}
                type="danger"
                title="Finalizar sesión"
                message={
                    activeSession
                        ? `¿Querés finalizar la sesión de "${activeSession.setlistName}"?`
                        : ''
                }
                confirmText="Finalizar"
                cancelText="Cancelar"
                onCancel={() =>
                    setIsEndSessionModalOpen(false)
                }
                onConfirm={handleConfirmEndSession}
                loading={isEndingSession}
            />

            {/* ============================================================
                AppModal - Feedback general
            ============================================================ */}
            <AppModal
                visible={feedbackModal.visible}
                type={feedbackModal.type}
                title={feedbackModal.title}
                message={feedbackModal.message}
                confirmText="Aceptar"
                onConfirm={closeFeedbackModal}
            />

            {/* Modal para Crear Banda */}
            <CreateBandModal
                visible={isCreateModalOpen}
                onClose={() =>
                    setIsCreateModalOpen(false)
                }
                onCreate={handleCreateBand}
            />

            {/* Modal para Invitar Miembros */}
            <InviteMemberModal
                visible={isInviteModalOpen}
                onClose={() =>
                    setIsInviteModalOpen(false)
                }
                onInvite={handleSendInvitation}
                canInviteDirector={
                    userRole === 'owner'
                }
                folderId={driveFolderId}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: COLORS.mutedForeground,
        fontSize: 14,
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
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        color: COLORS.foreground,
        fontSize: 22,
        fontWeight: '800',
    },
    addSmallBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
    },
    emptyCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginTop: 20,
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        color: COLORS.foreground,
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: COLORS.mutedForeground,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    emptyActions: {
        width: '100%',
        gap: 12,
    },
    primaryBtn: {
        backgroundColor: COLORS.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
    },
    primaryBtnText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
    },
    secondaryBtnText: {
        color: COLORS.foreground,
        fontSize: 15,
        fontWeight: '600',
    },
    selectorContainer: {
        marginBottom: 16,
    },
    selectorLabel: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    chipScroll: {
        flexDirection: 'row',
    },
    chip: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
    },
    chipLive: {
        borderColor: COLORS.accent,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#ef4444',
        marginRight: 6,
    },
    chipSelected: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    chipText: {
        color: COLORS.mutedForeground,
        fontSize: 13,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: '#000',
        fontWeight: '700',
    },
    bandCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    bandHeader: {
        marginBottom: 20,
    },
    bandBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    bandBadgeText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    bandName: {
        color: COLORS.foreground,
        fontSize: 24,
        fontWeight: '800',
    },
    bandDesc: {
        color: COLORS.mutedForeground,
        fontSize: 14,
        marginTop: 4,
    },

    // ============================================================
    // Sesión activa
    // ============================================================
    activeSessionCard: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.35)',
    },
    activeSessionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    activeSessionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    activeSessionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },
    activeSessionTitle: {
        color: '#ef4444',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.7,
    },
    directorBadge: {
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    directorBadgeText: {
        color: COLORS.accent,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    activeSessionSetlist: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    activeSessionDirector: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginBottom: 14,
    },
    activeSessionButton: {
        backgroundColor: COLORS.accent,
        borderRadius: 12,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    activeSessionButtonText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '800',
    },
    endSessionButton: {
        marginTop: 8,
        minHeight: 40,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.4)',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    endSessionButtonText: {
        color: '#ef4444',
        fontSize: 13,
        fontWeight: '700',
    },

    // ============================================================
    // Acciones
    // ============================================================
    actionsGrid: {
        gap: 10,
        marginBottom: 20,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    actionCardActive: {
        borderColor: 'rgba(234, 179, 8, 0.3)',
    },
    actionCardDisabled: {
        opacity: 0.6,
    },
    actionIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    actionInfo: {
        flex: 1,
    },
    actionTitle: {
        color: COLORS.foreground,
        fontSize: 15,
        fontWeight: '700',
    },
    actionSubtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 2,
    },
});
