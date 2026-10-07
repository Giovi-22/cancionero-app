import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SlidersHorizontal, X, AlertCircle, CheckCircle2 } from 'lucide-react-native';

import { usePedal } from '../../hooks/usePedal';
import { COLORS } from '../../constants/theme';

export const PedalDiscoveryCard: React.FC = () => {
    const {
        connected,
        connecting,
        discovering,
        device,
        discover,
        connect,
        disconnect,
        onDeviceChange,
    } = usePedal();

    const [isDismissed, setIsDismissed] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);

    // Iniciar descubrimiento pasivo UDP :4444 al montar si no está conectado ni buscando
    useEffect(() => {
        if (!connected && !discovering && !device) {
            discover().catch(() => {
                // Discovery silencioso en segundo plano
            });
        }
    }, [connected, discovering, device, discover]);

    // Cuando el pedal vuelve a anunciarse por UDP, reactivar la card si estaba descartada
    useEffect(() => {
        const unsubscribe = onDeviceChange(newDevice => {
            if (newDevice) {
                setIsDismissed(false);
                setConnectError(null);
            }
        });
        return unsubscribe;
    }, [onDeviceChange]);

    // Si no hay pedal descubierto ni conectado, o si el usuario la descartó (y no está conectado)
    if (!connected && (!device || isDismissed)) {
        return null;
    }

    const handleConnect = async () => {
        if (!device || connecting) return;
        setConnectError(null);
        try {
            await connect(device);
        } catch (err: any) {
            setConnectError(
                err?.message || 'No se pudo conectar al pedal.'
            );
        }
    };

    const handleDisconnect = () => {
        disconnect();
        setConnectError(null);
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        setConnectError(null);
    };

    // ─────────────────────────────────────────────
    // Estado: Conectado
    // ─────────────────────────────────────────────
    if (connected) {
        return (
            <View style={[styles.card, styles.cardConnected]}>
                <View style={styles.header}>
                    <View style={styles.iconContainerConnected}>
                        <CheckCircle2 size={20} color="#22c55e" />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={styles.title}>
                            Pedal Cancionero conectado
                        </Text>
                        <Text style={styles.subtitle}>
                            Listo para usar
                        </Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.disconnectButton}
                        onPress={handleDisconnect}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.disconnectButtonText}>
                            Desconectar
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ─────────────────────────────────────────────
    // Estado: Error de conexión
    // ─────────────────────────────────────────────
    if (connectError) {
        return (
            <View style={[styles.card, styles.cardError]}>
                <View style={styles.header}>
                    <View style={styles.iconContainerError}>
                        <AlertCircle size={20} color="#ef4444" />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={styles.title}>
                            No se pudo conectar al pedal
                        </Text>
                        <Text style={styles.subtitleError}>
                            {connectError}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleDismiss}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={18} color={COLORS.mutedForeground} />
                    </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.connectButton}
                        onPress={handleConnect}
                        disabled={connecting}
                        activeOpacity={0.8}
                    >
                        {connecting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={styles.connectButtonText}>
                                Reintentar
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ─────────────────────────────────────────────
    // Estado: Pedal descubierto (Disponible para conectar)
    // ─────────────────────────────────────────────
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.iconContainerDiscovered}>
                    <SlidersHorizontal size={20} color={COLORS.accent} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>
                        🎛️ Pedal Cancionero encontrado
                    </Text>
                    <Text style={styles.subtitle}>
                        Disponible en esta red
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleDismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <X size={18} color={COLORS.mutedForeground} />
                </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[
                        styles.connectButton,
                        connecting && styles.connectButtonDisabled,
                    ]}
                    onPress={handleConnect}
                    disabled={connecting}
                    activeOpacity={0.8}
                >
                    {connecting ? (
                        <>
                            <ActivityIndicator size="small" color="#ffffff" />
                            <Text style={styles.connectButtonText}>
                                Conectando...
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.connectButtonText}>
                            Conectar
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#18181b',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#3b82f640',
        padding: 14,
        marginBottom: 16,
    },
    cardConnected: {
        borderColor: '#22c55e40',
    },
    cardError: {
        borderColor: '#ef444440',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainerDiscovered: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    iconContainerConnected: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    iconContainerError: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.foreground,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.mutedForeground,
        marginTop: 2,
    },
    subtitleError: {
        fontSize: 12,
        color: '#f87171',
        marginTop: 2,
    },
    closeButton: {
        padding: 4,
        marginLeft: 8,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 10,
    },
    connectButton: {
        backgroundColor: COLORS.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
        minWidth: 100,
    },
    connectButtonDisabled: {
        opacity: 0.6,
    },
    connectButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    disconnectButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    disconnectButtonText: {
        color: '#ef4444',
        fontSize: 13,
        fontWeight: '600',
    },
});
