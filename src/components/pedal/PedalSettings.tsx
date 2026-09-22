import React, { useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SlidersHorizontal, Search, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react-native';

import { usePedal } from '../../hooks/usePedal';
import { COLORS } from '../../constants/theme';

export const PedalSettings: React.FC = () => {
    const {
        connected,
        connecting,
        discovering,
        device,
        discover,
        connect,
        disconnect,
    } = usePedal();

    const [connectError, setConnectError] = useState<string | null>(null);

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

    const handleDiscover = async () => {
        if (discovering) return;
        setConnectError(null);
        try {
            await discover();
        } catch {
            // Silencioso
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View
                    style={[
                        styles.iconContainer,
                        connected
                            ? styles.iconConnected
                            : device
                            ? styles.iconDiscovered
                            : styles.iconIdle,
                    ]}
                >
                    {connected ? (
                        <CheckCircle2 size={21} color="#22c55e" />
                    ) : (
                        <SlidersHorizontal
                            size={21}
                            color={device ? COLORS.accent : COLORS.mutedForeground}
                        />
                    )}
                </View>

                <View style={styles.content}>
                    <Text style={styles.title}>Pedal Cancionero</Text>
                    <Text
                        style={[
                            styles.subtitle,
                            connected && styles.subtitleConnected,
                        ]}
                    >
                        {connected
                            ? '🟢 Conectado y listo para usar'
                            : device
                            ? 'Disponible en esta red'
                            : discovering
                            ? 'Buscando pedal en la red...'
                            : 'No hay pedales disponibles.'}
                    </Text>
                    {connectError && (
                        <View style={styles.errorContainer}>
                            <AlertCircle size={14} color="#ef4444" />
                            <Text style={styles.errorText}>
                                {connectError}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.actions}>
                {connected ? (
                    <TouchableOpacity
                        style={styles.disconnectButton}
                        onPress={handleDisconnect}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.disconnectButtonText}>
                            Desconectar
                        </Text>
                    </TouchableOpacity>
                ) : device ? (
                    <TouchableOpacity
                        style={[
                            styles.connectButton,
                            connecting && styles.buttonDisabled,
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
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.discoverButton,
                            discovering && styles.buttonDisabled,
                        ]}
                        onPress={handleDiscover}
                        disabled={discovering}
                        activeOpacity={0.8}
                    >
                        {discovering ? (
                            <>
                                <ActivityIndicator size="small" color={COLORS.accent} />
                                <Text style={styles.discoverButtonText}>
                                    Buscando pedal...
                                </Text>
                            </>
                        ) : (
                            <>
                                <Search size={15} color={COLORS.accent} />
                                <Text style={styles.discoverButtonText}>
                                    Buscar pedal
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 42,
        height: 42,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    iconConnected: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
    },
    iconDiscovered: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
    },
    iconIdle: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    content: {
        flex: 1,
    },
    title: {
        color: COLORS.foreground,
        fontSize: 15,
        fontWeight: '600',
    },
    subtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 3,
    },
    subtitleConnected: {
        color: '#22c55e',
        fontWeight: '500',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 11,
    },
    actions: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    connectButton: {
        backgroundColor: COLORS.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    connectButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    disconnectButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        paddingVertical: 8,
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
    discoverButton: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    discoverButtonText: {
        color: COLORS.accent,
        fontSize: 13,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});
