import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
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
import { useUdpSocket } from '@isvend/expo-udp';
import TcpSocket from 'react-native-tcp-socket';
import Socket from 'react-native-tcp-socket/lib/types/Socket';

const UDP_PORT = 4444;
const DEFAULT_TCP_PORT = 8080;

interface ReceivedMessage {
    id: string;
    message: string;
    remoteAddress: string;
    remotePort: number;
    timestamp: string;
    protocol: 'UDP' | 'TCP';
}

interface PedalDiscovery {
    ip: string;
    port: number;
}

interface TcpStatus {
    status:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'error';

    error?: string;
}

function decodeMessage(data: Uint8Array): string {
    try {
        return new TextDecoder().decode(data);
    } catch {
        return Array.from(data)
            .map((byte) => String.fromCharCode(byte))
            .join('');
    }
}

export default function UdpTestScreen() {
    const [messages, setMessages] = useState<ReceivedMessage[]>([]);

    const [pedal, setPedal] =
        useState<PedalDiscovery | null>(null);

    const [tcpStatus, setTcpStatus] =
        useState<TcpStatus>({
            status: 'disconnected',
        });

    const tcpSocketRef =
        useRef<Socket | null>(null);

    const tcpBufferRef =
        useRef('');

    /**
     * IP:puerto del pedal al que estamos conectados
     * o intentando conectarnos.
     *
     * Esto evita que cada broadcast UDP genere
     * una nueva conexión TCP.
     */
    const tcpTargetRef =
        useRef<string | null>(null);

    // ========================================================
    // Agregar mensaje al log
    // ========================================================

    const addMessage = useCallback(
        (
            message: string,
            protocol: 'UDP' | 'TCP',
            remoteAddress: string,
            remotePort: number,
        ) => {
            const receivedMessage: ReceivedMessage = {
                id: `${Date.now()}-${Math.random()}`,
                message,
                remoteAddress,
                remotePort,
                timestamp:
                    new Date().toLocaleTimeString(),
                protocol,
            };

            setMessages((current) =>
                [receivedMessage, ...current].slice(0, 100),
            );
        },
        [],
    );

    // ========================================================
    // TCP
    // ========================================================

    const disconnectTcp = useCallback(() => {
        const socket = tcpSocketRef.current;

        console.log('[TCP] Desconectando manualmente...');

        /**
         * Primero limpiamos el target para que el próximo
         * discovery UDP pueda volver a conectar.
         */
        tcpTargetRef.current = null;
        tcpBufferRef.current = '';

        if (socket) {
            try {
                socket.destroy();
            } catch {
                // El socket puede ya estar cerrado.
            }
        }

        tcpSocketRef.current = null;

        setTcpStatus({
            status: 'disconnected',
        });
    }, []);

    const connectTcp = useCallback(
        (ip: string, port: number) => {
            const target = `${ip}:${port}`;

            /**
             * Si ya estamos conectados o conectándonos
             * al mismo pedal, no hacemos absolutamente nada.
             *
             * Esta es la protección principal contra los
             * broadcasts UDP cada 3 segundos.
             */
            if (
                tcpTargetRef.current === target &&
                tcpSocketRef.current
            ) {
                console.log(
                    `[TCP] Ya conectado/conectando a ${target}, ignorando discovery.`,
                );

                return;
            }

            /**
             * Si había otro socket conectado a otro destino,
             * lo cerramos antes de conectar al nuevo.
             */
            if (tcpSocketRef.current) {
                console.log(
                    '[TCP] Cerrando conexión anterior...',
                );

                try {
                    tcpSocketRef.current.destroy();
                } catch {
                    // Ignorar.
                }

                tcpSocketRef.current = null;
            }

            tcpBufferRef.current = '';

            /**
             * Importante:
             * establecemos el target ANTES de crear el socket.
             *
             * Así, si llega otro broadcast UDP mientras
             * createConnection todavía está conectando,
             * no se crea otra conexión.
             */
            tcpTargetRef.current = target;

            setTcpStatus({
                status: 'connecting',
                error: undefined,
            });

            console.log(
                `[TCP] Conectando a ${target}...`,
            );

            const socket = TcpSocket.createConnection(
                {
                    host: ip,
                    port,
                },
                () => {
                    /**
                     * Verificamos que este siga siendo
                     * el socket activo.
                     */
                    if (
                        tcpTargetRef.current !== target
                    ) {
                        return;
                    }

                    console.log(
                        `[TCP] Conectado a ${target}`,
                    );

                    setTcpStatus({
                        status: 'connected',
                        error: undefined,
                    });

                    addMessage(
                        'TCP_CONNECTED',
                        'TCP',
                        ip,
                        port,
                    );
                },
            );

            tcpSocketRef.current = socket;

            // ------------------------------------------------
            // Datos TCP
            // ------------------------------------------------

            socket.on('data', (data) => {
                /**
                 * El ESP32 utiliza println(), por lo que
                 * esperamos mensajes terminados en \n.
                 *
                 * TCP no garantiza que cada evento llegue
                 * en un único paquete, por eso usamos buffer.
                 */
                const chunk =
                    typeof data === 'string'
                        ? data
                        : data.toString();

                console.log(
                    '[TCP] Datos recibidos:',
                    JSON.stringify(chunk),
                );

                tcpBufferRef.current += chunk;

                const lines =
                    tcpBufferRef.current.split('\n');

                /**
                 * La última parte puede estar incompleta.
                 * La conservamos para el siguiente paquete.
                 */
                tcpBufferRef.current =
                    lines.pop() ?? '';

                for (const line of lines) {
                    const message =
                        line.trim();

                    if (!message) {
                        continue;
                    }

                    addMessage(
                        message,
                        'TCP',
                        ip,
                        port,
                    );
                }
            });

            // ------------------------------------------------
            // Error TCP
            // ------------------------------------------------

            socket.on('error', (error) => {
                console.log(
                    '[TCP] Error:',
                    error.message,
                );

                /**
                 * Solo modificamos el estado si este
                 * continúa siendo el socket activo.
                 */
                if (
                    tcpSocketRef.current === socket
                ) {
                    setTcpStatus({
                        status: 'error',
                        error: error.message,
                    });
                }
            });

            // ------------------------------------------------
            // Cierre TCP
            // ------------------------------------------------

            socket.on('close', () => {
                console.log(
                    `[TCP] Conexión cerrada: ${target}`,
                );

                /**
                 * Este control es importante.
                 *
                 * Puede ocurrir que un socket viejo cierre
                 * después de que ya exista otro socket nuevo.
                 *
                 * En ese caso NO debemos borrar la referencia
                 * del socket nuevo.
                 */
                if (
                    tcpSocketRef.current === socket
                ) {
                    tcpSocketRef.current = null;

                    tcpTargetRef.current = null;

                    tcpBufferRef.current = '';

                    setTcpStatus({
                        status: 'disconnected',
                    });
                }

                addMessage(
                    'TCP_DISCONNECTED',
                    'TCP',
                    ip,
                    port,
                );
            });
        },
        [addMessage],
    );

    // ========================================================
    // UDP
    // ========================================================

    const handleMessage = useCallback(
        (event: {
            data: Uint8Array;
            remoteAddress: string;
            remotePort: number;
            family: string;
        }) => {
            const message =
                decodeMessage(event.data).trim();

            addMessage(
                message,
                'UDP',
                event.remoteAddress,
                event.remotePort,
            );

            console.log(
                '[UDP] Mensaje:',
                message,
            );

            // ------------------------------------------------
            // Interpretar discovery del pedal.
            //
            // Ejemplo:
            // {"ip":"192.168.137.118","port":8080}
            // ------------------------------------------------

            try {
                const data =
                    JSON.parse(message);

                if (
                    typeof data.ip !== 'string'
                ) {
                    return;
                }

                const port =
                    typeof data.port === 'number'
                        ? data.port
                        : DEFAULT_TCP_PORT;

                const discoveredPedal: PedalDiscovery = {
                    ip: data.ip,
                    port,
                };

                setPedal(discoveredPedal);

                const target =
                    `${data.ip}:${port}`;

                console.log(
                    `[UDP] Pedal descubierto: ${target}`,
                );

                /**
                 * UDP es solamente discovery.
                 *
                 * Si ya estamos conectados/conectando
                 * al mismo pedal, ignoramos el broadcast.
                 */
                if (
                    tcpTargetRef.current === target &&
                    tcpSocketRef.current
                ) {
                    console.log(
                        `[UDP] El TCP ya está activo hacia ${target}.`,
                    );

                    return;
                }

                /**
                 * Si el TCP se había desconectado,
                 * tcpTargetRef será null y acá se
                 * intentará reconectar.
                 */
                connectTcp(
                    data.ip,
                    port,
                );
            } catch {
                /**
                 * No era JSON de discovery.
                 *
                 * No hacemos nada.
                 */
            }
        },
        [addMessage, connectTcp],
    );

    const {
        status: udpStatus,
        error: udpError,
        localAddress,
    } = useUdpSocket({
        socket: {
            type: 'udp4',
            reuseAddress: true,
        },

        bind: {
            port: UDP_PORT,
            address: '0.0.0.0',
        },

        onMessage: handleMessage,
    });

    // ========================================================
    // Cleanup
    // ========================================================

    useEffect(() => {
        return () => {
            console.log(
                '[TCP] Cerrando conexión...',
            );

            tcpTargetRef.current = null;
            tcpBufferRef.current = '';

            if (tcpSocketRef.current) {
                try {
                    tcpSocketRef.current.destroy();
                } catch {
                    // Ignorar.
                }

                tcpSocketRef.current = null;
            }
        };
    }, []);

    // ========================================================
    // Estados visuales
    // ========================================================

    const udpStatusText = useMemo(() => {
        switch (udpStatus) {
            case 'idle':
                return 'Inactivo';

            case 'creating':
                return 'Creando socket...';

            case 'binding':
                return 'Abriendo puerto...';

            case 'listening':
                return 'Escuchando';

            case 'error':
                return 'Error';

            case 'closed':
                return 'Cerrado';

            default:
                return udpStatus;
        }
    }, [udpStatus]);

    const udpStatusColor =
        udpStatus === 'listening'
            ? '#22c55e'
            : '#f59e0b';

    const tcpStatusText = useMemo(() => {
        switch (tcpStatus.status) {
            case 'connecting':
                return 'Conectando...';

            case 'connected':
                return 'Conectado';

            case 'error':
                return 'Error';

            case 'disconnected':
            default:
                return 'Desconectado';
        }
    }, [tcpStatus.status]);

    const tcpStatusColor =
        tcpStatus.status === 'connected'
            ? '#22c55e'
            : tcpStatus.status === 'error'
                ? '#ef4444'
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
        <View style={styles.container}>
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
                        {(
                            udpStatus === 'creating' ||
                            udpStatus === 'binding'
                        ) ? (
                            <ActivityIndicator
                                size="small"
                            />
                        ) : null}

                        <Text
                            style={[
                                styles.status,
                                {
                                    color:
                                        udpStatusColor,
                                },
                            ]}
                        >
                            {udpStatusText}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.label}>
                        Puerto UDP
                    </Text>

                    <Text style={styles.value}>
                        {UDP_PORT}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.label}>
                        Dirección local
                    </Text>

                    <Text style={styles.value}>
                        {localAddress
                            ? `${localAddress.address}:${localAddress.port}`
                            : '---'}
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
                            !pedal &&
                            styles.mutedValue,
                        ]}
                    >
                        {pedal
                            ? `${pedal.ip}:${pedal.port}`
                            : 'Esperando...'}
                    </Text>
                </View>
            </View>

            {udpError ? (
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>
                        Error UDP
                    </Text>

                    <Text style={styles.errorText}>
                        {udpError.message}
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
                        {tcpStatus.status ===
                            'connecting' ? (
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
                            !pedal &&
                            styles.mutedValue,
                        ]}
                    >
                        {pedal
                            ? `${pedal.ip}:${pedal.port}`
                            : '---'}
                    </Text>
                </View>

                {tcpStatus.error ? (
                    <>
                        <View
                            style={styles.separator}
                        />

                        <Text
                            style={styles.tcpErrorText}
                        >
                            {tcpStatus.error}
                        </Text>
                    </>
                ) : null}

                {tcpStatus.status ===
                    'connected' ? (
                    <TouchableOpacity
                        style={
                            styles.disconnectButton
                        }
                        onPress={
                            disconnectTcp
                        }
                    >
                        <Text
                            style={
                                styles.disconnectButtonText
                            }
                        >
                            Desconectar TCP
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* =================================================
                EVENTS
            ================================================= */}

            <View style={styles.messagesHeader}>
                <Text style={styles.messagesTitle}>
                    Mensajes recibidos ({messages.length})
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

            <ScrollView
                style={styles.messagesList}
                contentContainerStyle={
                    messages.length === 0
                        ? styles.emptyContainer
                        : undefined
                }
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
                                                    item.protocol ===
                                                        'TCP'
                                                        ? '#60a5fa'
                                                        : '#a78bfa',
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

                                <Text
                                    style={
                                        styles.messageSource
                                    }
                                >
                                    {
                                        item.remoteAddress
                                    }
                                    :
                                    {
                                        item.remotePort
                                    }
                                </Text>
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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        padding: 20,
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

    tcpErrorText: {
        color: '#fca5a5',
        fontSize: 13,
        marginTop: 4,
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

    messagesList: {
        flex: 1,
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

    messageSource: {
        color: '#777777',
        fontSize: 11,
    },

    messageText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});