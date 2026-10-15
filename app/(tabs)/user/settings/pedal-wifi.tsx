import React, { useState, useRef } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    AlertCircle,
    CheckCircle2,
    Info,
    Radar,
    SlidersHorizontal,
    Square,
    Wifi,
} from 'lucide-react-native';

import { COLORS } from '../../../../src/constants/theme';
import { usePedal } from '../../../../src/hooks/usePedal';
import { usePedalAutoDiscovery } from '@/src/hooks/usePedalAutoDiscovery';

const MANUAL_DISCOVERY_MS = 10000;

export default function PedalWifiScreen() {
    const {
        connected,
        connecting,
        discovering,
        device,
        discover,
        stopDiscover,
        connect,
        disconnect,
    } = usePedal();

    const { enabled: autoDiscovery, setEnabled: setAutoDiscovery } =
        usePedalAutoDiscovery();

    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const manualStopRef = useRef(false);

    const handleSearch = async () => {
        if (discovering) return;
        setError(null);
        setNotFound(false);
        manualStopRef.current = false;
        try {
            const found = await discover(MANUAL_DISCOVERY_MS);
            if (!found && !manualStopRef.current) {
                setNotFound(true);
            }
        } catch {
            if (!manualStopRef.current) {
                setNotFound(true);
            }
        } finally {
            manualStopRef.current = false;
        }
    };

    const handleStopSearch = () => {
        manualStopRef.current = true;
        stopDiscover();
    };

    const handleConnect = async () => {
        if (!device || connecting) return;
        setError(null);
        try {
            await connect(device);
        } catch (e: any) {
            setError(e?.message || 'No se pudo conectar al pedal.');
        }
    };

    const handleDisconnect = () => {
        disconnect();
        setError(null);
    };

    const handleToggleAuto = (value: boolean) => {
        setAutoDiscovery(value);
        if (value && !connected && !device) {
            handleSearch();
        }
    };

    // ── Estado visual ─────────────────────────────────────────
    let tone: 'connected' | 'found' | 'searching' | 'idle' = 'idle';
    let statusTitle = 'Sin conexión';
    let statusText = 'Buscá el pedal para poder conectarlo.';

    if (connected) {
        tone = 'connected';
        statusTitle = 'Conectado';
        statusText = 'El pedal está listo para usar.';
    } else if (connecting) {
        tone = 'searching';
        statusTitle = 'Conectando...';
        statusText = 'Estableciendo conexión con el pedal.';
    } else if (device) {
        tone = 'found';
        statusTitle = 'Pedal encontrado';
        statusText = 'Disponible en esta red. Tocá conectar.';
    } else if (discovering) {
        tone = 'searching';
        statusTitle = 'Buscando...';
        statusText = 'Escuchando el anuncio del pedal en la red.';
    } else if (notFound) {
        statusTitle = 'No se encontró el pedal';
        statusText = 'Revisá que esté encendido y en la misma red WiFi.';
    }

    const toneColor =
        tone === 'connected'
            ? '#22c55e'
            : tone === 'idle'
                ? COLORS.mutedForeground
                : COLORS.accent;

    const toneBg =
        tone === 'connected'
            ? 'rgba(34,197,94,0.15)'
            : tone === 'idle'
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(59,130,246,0.15)';

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* Estado */}
            <View style={styles.card}>
                <View style={styles.statusHeader}>
                    <View style={[styles.statusIcon, { backgroundColor: toneBg }]}>
                        {tone === 'connected' ? (
                            <CheckCircle2 size={24} color={toneColor} />
                        ) : tone === 'searching' ? (
                            <ActivityIndicator size="small" color={toneColor} />
                        ) : (
                            <SlidersHorizontal size={24} color={toneColor} />
                        )}
                    </View>

                    <View style={styles.statusInfo}>
                        <Text style={styles.statusLabel}>Pedal Cancionero</Text>
                        <Text style={[styles.statusTitle, { color: toneColor }]}>
                            {statusTitle}
                        </Text>
                        <Text style={styles.statusText}>{statusText}</Text>
                    </View>
                </View>

                {device && (
                    <View style={styles.deviceRow}>
                        <Wifi size={14} color={COLORS.mutedForeground} />
                        <Text style={styles.deviceText}>
                            {device.ip}:{device.port}
                        </Text>
                    </View>
                )}

                {error && (
                    <View style={styles.errorRow}>
                        <AlertCircle size={14} color="#ef4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Acción principal según estado */}
                {connected ? (
                    <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={handleDisconnect}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.dangerButtonText}>Desconectar</Text>
                    </TouchableOpacity>
                ) : device ? (
                    <TouchableOpacity
                        style={[styles.primaryButton, connecting && styles.disabled]}
                        onPress={handleConnect}
                        disabled={connecting}
                        activeOpacity={0.8}
                    >
                        {connecting && (
                            <ActivityIndicator size="small" color="#fff" />
                        )}
                        <Text style={styles.primaryButtonText}>
                            {connecting ? 'Conectando...' : error ? 'Reintentar' : 'Conectar'}
                        </Text>
                    </TouchableOpacity>
                ) : discovering ? (
                    <TouchableOpacity
                        style={styles.stopButton}
                        onPress={handleStopSearch}
                        activeOpacity={0.8}
                    >
                        <Square size={16} color="#ef4444" fill="#ef4444" />
                        <Text style={styles.stopButtonText}>Detener búsqueda</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handleSearch}
                        activeOpacity={0.8}
                    >
                        <Radar size={16} color={COLORS.accent} />
                        <Text style={styles.secondaryButtonText}>Buscar pedal</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Búsqueda automática */}
            <Text style={styles.sectionTitle}>Búsqueda</Text>
            <View style={styles.card}>
                <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                        <Text style={styles.rowTitle}>Buscar automáticamente</Text>
                        <Text style={styles.rowSubtitle}>
                            Escanea la red al abrir la app y avisa en Inicio cuando
                            encuentra el pedal. Si lo apagás, solo se busca cuando
                            vos lo pedís.
                        </Text>
                    </View>
                    <Switch
                        value={autoDiscovery}
                        onValueChange={handleToggleAuto}
                        trackColor={{ false: '#3f3f46', true: COLORS.accent }}
                        thumbColor="#ffffff"
                    />
                </View>
            </View>

            {/* Ayuda */}
            <View style={styles.helpRow}>
                <Info size={14} color={COLORS.mutedForeground} />
                <Text style={styles.helpText}>
                    El celular y el pedal tienen que estar conectados a la misma red
                    WiFi.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: 20, paddingTop: 24, paddingBottom: 40 },

    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 24,
    },

    statusHeader: { flexDirection: 'row', alignItems: 'center' },
    statusIcon: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    statusInfo: { flex: 1 },
    statusLabel: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        fontWeight: '600',
    },
    statusTitle: { fontSize: 18, fontWeight: '700', marginTop: 2 },
    statusText: { color: COLORS.mutedForeground, fontSize: 12, marginTop: 3 },

    deviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 14,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    deviceText: {
        color: COLORS.foreground,
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },

    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
    },
    errorText: { color: '#f87171', fontSize: 12, flex: 1 },

    primaryButton: {
        marginTop: 16,
        backgroundColor: COLORS.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 12,
    },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    secondaryButton: {
        marginTop: 16,
        backgroundColor: 'rgba(59,130,246,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 12,
    },
    secondaryButtonText: {
        color: COLORS.accent,
        fontSize: 15,
        fontWeight: '700',
    },

    stopButton: {
        marginTop: 16,
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 12,
    },
    stopButtonText: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '700',
    },

    dangerButton: {
        marginTop: 16,
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        alignItems: 'center',
        paddingVertical: 13,
        borderRadius: 12,
    },
    dangerButtonText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },

    disabled: { opacity: 0.6 },

    sectionTitle: {
        color: COLORS.mutedForeground,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    switchRow: { flexDirection: 'row', alignItems: 'center' },
    switchInfo: { flex: 1, paddingRight: 14 },
    rowTitle: { color: COLORS.foreground, fontSize: 15, fontWeight: '600' },
    rowSubtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 4,
        lineHeight: 17,
    },

    helpRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingHorizontal: 4,
    },
    helpText: {
        flex: 1,
        color: COLORS.mutedForeground,
        fontSize: 12,
        lineHeight: 17,
    },
});
