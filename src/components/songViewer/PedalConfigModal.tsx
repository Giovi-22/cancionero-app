/**
 * PedalConfigModal
 *
 * Modal de configuración del pedal.
 * Se abre con long-press en la pildora del pedal en SongViewerInfoBar.
 *
 * Contenido:
 *  - Estado de conexión (conectar / desconectar)
 *  - Selector de modo: Scroll continuo | Salto por secciones
 *  - Slider del porcentaje de superposición (solo en modo secciones)
 */

import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import {
    X,
    Footprints,
    ArrowDownUp,
    BookMarked,
    Wifi,
    WifiOff,
    Minus,
    Plus,
    Bluetooth,
    ChevronRight,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { PedalMode } from '../../types/pedal';
import { PedalDevice } from '../../types/pedal';
import { useResponsive } from '../../hooks/useResponsive';

// ─────────────────────────────────────────────────────────────────
// COLORES
// ─────────────────────────────────────────────────────────────────

const C = {
    bg: '#0d0d0f',
    surface: '#18181b',
    border: '#2a2a2e',
    fg: '#ffffff',
    muted: '#71717a',
    accent: '#3b82f6',
    green: '#22c55e',
    greenBg: 'rgba(34,197,94,0.12)',
    accentBg: 'rgba(59,130,246,0.12)',
    sectionBg: '#1c1c20',
};

// ─────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────

export interface PedalConfigModalProps {
    visible: boolean;
    onClose: () => void;

    // Conexión
    wifiConnected: boolean;
    pedalConnecting: boolean;
    pedalDevice: PedalDevice | null;
    onConnect: () => void;
    onDisconnect: () => void;

    // Modo
    pedalMode: PedalMode;
    onPedalModeChange: (mode: PedalMode) => void;

    // Superposición (modo secciones)
    overlapPercent: number; // 0–100
    onOverlapPercentChange: (pct: number) => void;

    // ¿La canción tiene secciones? (para mostrar aviso)
    hasSections: boolean;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────

export const PedalConfigModal: React.FC<PedalConfigModalProps> = ({
    visible,
    onClose,
    wifiConnected,
    pedalConnecting,
    pedalDevice,
    onConnect,
    onDisconnect,
    pedalMode,
    onPedalModeChange,
    overlapPercent,
    onOverlapPercentChange,
    hasSections,
}) => {
    const { isTablet } = useResponsive();
    const deviceLabel = pedalDevice?.name ?? pedalDevice?.ip ?? 'Pedal WiFi';

    const clampedOverlap = Math.min(60, Math.max(0, overlapPercent));

    function stepOverlap(delta: number) {
        onOverlapPercentChange(
            Math.min(60, Math.max(0, clampedOverlap + delta))
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.card, isTablet && styles.cardTablet]}
                >
                    {/* ── Header ── */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Footprints size={isTablet ? 19 : 15} color={C.accent} />
                            <Text style={[styles.title, isTablet && styles.titleTablet]}>Configuración del Pedal</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <X size={isTablet ? 19 : 15} color={C.muted} />
                        </TouchableOpacity>
                    </View>

                    {/* ── Conexión ── */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>Conexión WiFi</Text>

                        <View style={styles.connectionRow}>
                            <View style={styles.connectionInfo}>
                                {pedalConnecting ? (
                                    <ActivityIndicator size={isTablet ? 17 : 14} color={C.accent} />
                                ) : wifiConnected ? (
                                    <Wifi size={isTablet ? 17 : 14} color={C.green} />
                                ) : (
                                    <WifiOff size={isTablet ? 17 : 14} color={C.muted} />
                                )}
                                <Text
                                    style={[
                                        styles.connectionText,
                                        isTablet && styles.connectionTextTablet,
                                        wifiConnected && { color: C.green },
                                        !wifiConnected && !pedalConnecting && { color: C.muted },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {pedalConnecting
                                        ? 'Conectando...'
                                        : wifiConnected
                                            ? deviceLabel
                                            : pedalDevice
                                                ? deviceLabel
                                                : 'Sin pedal detectado'}
                                </Text>
                            </View>

                            {(pedalDevice || wifiConnected) && (
                                <TouchableOpacity
                                    style={[
                                        styles.connectBtn,
                                        isTablet && styles.connectBtnTablet,
                                        wifiConnected && styles.connectBtnDanger,
                                        pedalConnecting && styles.connectBtnDisabled,
                                    ]}
                                    onPress={wifiConnected ? onDisconnect : onConnect}
                                    disabled={pedalConnecting}
                                >
                                    <Text
                                        style={[
                                            styles.connectBtnText,
                                            isTablet && styles.connectBtnTextTablet,
                                            wifiConnected && { color: '#f87171' },
                                        ]}
                                    >
                                        {wifiConnected ? 'Desconectar' : 'Conectar'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* ── Modo ── */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>Modo del Pedal</Text>

                        {/* Opción: Scroll continuo */}
                        <TouchableOpacity
                            style={[
                                styles.modeOption,
                                isTablet && styles.modeOptionTablet,
                                pedalMode === 'scroll' && styles.modeOptionActive,
                            ]}
                            onPress={() => onPedalModeChange('scroll')}
                            activeOpacity={0.75}
                        >
                            <View style={[styles.modeRadio, isTablet && styles.modeRadioTablet]}>
                                {pedalMode === 'scroll' && (
                                    <View style={[styles.modeRadioDot, isTablet && styles.modeRadioDotTablet]} />
                                )}
                            </View>
                            <View style={styles.modeTextGroup}>
                                <View style={styles.modeRow}>
                                    <ArrowDownUp
                                        size={isTablet ? 16 : 13}
                                        color={pedalMode === 'scroll' ? C.accent : C.muted}
                                    />
                                    <Text
                                        style={[
                                            styles.modeName,
                                            isTablet && styles.modeNameTablet,
                                            pedalMode === 'scroll' && { color: C.accent },
                                        ]}
                                    >
                                        Scroll continuo
                                    </Text>
                                </View>
                                <Text style={[styles.modeDesc, isTablet && styles.modeDescTablet]}>
                                    Desplaza la canción mientras mantenés presionado.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Opción: Salto por secciones */}
                        <TouchableOpacity
                            style={[
                                styles.modeOption,
                                isTablet && styles.modeOptionTablet,
                                pedalMode === 'sections' && styles.modeOptionActive,
                                { marginTop: isTablet ? 10 : 8 },
                            ]}
                            onPress={() => onPedalModeChange('sections')}
                            activeOpacity={0.75}
                        >
                            <View style={[styles.modeRadio, isTablet && styles.modeRadioTablet]}>
                                {pedalMode === 'sections' && (
                                    <View style={[styles.modeRadioDot, isTablet && styles.modeRadioDotTablet]} />
                                )}
                            </View>
                            <View style={styles.modeTextGroup}>
                                <View style={styles.modeRow}>
                                    <BookMarked
                                        size={isTablet ? 16 : 13}
                                        color={pedalMode === 'sections' ? C.accent : C.muted}
                                    />
                                    <Text
                                        style={[
                                            styles.modeName,
                                            isTablet && styles.modeNameTablet,
                                            pedalMode === 'sections' && { color: C.accent },
                                        ]}
                                    >
                                        Salto por secciones
                                    </Text>
                                </View>
                                <Text style={[styles.modeDesc, isTablet && styles.modeDescTablet]}>
                                    Cada pulso salta a la siguiente sección (Verso, Coro…).
                                </Text>
                                {pedalMode === 'sections' && !hasSections && (
                                    <Text style={[styles.modeWarning, isTablet && { fontSize: 13 }]}>
                                        ⚠ Esta canción no tiene secciones definidas.
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* ── Superposición (solo en modo secciones) ── */}
                    {pedalMode === 'sections' && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.section}>
                                <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>Contexto anterior</Text>
                                <Text style={[styles.overlapHint, isTablet && styles.overlapHintTablet]}>
                                    Fracción del viewport que muestra el final del verso anterior.
                                </Text>

                                <View style={styles.stepperRow}>
                                    <TouchableOpacity
                                        style={[styles.stepBtn, isTablet && styles.stepBtnTablet]}
                                        onPress={() => stepOverlap(-5)}
                                        disabled={clampedOverlap <= 0}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Minus
                                            size={isTablet ? 18 : 14}
                                            color={clampedOverlap <= 0 ? C.muted : C.fg}
                                        />
                                    </TouchableOpacity>

                                    <View style={[styles.overlapValueBox, isTablet && styles.overlapValueBoxTablet]}>
                                        <Text style={[styles.overlapValue, isTablet && styles.overlapValueTablet]}>
                                            {clampedOverlap}%
                                        </Text>
                                        <Text style={[styles.overlapSub, isTablet && styles.overlapSubTablet]}>
                                            contexto
                                        </Text>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.stepBtn, isTablet && styles.stepBtnTablet]}
                                        onPress={() => stepOverlap(5)}
                                        disabled={clampedOverlap >= 60}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Plus
                                            size={isTablet ? 18 : 14}
                                            color={clampedOverlap >= 60 ? C.muted : C.fg}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {/* Visualización 70/30 */}
                                <View style={[styles.previewBar, isTablet && styles.previewBarTablet]}>
                                    <View
                                        style={[
                                            styles.previewTop,
                                            { flex: clampedOverlap },
                                        ]}
                                    >
                                        <Text style={[styles.previewTopText, isTablet && { fontSize: 12 }]} numberOfLines={1}>
                                            ↑ {clampedOverlap}% anterior
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.previewBottom,
                                            { flex: 100 - clampedOverlap },
                                        ]}
                                    >
                                        <Text style={[styles.previewBottomText, isTablet && { fontSize: 12 }]} numberOfLines={1}>
                                            ↓ {100 - clampedOverlap}% nueva sección
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </>
                    )}
                    {/* ── Acceso a mapeo Bluetooth ── */}
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={[styles.btLinkRow, isTablet && styles.btLinkRowTablet]}
                        onPress={() => {
                            onClose();
                            router.push('/pedal-config');
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={styles.btLinkLeft}>
                            <Bluetooth size={isTablet ? 18 : 14} color={C.muted} />
                            <Text style={[styles.btLinkText, isTablet && styles.btLinkTextTablet]}>
                                Mapeo de teclas Bluetooth (HID)
                            </Text>
                        </View>
                        <ChevronRight size={isTablet ? 18 : 14} color={C.muted} />
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

// ─────────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },

    card: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: C.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.border,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 12,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },

    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },

    title: {
        color: C.fg,
        fontSize: 14,
        fontWeight: '700',
    },

    closeBtn: {
        padding: 4,
    },

    section: {
        marginBottom: 4,
    },

    sectionLabel: {
        color: C.muted,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },

    divider: {
        height: 1,
        backgroundColor: C.border,
        marginVertical: 14,
    },

    // Conexión
    connectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },

    connectionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        flex: 1,
    },

    connectionText: {
        color: C.fg,
        fontSize: 13,
        flex: 1,
    },

    connectBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.accentBg,
        borderWidth: 1,
        borderColor: C.accent,
    },

    connectBtnDanger: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderColor: '#ef4444',
    },

    connectBtnDisabled: {
        opacity: 0.4,
    },

    connectBtnText: {
        color: C.accent,
        fontSize: 12,
        fontWeight: '600',
    },

    // Modo
    modeOption: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 10,
        borderRadius: 10,
        backgroundColor: C.sectionBg,
        borderWidth: 1,
        borderColor: C.border,
        gap: 10,
    },

    modeOptionActive: {
        borderColor: C.accent,
        backgroundColor: C.accentBg,
    },

    modeRadio: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: C.muted,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 1,
    },

    modeRadioDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: C.accent,
    },

    modeTextGroup: {
        flex: 1,
        gap: 2,
    },

    modeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },

    modeName: {
        color: C.fg,
        fontSize: 13,
        fontWeight: '600',
    },

    modeDesc: {
        color: C.muted,
        fontSize: 11,
        lineHeight: 15,
        marginTop: 2,
    },

    modeWarning: {
        color: '#fbbf24',
        fontSize: 11,
        marginTop: 4,
    },

    // Superposición
    overlapHint: {
        color: C.muted,
        fontSize: 11,
        marginBottom: 12,
        lineHeight: 15,
    },

    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },

    stepBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: C.border,
        justifyContent: 'center',
        alignItems: 'center',
    },

    overlapValueBox: {
        alignItems: 'center',
    },

    overlapValue: {
        color: C.fg,
        fontSize: 28,
        fontWeight: '700',
        lineHeight: 32,
    },

    overlapSub: {
        color: C.muted,
        fontSize: 11,
    },

    // Preview bar 70/30
    previewBar: {
        height: 48,
        borderRadius: 8,
        overflow: 'hidden',
        flexDirection: 'column',
    },

    previewTop: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.accent,
    },

    previewTopText: {
        color: C.muted,
        fontSize: 10,
    },

    previewBottom: {
        backgroundColor: C.accentBg,
        justifyContent: 'center',
        paddingHorizontal: 10,
    },

    previewBottomText: {
        color: C.accent,
        fontSize: 10,
        fontWeight: '600',
    },

    btLinkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 2,
    },
    btLinkLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    btLinkText: {
        fontSize: 12,
        color: C.muted,
    },

    /* Adaptaciones para Tablet */
    cardTablet: {
        maxWidth: 460,
        padding: 24,
        borderRadius: 22,
    },
    titleTablet: {
        fontSize: 17,
    },
    sectionLabelTablet: {
        fontSize: 12,
        marginBottom: 12,
    },
    connectionTextTablet: {
        fontSize: 15,
    },
    connectBtnTablet: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 10,
    },
    connectBtnTextTablet: {
        fontSize: 14,
    },
    modeOptionTablet: {
        padding: 14,
        borderRadius: 12,
        gap: 12,
    },
    modeRadioTablet: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginTop: 2,
    },
    modeRadioDotTablet: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    modeNameTablet: {
        fontSize: 15,
    },
    modeDescTablet: {
        fontSize: 13,
        lineHeight: 18,
    },
    overlapHintTablet: {
        fontSize: 13,
        marginBottom: 8,
    },
    stepBtnTablet: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    overlapValueBoxTablet: {
        minWidth: 90,
    },
    overlapValueTablet: {
        fontSize: 26,
        lineHeight: 30,
    },
    overlapSubTablet: {
        fontSize: 12,
    },
    previewBarTablet: {
        height: 36,
        borderRadius: 8,
    },
    btLinkRowTablet: {
        paddingVertical: 12,
    },
    btLinkTextTablet: {
        fontSize: 14,
    },
});
