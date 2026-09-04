import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
} from 'react-native';
import { CreateBandSetlistModal } from '../../../../src/components/band/CreateBandSetlistModal';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBands } from '../../../../src/hooks/useBands';
import { BandSetlistList } from '../../../../src/components/band/BandSetlistList';
import { BandSetlist } from '../../../../src/types/band';
import { COLORS } from '../../../../src/constants/theme';
import { useBandSetlists } from '../../../../src/hooks/useBandSetlists';
import { useAppContext } from '../../../../src/context/AppContext';
import { useDirectorSession } from '../../../../src/hooks/useDirectorSession';
import { BandSetlistService } from '../../../../src/services/BandSetlistService';
import AppModal from '../../../../src/components/common/AppModal';

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

export default function BandSetlistsScreen() {
    const [isCreateModalOpen, setIsCreateModalOpen] =
        useState(false);

    const [deletingSetlistId, setDeletingSetlistId] =
        useState<string | null>(null);

    // ============================================================
    // AppModal - Eliminar repertorio
    // ============================================================
    const [
        setlistToDelete,
        setSetlistToDelete,
    ] = useState<BandSetlist | null>(null);

    const [isDeletingSetlist, setIsDeletingSetlist] =
        useState(false);

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

    const insets = useSafeAreaInsets();

    const { activeBandId } = useAppContext();

    const { activeSession } =
        useDirectorSession(activeBandId);

    const {
        userBandsInfo,
    } = useBands();

    // La banda activa y su rol salen de la misma entrada.
    const activeBandInfo =
        userBandsInfo.find(
            info => info.band.id === activeBandId
        ) || null;

    const activeBand =
        activeBandInfo?.band || null;

    const activeBandRole =
        activeBandInfo?.role || null;

    const {
        setlists,
        loading,
        error,
        createSetlist,
    } = useBandSetlists(activeBandId);

    // Owner y Director pueden administrar repertorios.
    const canManageSetlists =
        activeBandRole === 'owner' ||
        activeBandRole === 'director';

    const canDeleteSetlist = canManageSetlists;
    const canCreateSetlist = canManageSetlists;

    // ============================================================
    // Feedback modal helpers
    // ============================================================
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

    // ============================================================
    // Seleccionar repertorio
    // ============================================================
    const handleSelectSetlist = (
        setlist: BandSetlist
    ) => {
        router.push({
            pathname: '/(tabs)/band/setlists/[id]',
            params: {
                id: setlist.id,
            },
        });
    };

    // ============================================================
    // Crear repertorio
    // ============================================================
    const handleCreateSetlist = () => {
        if (!canCreateSetlist) {
            return;
        }

        setIsCreateModalOpen(true);
    };

    const handleCreate = async (name: string) => {
        if (!canCreateSetlist) {
            return;
        }

        await createSetlist(name);
        setIsCreateModalOpen(false);
    };

    // ============================================================
    // Solicitar eliminación de repertorio
    // ============================================================
    const handleDeleteSetlist = (
        setlist: BandSetlist
    ) => {
        if (!canDeleteSetlist) {
            return;
        }

        // Por seguridad, no permitimos eliminar desde acá
        // un repertorio que tiene una sesión activa.
        if (activeSession?.setlistId === setlist.id) {
            showFeedbackModal(
                'warning',
                'Repertorio en vivo',
                'Este repertorio está siendo reproducido actualmente. Finalizá la sesión de Director Mode antes de eliminarlo.'
            );
            return;
        }

        setSetlistToDelete(setlist);
    };

    // ============================================================
    // Confirmar eliminación de repertorio
    // ============================================================
    const handleConfirmDeleteSetlist = async () => {
        if (!setlistToDelete) {
            return;
        }

        if (!activeBandId) {
            setSetlistToDelete(null);

            showFeedbackModal(
                'danger',
                'Error',
                'No hay una banda seleccionada.'
            );

            return;
        }

        try {
            setIsDeletingSetlist(true);
            setDeletingSetlistId(
                setlistToDelete.id
            );

            await BandSetlistService.deleteBandSetlist(
                activeBandId,
                setlistToDelete.id
            );

            setSetlistToDelete(null);
        } catch (err) {
            console.error(
                '[BandSetlistsScreen] Error eliminando repertorio:',
                err
            );

            setSetlistToDelete(null);

            showFeedbackModal(
                'danger',
                'Error',
                'No se pudo eliminar el repertorio. Intentá nuevamente.'
            );
        } finally {
            setIsDeletingSetlist(false);
            setDeletingSetlistId(null);
        }
    };

    // ============================================================
    // Volver
    // ============================================================
    const handleGoBack = () => {
        router.back();
    };

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top },
            ]}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    activeOpacity={0.7}
                    onPress={handleGoBack}
                >
                    <ChevronLeft
                        size={24}
                        color={COLORS.foreground}
                    />
                </TouchableOpacity>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>
                        Repertorio de la banda
                    </Text>

                    {activeBand && (
                        <Text
                            style={styles.headerSubtitle}
                            numberOfLines={1}
                        >
                            {activeBand.name}
                        </Text>
                    )}
                </View>

                <View style={styles.headerSpacer} />
            </View>

            {/* Lista de repertorios */}
            <BandSetlistList
                bandId={activeBandId}
                setlists={setlists}
                loading={loading}
                error={error}
                activeSession={activeSession}
                onSelectSetlist={handleSelectSetlist}
                onCreateSetlist={
                    canCreateSetlist
                        ? handleCreateSetlist
                        : undefined
                }
                canDeleteSetlist={canDeleteSetlist}
                onDeleteSetlist={
                    canDeleteSetlist
                        ? handleDeleteSetlist
                        : undefined
                }
                deletingSetlistId={deletingSetlistId}
            />

            {/* ====================================================
                AppModal - Eliminar repertorio
            ==================================================== */}
            <AppModal
                visible={!!setlistToDelete}
                type="danger"
                title="Eliminar repertorio"
                message={
                    setlistToDelete
                        ? `¿Seguro que querés eliminar "${setlistToDelete.name}"?\n\nEsta acción no se puede deshacer.`
                        : ''
                }
                confirmText="Eliminar"
                cancelText="Cancelar"
                onCancel={() =>
                    setSetlistToDelete(null)
                }
                onConfirm={
                    handleConfirmDeleteSetlist
                }
                loading={isDeletingSetlist}
            />

            {/* ====================================================
                AppModal - Feedback general
            ==================================================== */}
            <AppModal
                visible={feedbackModal.visible}
                type={feedbackModal.type}
                title={feedbackModal.title}
                message={feedbackModal.message}
                confirmText="Aceptar"
                onConfirm={closeFeedbackModal}
            />

            {/* Crear repertorio */}
            {canCreateSetlist && (
                <CreateBandSetlistModal
                    visible={isCreateModalOpen}
                    onClose={() =>
                        setIsCreateModalOpen(false)
                    }
                    onCreate={handleCreate}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },

    headerTitleContainer: {
        flex: 1,
        marginLeft: 12,
    },

    headerTitle: {
        color: COLORS.foreground,
        fontSize: 18,
        fontWeight: '700',
    },

    headerSubtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 2,
    },

    headerSpacer: {
        width: 40,
        marginLeft: 12,
    },
});