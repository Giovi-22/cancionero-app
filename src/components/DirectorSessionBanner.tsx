/**
 * DirectorSessionBanner
 *
 * Banner global súper compacto para la nueva arquitectura Director Mode.
 *
 * Características:
 * - Una sola línea ultracompacta.
 * - SIN opción de descartar/dismiss (permanece visible mientras la sesión esté activa).
 * - Muestra "Volver" a la sesión activa en el SetlistPlayer.
 * - Para directores: incluye botón "Finalizar" con confirmación.
 * - Para followers: muestra quién está dirigiendo y el repertorio actual.
 *
 * Fuente de verdad: Firestore (bands/{bandId}/sessions/{sessionId})
 * via useDirectorSession.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Radio, ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../constants/theme';
import { useDirectorSession } from '../hooks/useDirectorSession';
import { useAppContext } from '../context/AppContext';
import AppModal from './common/AppModal';


function DirectorSessionBannerInner({ bandId }: { bandId: string }) {
    const {
        activeSession,
        isDirectorOfSession,
        endSession,
        loading,
    } = useDirectorSession(bandId);

    const [isEnding, setIsEnding] = useState(false);

    const [isEndSessionModalVisible, setIsEndSessionModalVisible] =
        useState(false);

    const [errorModal, setErrorModal] = useState<{
        visible: boolean;
        message: string;
    }>({
        visible: false,
        message: '',
    });

    const insets = useSafeAreaInsets();

    if (loading || !activeSession) {
        return null;
    }

    /**
     * Fondo del banner que también ocupa el área
     * detrás del StatusBar transparente/translúcido.
     */
    const bannerBackground = isDirectorOfSession
        ? styles.barDirector
        : styles.barFollower;

    /**
     * Navega de regreso al reproductor con el repertorio
     * y la banda activa.
     */
    const handleReturnToSession = () => {
        router.push({
            pathname: '/setlist-player/[setlistId]',
            params: {
                setlistId: activeSession.setlistId,
                bandId: activeSession.bandId,
            },
        } as any);
    };

    /**
     * Abre la confirmación para finalizar la sesión.
     */
    const handleEndSession = () => {
        if (isEnding) {
            return;
        }

        setIsEndSessionModalVisible(true);
    };

    /**
     * Cancela la finalización de la sesión.
     */
    const handleCancelEndSession = () => {
        if (isEnding) {
            return;
        }

        setIsEndSessionModalVisible(false);
    };

    /**
     * Confirma y finaliza la sesión activa.
     */
    const handleConfirmEndSession = async () => {
        if (isEnding) {
            return;
        }

        setIsEnding(true);

        try {
            await endSession();

            setIsEndSessionModalVisible(false);
        } catch (err: any) {
            setIsEndSessionModalVisible(false);

            setErrorModal({
                visible: true,
                message:
                    err?.message ||
                    'No se pudo finalizar la sesión.',
            });
        } finally {
            setIsEnding(false);
        }
    };

    /**
     * Cierra el modal de error.
     */
    const handleCloseError = () => {
        setErrorModal({
            visible: false,
            message: '',
        });
    };

    return (
        <>
            <View
                style={[
                    styles.container,
                    bannerBackground,
                    {
                        paddingTop: insets.top,
                    },
                ]}
            >
                <View style={styles.bar}>
                    {/* Indicador en vivo y texto */}
                    <TouchableOpacity
                        style={styles.infoRow}
                        onPress={handleReturnToSession}
                        activeOpacity={0.8}
                    >
                        <View style={styles.liveBadge}>
                            <View style={styles.redDot} />

                            <Radio
                                size={12}
                                color="#fff"
                            />
                        </View>

                        <Text
                            style={styles.sessionText}
                            numberOfLines={1}
                        >
                            {isDirectorOfSession ? (
                                <>
                                    <Text style={styles.boldText}>
                                        Director Mode
                                    </Text>

                                    <Text style={styles.dimText}>
                                        {' · '}
                                    </Text>

                                    {activeSession.setlistName}
                                </>
                            ) : (
                                <>
                                    <Text style={styles.boldText}>
                                        {activeSession.directorName}
                                    </Text>

                                    <Text style={styles.dimText}>
                                        {' está dirigiendo · '}
                                    </Text>

                                    {activeSession.setlistName}
                                </>
                            )}
                        </Text>
                    </TouchableOpacity>

                    {/* Acciones compactas a la derecha */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.returnBtn}
                            onPress={handleReturnToSession}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.returnBtnText}>
                                Volver
                            </Text>

                            <ArrowRight
                                size={11}
                                color="#fff"
                            />
                        </TouchableOpacity>

                        {isDirectorOfSession && (
                            <TouchableOpacity
                                style={styles.endBtn}
                                onPress={handleEndSession}
                                disabled={isEnding}
                                activeOpacity={0.8}
                            >
                                {isEnding ? (
                                    <ActivityIndicator
                                        size={10}
                                        color="#fca5a5"
                                    />
                                ) : (
                                    <Text style={styles.endBtnText}>
                                        Finalizar
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* Confirmación para finalizar Director Mode */}
            <AppModal
                visible={isEndSessionModalVisible}
                type="danger"
                title="Finalizar Director Mode"
                message="¿Querés finalizar la sesión? Los miembros seguidores dejarán de recibir la sincronización."
                confirmText="Finalizar"
                cancelText="Cancelar"
                onConfirm={handleConfirmEndSession}
                onCancel={handleCancelEndSession}
                loading={isEnding}
                dismissOnBackdrop={false}
            />

            {/* Error al finalizar */}
            <AppModal
                visible={errorModal.visible}
                type="danger"
                title="Error"
                message={errorModal.message}
                confirmText="Aceptar"
                onConfirm={handleCloseError}
                dismissOnBackdrop={false}
            />
        </>
    );
}

export const DirectorSessionBanner = () => {
    const { activeBandId } = useAppContext();

    if (!activeBandId) {
        return null;
    }

    return (
        <DirectorSessionBannerInner
            bandId={activeBandId}
        />
    );
};

const styles = StyleSheet.create({
    /**
     * Este contenedor ocupa también el área del StatusBar.
     * El fondo del banner continúa detrás de los elementos
     * del sistema, evitando una franja visual.
     */
    container: {
        width: '100%',
    },

    /**
     * Altura real del contenido del banner.
     * El paddingTop del inset se agrega en el container,
     * no acá.
     */
    bar: {
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },

    barDirector: {
        backgroundColor: '#1e1b4b',
    },

    barFollower: {
        backgroundColor: '#2e1065',
    },

    infoRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginRight: 8,
    },

    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },

    redDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
    },

    sessionText: {
        color: '#f4f4f5',
        fontSize: 12,
        flex: 1,
    },

    boldText: {
        fontWeight: '700',
        color: '#ffffff',
    },

    dimText: {
        color: 'rgba(255, 255, 255, 0.6)',
    },

    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    returnBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: COLORS.accent,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 5,
    },

    returnBtnText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
    },

    endBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgba(239, 68, 68, 0.4)',
        borderWidth: 1,
        paddingVertical: 3,
        paddingHorizontal: 7,
        borderRadius: 5,
    },

    endBtnText: {
        color: '#fca5a5',
        fontSize: 11,
        fontWeight: '600',
    },
});
