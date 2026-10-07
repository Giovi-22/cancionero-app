import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { usePedal } from '../../../../../src/hooks/usePedal';

interface ReceivedMessage {
    id: string;
    message: string;
    timestamp: string;
    protocol: 'TCP';
}

export default function UdpTestScreen() {
    const {
        connected,
        connecting,
        discovering,
        device,
        lastEvent,
        discover,
        connect,
        disconnect,
    } = usePedal();

    const [messages, setMessages] =
        useState<ReceivedMessage[]>([]);

    const [discoveryError, setDiscoveryError] =
        useState<string | null>(null);

    const [connectError, setConnectError] =
        useState<string | null>(null);

    // ========================================================
    // Agregar mensaje al log
    // ========================================================

    const addMessage = useCallback(
        (message: string) => {
            const receivedMessage: ReceivedMessage = {
                id: `${Date.now()}-${Math.random()}`,
                message,
                timestamp:
                    new Date().toLocaleTimeString(),
                protocol: 'TCP',
            };

            setMessages((current) =>
                [receivedMessage, ...current].slice(0, 100),
            );
        },
        [],
    );

    // ========================================================
    // Discovery — escucha pasiva UDP :4444
    // NUNCA conecta automáticamente
    // ========================================================

    const startDiscover = useCallback(
        async () => {
            setDiscoveryError(null);
            const found = await discover();
            if (!found) {
                setDiscoveryError(
                    'No se encontró el pedal en la red. Verificá que esté encendido y en modo WiFi.'
                );
            }
        },
        [discover],
    );

    // ========================================================
    // Conexión TCP — solo cuando el usuario lo pide
    // ========================================================

    const connectPedal = useCallback(
        async () => {
            if (connected || connecting || !device) {
                return;
            }

            setConnectError(null);

            try {
                await connect(device);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo conectar al pedal.';

                console.error(
                    '[PedalTest] Error conectando:',
                    error,
                );

                setConnectError(message);
            }
        },
        [
            connected,
            connecting,
            device,
            connect,
        ],
    );

    // ========================================================
    // Eventos del pedal
    // ========================================================

    useEffect(() => {
        if (!lastEvent) {
            return;
        }

        addMessage(`[${lastEvent.source.toUpperCase()}] ${lastEvent.type}`);
    }, [
        lastEvent,
        addMessage,
    ]);

    // ========================================================
    // Discovery al entrar (pasivo, NO conecta)
    // ========================================================

    useEffect(() => {
        startDiscover();

        return () => {
            disconnect();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ========================================================
    // Estados visuales
    // ========================================================

    const discoveryStatusText = useMemo(() => {
        if (device) {
            return 'Pedal descubierto';
        }

        if (discovering) {
            return 'Buscando pedal...';
        }

        if (discoveryError) {
            return 'Error';
        }

        return 'Sin discovery';
    }, [
        device,
        discovering,
        discoveryError,
    ]);

    const discoveryStatusColor =
        device
            ? '#22c55e'
            : discoveryError
                ? '#ef4444'
                : '#f59e0b';

    const tcpStatusText = useMemo(() => {
        if (connected) {
            return 'Conectado';
        }

        if (connecting) {
            return 'Conectando...';
        }

        return 'Desconectado';
    }, [
        connected,
        connecting,
    ]);

    const tcpStatusColor =
        connected
            ? '#22c55e'
            : '#f59e0b';

    // ========================================================
    // Limpiar mensajes
    // ========================================================

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    // ========================================================
    // Render
    // ========================================================

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={
                styles.contentContainer
            }
            showsVerticalScrollIndicator={true}
        >
            <View style={styles.header}>
                <Text style={styles.title}>
                    Pedal Communication Test
                </Text>

                <Text style={styles.subtitle}>
                    Prueba de comunicación con el pedal ESP32
                </Text>
            </View>

            {/* =================================================
                UDP DISCOVERY
            ================================================= */}

            <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>
                    UDP Discovery
                </Text>
            </View>

            <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <Text style={styles.label}>
                        Estado
                    </Text>

                    <View style={styles.statusContainer}>
                        {discovering ? (
                            <ActivityIndicator
                                size="small"
                            />
                        ) : null}

                        <Text
                            style={[
                                styles.status,
                                {
                                    color:
                                        discoveryStatusColor,
                                },
                            ]}
                        >
                            {discoveryStatusText}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.label}>
                        Puerto UDP
                    </Text>

                    <Text style={styles.value}>
                        4444
                    </Text>
                </View>

                <View style={styles.separator} />

                <View style={styles.infoRow}>
                    <Text style={styles.label}>
                        Pedal descubierto
                    </Text>

                    <Text
                        style={[
                            styles.value,
                            !device &&
                            styles.mutedValue,
                        ]}
                    >
                        {device
                            ? `${device.ip}:${device.port}`
                            : 'Esperando...'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.connectButton,
                        discovering && styles.connectButtonDisabled,
                    ]}
                    onPress={startDiscover}
                    disabled={discovering}
                >
                    {discovering ? (
                        <ActivityIndicator size="small" />
                    ) : (
                        <Text style={styles.connectButtonText}>
                            Buscar pedal (UDP)
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {discoveryError ? (
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>
                        Sin respuesta
                    </Text>

                    <Text style={styles.errorText}>
                        {discoveryError}
                    </Text>
                </View>
            ) : null}

            {/* =================================================
                TCP
            ================================================= */}

            <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>
                    TCP Socket
                </Text>
            </View>

            <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <Text style={styles.label}>
                        Estado
                    </Text>

                    <View style={styles.statusContainer}>
                        {connecting ? (
                            <ActivityIndicator
                                size="small"
                            />
                        ) : null}

                        <Text
                            style={[
                                styles.status,
                                {
                                    color:
                                        tcpStatusColor,
                                },
                            ]}
                        >
                            {tcpStatusText}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.label}>
                        Pedal
                    </Text>

                    <Text
                        style={[
                            styles.value,
                            !device &&
                            styles.mutedValue,
                        ]}
                    >
                        {device
                            ? `${device.ip}:${device.port}`
                            : '---'}
                    </Text>
                </View>

                {connected ? (
                    <TouchableOpacity
                        style={
                            styles.disconnectButton
                        }
                        onPress={disconnect}
                    >
                        <Text
                            style={
                                styles.disconnectButtonText
                            }
                        >
                            Desconectar TCP
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.connectButton,
                            (!device || connecting) && styles.connectButtonDisabled,
                        ]}
                        onPress={connectPedal}
                        disabled={!device || connecting}
                    >
                        {connecting ? (
                            <ActivityIndicator
                                size="small"
                            />
                        ) : (
                            <Text
                                style={
                                    styles.connectButtonText
                                }
                            >
                                {device ? 'Conectar TCP' : 'Buscá el pedal primero'}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {connectError ? (
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>
                        Error de conexión TCP
                    </Text>

                    <Text style={styles.errorText}>
                        {connectError}
                    </Text>
                </View>
            ) : null}

            {/* =================================================
                EVENTS
            ================================================= */}

            <View style={styles.messagesHeader}>
                <Text style={styles.messagesTitle}>
                    Eventos recibidos ({messages.length})
                </Text>

                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={clearMessages}
                >
                    <Text
                        style={
                            styles.clearButtonText
                        }
                    >
                        Limpiar
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.messagesContainer}>
                <ScrollView
                    style={styles.messagesList}
                    nestedScrollEnabled={true}
                    contentContainerStyle={
                        messages.length === 0
                            ? styles.emptyContainer
                            : styles.messagesContent
                    }
                    showsVerticalScrollIndicator={true}
                >
                    {messages.length === 0 ? (
                        <Text style={styles.emptyText}>
                            Esperando discovery UDP y
                            eventos TCP del ESP32...
                        </Text>
                    ) : (
                        messages.map((item) => (
                            <View
                                key={item.id}
                                style={
                                    styles.messageCard
                                }
                            >
                                <View
                                    style={
                                        styles.messageHeader
                                    }
                                >
                                    <View
                                        style={
                                            styles.protocolContainer
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.protocol,
                                                {
                                                    color:
                                                        '#60a5fa',
                                                },
                                            ]}
                                        >
                                            {item.protocol}
                                        </Text>

                                        <Text
                                            style={
                                                styles.messageTime
                                            }
                                        >
                                            {item.timestamp}
                                        </Text>
                                    </View>
                                </View>

                                <Text
                                    style={
                                        styles.messageText
                                    }
                                >
                                    {item.message}
                                </Text>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },

    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },

    header: {
        marginBottom: 20,
    },

    title: {
        color: '#ffffff',
        fontSize: 26,
        fontWeight: '700',
    },

    subtitle: {
        color: '#888888',
        fontSize: 14,
        marginTop: 6,
    },

    sectionTitleContainer: {
        marginBottom: 8,
    },

    sectionTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '600',
    },

    infoCard: {
        backgroundColor: '#151515',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
    },

    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 7,
    },

    label: {
        color: '#888888',
        fontSize: 14,
    },

    value: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'right',
        maxWidth: '65%',
    },

    mutedValue: {
        color: '#666666',
    },

    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    status: {
        fontSize: 14,
        fontWeight: '600',
    },

    separator: {
        height: 1,
        backgroundColor: '#252525',
        marginVertical: 8,
    },

    errorCard: {
        backgroundColor: '#351515',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
    },

    errorTitle: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 6,
    },

    errorText: {
        color: '#fca5a5',
        fontSize: 14,
    },

    disconnectButton: {
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#222222',
        alignItems: 'center',
    },

    disconnectButtonText: {
        color: '#cccccc',
        fontSize: 13,
        fontWeight: '600',
    },

    connectButton: {
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#1d4ed8',
        alignItems: 'center',
    },

    connectButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },

    connectButtonDisabled: {
        backgroundColor: '#374151',
        opacity: 0.6,
    },

    messagesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },

    messagesTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '600',
    },

    clearButton: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#222222',
    },

    clearButtonText: {
        color: '#cccccc',
        fontSize: 13,
    },

    messagesContainer: {
        height: 350,
        marginBottom: 20,
    },

    messagesList: {
        flex: 1,
    },

    messagesContent: {
        paddingBottom: 10,
    },

    emptyContainer: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    emptyText: {
        color: '#666666',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 20,
    },

    messageCard: {
        backgroundColor: '#151515',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
    },

    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },

    protocolContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    protocol: {
        fontSize: 11,
        fontWeight: '800',
    },

    messageTime: {
        color: '#777777',
        fontSize: 11,
    },

    messageText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});