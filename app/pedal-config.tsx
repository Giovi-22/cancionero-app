import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { ArrowLeft, Bluetooth, Footprints, ChevronDown, ChevronUp, Play, Trash2, RefreshCw, HelpCircle, Check, CircleDot } from 'lucide-react-native';
import { router } from 'expo-router';
import { COLORS } from '../src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../src/services/StorageService';

interface ActionItem {
    id: string;
    name: string;
    desc: string;
    defaultKey: string;
}

const ACTIONS: ActionItem[] = [
    { id: 'scroll_down', name: 'Scroll Abajo', desc: 'Desplaza la canción hacia abajo', defaultKey: 'ArrowDown / PageDown' },
    { id: 'scroll_up', name: 'Scroll Arriba', desc: 'Desplaza la canción hacia arriba', defaultKey: 'ArrowUp / PageUp' },
    { id: 'next_page', name: 'Siguiente Canción', desc: 'Pasa al siguiente tema en la lista', defaultKey: 'ArrowRight' },
    { id: 'prev_page', name: 'Anterior Canción', desc: 'Vuelve al tema anterior en la lista', defaultKey: 'ArrowLeft' },
    { id: 'toggle_autoscroll', name: 'Iniciar/Parar Scroll', desc: 'Activa o desactiva el desplazamiento automático', defaultKey: 'Sin asignar' },
];

const DEFAULT_MAPPINGS: Record<string, string> = {
    'ArrowUp': 'scroll_up',
    'ArrowDown': 'scroll_down',
    'PageUp': 'scroll_up',
    'PageDown': 'scroll_down',
    'ArrowRight': 'next_page',
    'ArrowLeft': 'prev_page',
};

export default function PedalConfigScreen() {
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);
    const testTimeoutRef = useRef<any>(null);

    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [listeningAction, setListeningAction] = useState<string | null>(null);
    const [lastTestKey, setLastTestKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFocused, setIsFocused] = useState(false);

    // Cargar mappings al montar
    useEffect(() => {
        const loadMappings = async () => {
            try {
                const saved = await StorageService.getSetting<Record<string, string>>('pedal_mappings');
                if (saved) {
                    setMappings(saved);
                } else {
                    setMappings(DEFAULT_MAPPINGS);
                }
            } catch (e) {
                console.error('Error loading mappings:', e);
            } finally {
                setLoading(false);
            }
        };
        loadMappings();

        // Mantener focused el TextInput para capturar teclas
        const interval = setInterval(() => {
            if (inputRef.current && !inputRef.current.isFocused()) {
                inputRef.current.focus();
            }
        }, 1000);

        return () => {
            clearInterval(interval);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
        };
    }, []);

    // Buscar qué tecla está asignada a una acción específica
    const getKeysForAction = (actionId: string): string[] => {
        return Object.keys(mappings).filter(key => mappings[key] === actionId);
    };

    // Asignar tecla a acción
    const assignKey = async (key: string, actionId: string) => {
        const updated = { ...mappings };
        
        // 1. Quitar cualquier mapeo previo que tuviera esta misma tecla
        delete updated[key];
        
        // 2. Eliminar la asignación de otras teclas que estuvieran vinculadas a esta misma acción
        // (así cada acción tiene una tecla única principal configurada por el usuario)
        Object.keys(updated).forEach(k => {
            if (updated[k] === actionId) {
                delete updated[k];
            }
        });

        // 3. Establecer el nuevo mapping
        updated[key] = actionId;
        
        setMappings(updated);
        await StorageService.saveSetting('pedal_mappings', updated);
        setListeningAction(null);
    };

    // Eliminar mapeo de una acción
    const clearActionMapping = async (actionId: string) => {
        const updated = { ...mappings };
        Object.keys(updated).forEach(k => {
            if (updated[k] === actionId) {
                delete updated[k];
            }
        });
        setMappings(updated);
        await StorageService.saveSetting('pedal_mappings', updated);
    };

    // Restablecer por defecto
    const resetToDefaults = async () => {
        setMappings(DEFAULT_MAPPINGS);
        await StorageService.saveSetting('pedal_mappings', DEFAULT_MAPPINGS);
    };

    const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

    const handleKeyDetected = (key: string) => {
        if (!key) return;

        // Evitar disparos duplicados en un lapso de 150ms
        const now = Date.now();
        if (lastKeyRef.current.key === key && (now - lastKeyRef.current.time) < 150) {
            return;
        }
        lastKeyRef.current = { key, time: now };

        if (listeningAction) {
            // Modo Asignación
            assignKey(key, listeningAction);
        } else {
            // Modo Probador en tiempo real
            setLastTestKey(key);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
            testTimeoutRef.current = setTimeout(() => {
                setLastTestKey(null);
            }, 2500);
        }
    };

    // Capturar tecla presionada
    const handleKeyPress = (e: any) => {
        handleKeyDetected(e.nativeEvent.key);
    };

    const handleTextChange = (text: string) => {
        if (text && text.length > 0) {
            const key = text.charAt(text.length - 1);
            handleKeyDetected(key);
        }
    };

    const getActionFriendlyName = (actionId: string) => {
        const act = ACTIONS.find(a => a.id === actionId);
        return act ? act.name : 'Desconocida';
    };

    return (
        <View style={styles.container}>
            {/* TextInput oculto que captura las pulsaciones del pedal */}
            <TextInput
                ref={inputRef}
                style={styles.hiddenInput}
                showSoftInputOnFocus={false}
                onKeyPress={handleKeyPress}
                onChangeText={handleTextChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus={true}
                caretHidden={true}
                value=""
            />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.foreground} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Configurar Pedal Bluetooth</Text>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                {/* Indicador de Estado de Foco */}
                <TouchableOpacity 
                    style={[styles.glassCard, styles.focusCard, isFocused ? styles.focusActive : styles.focusInactive]}
                    onPress={() => inputRef.current?.focus()}
                    activeOpacity={0.8}
                >
                    <View style={styles.focusHeader}>
                        <View style={[styles.dotIndicator, { backgroundColor: isFocused ? '#22c55e' : '#ef4444' }]} />
                        <Text style={styles.focusTitle}>
                            {isFocused ? 'Detector de Pedal Activo' : 'Detector de Pedal Inactivo (Toca para activar)'}
                        </Text>
                    </View>
                    <Text style={styles.focusText}>
                        {isFocused 
                            ? 'El celular está listo para recibir pulsaciones del pedal. Presiona cualquier botón.' 
                            : 'Toca esta tarjeta para activar el detector si el pedal no responde.'}
                    </Text>
                </TouchableOpacity>

                {/* Explicación de cómo funciona el pedal */}
                <View style={styles.glassCard}>
                    <View style={styles.statusRow}>
                        <Bluetooth size={22} color={COLORS.accent} />
                        <Text style={styles.statusTitle}>¿Cómo funciona?</Text>
                    </View>
                    <Text style={styles.statusText}>
                        La mayoría de los pedales para pasar páginas funcionan como un <Text style={styles.highlightText}>teclado inalámbrico</Text>. 
                        Vinculá tu pedal en la configuración Bluetooth de tu celular, ingresá a esta pantalla y presioná los botones del pedal para configurarlos.
                    </Text>
                </View>

                {/* Probador en Tiempo Real */}
                <View style={[styles.glassCard, styles.testerCard]}>
                    <View style={styles.testerHeader}>
                        <CircleDot size={16} color={lastTestKey ? '#22c55e' : COLORS.mutedForeground} />
                        <Text style={styles.testerTitle}>Detector de Pedal (Tiempo Real)</Text>
                    </View>
                    {lastTestKey ? (
                        <View style={styles.testResultRow}>
                            <View style={styles.testKeyContainer}>
                                <Text style={styles.testKeyLabel}>Tecla:</Text>
                                <Text style={styles.testKeyValue}>"{lastTestKey}"</Text>
                            </View>
                            <View style={styles.testActionContainer}>
                                <Text style={styles.testKeyLabel}>Acción:</Text>
                                <Text style={[styles.testActionValue, mappings[lastTestKey] ? styles.actionActive : styles.actionInactive]}>
                                    {mappings[lastTestKey] ? getActionFriendlyName(mappings[lastTestKey]) : 'Sin asignar'}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.testerHelpText}>
                            Presioná cualquier botón de tu pedal físico para verificar si el dispositivo lo detecta...
                        </Text>
                    )}
                </View>

                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Mapeo de Acciones</Text>
                    <TouchableOpacity onPress={resetToDefaults} style={styles.resetBtn}>
                        <RefreshCw size={14} color={COLORS.mutedForeground} />
                        <Text style={styles.resetBtnText}>Valores por defecto</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.accent} />
                    </View>
                ) : (
                    <View style={styles.mappingCard}>
                        {ACTIONS.map((action, index) => {
                            const assignedKeys = getKeysForAction(action.id);
                            const hasMapping = assignedKeys.length > 0;

                            return (
                                <View key={action.id}>
                                    <View style={styles.mappingRow}>
                                        <View style={styles.actionInfo}>
                                            <Text style={styles.pedalLabel}>{action.name}</Text>
                                            <Text style={styles.pedalDesc}>{action.desc}</Text>
                                            <View style={styles.keysList}>
                                                {hasMapping ? (
                                                    assignedKeys.map(k => (
                                                        <View key={k} style={styles.keyBadge}>
                                                            <Text style={styles.keyBadgeText}>{k}</Text>
                                                        </View>
                                                    ))
                                                ) : (
                                                    <Text style={styles.noMappingText}>
                                                        Por defecto: {action.defaultKey}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                        
                                        <View style={styles.actionsContainer}>
                                            <TouchableOpacity 
                                                onPress={() => setListeningAction(action.id)}
                                                style={[styles.actionSelectorBtn, hasMapping && styles.actionSelectorActive]}
                                            >
                                                <Footprints size={14} color="#fff" />
                                                <Text style={styles.actionSelectorText}>
                                                    {hasMapping ? 'Reasignar' : 'Mapear'}
                                                </Text>
                                            </TouchableOpacity>
                                            
                                            {hasMapping && (
                                                <TouchableOpacity 
                                                    onPress={() => clearActionMapping(action.id)}
                                                    style={styles.deleteBtn}
                                                >
                                                    <Trash2 size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    {index < ACTIONS.length - 1 && <View style={styles.divider} />}
                                </View>
                            );
                        })}
                    </View>
                )}

                <Text style={styles.helpText}>
                    <HelpCircle size={12} color={COLORS.mutedForeground} style={{ marginRight: 4 }} />
                    Si tu pedal no es detectado, asegurate de que esté en modo "Teclado" (Mode 1 o Mode 2 en la mayoría de los pedales AirTurn/PageFlip) y que esté correctamente emparejado con tu dispositivo.
                </Text>
            </ScrollView>

            {/* Modal de escucha de tecla para asignación (como overlay absoluto para no perder el foco) */}
            {listeningAction !== null && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Footprints size={48} color={COLORS.accent} style={styles.modalIcon} />
                        <Text style={styles.modalTitle}>Configurar Acción</Text>
                        <Text style={styles.modalActionName}>
                            "{ACTIONS.find(a => a.id === listeningAction)?.name}"
                        </Text>
                        
                        <View style={styles.waitingContainer}>
                            <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 10 }} />
                            <Text style={styles.modalHelp}>
                                Presioná el botón de tu pedal ahora...
                            </Text>
                        </View>
                        
                        <Text style={styles.modalFooterText}>
                            La app detectará automáticamente el botón presionado y lo guardará.
                        </Text>

                        <TouchableOpacity 
                            onPress={() => setListeningAction(null)} 
                            style={styles.cancelBtn}
                        >
                            <Text style={styles.cancelBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    hiddenInput: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        opacity: 0.01,
        color: 'transparent',
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: {
        padding: 5,
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },
    content: {
        padding: 20,
    },
    glassCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 20,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    statusTitle: {
        color: COLORS.foreground,
        fontSize: 16,
        fontWeight: 'bold',
    },
    statusText: {
        color: COLORS.mutedForeground,
        fontSize: 13,
        lineHeight: 20,
    },
    highlightText: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    testerCard: {
        borderColor: COLORS.border,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    testerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    testerTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.mutedForeground,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    testerHelpText: {
        fontSize: 13,
        color: COLORS.mutedForeground,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 10,
    },
    testResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    testKeyContainer: {
        alignItems: 'center',
    },
    testActionContainer: {
        alignItems: 'center',
    },
    testKeyLabel: {
        fontSize: 10,
        color: COLORS.mutedForeground,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    testKeyValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.accent,
        fontFamily: 'monospace',
    },
    testActionValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionActive: {
        color: '#22c55e',
    },
    actionInactive: {
        color: '#ef4444',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.mutedForeground,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    resetBtnText: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        fontWeight: '500',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    mappingCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 20,
        overflow: 'hidden',
    },
    mappingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    actionInfo: {
        flex: 1,
        paddingRight: 10,
    },
    pedalLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },
    pedalDesc: {
        fontSize: 12,
        color: COLORS.mutedForeground,
        marginTop: 2,
    },
    keysList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    keyBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    keyBadgeText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: 'bold',
        fontFamily: 'monospace',
    },
    noMappingText: {
        color: COLORS.mutedForeground,
        fontSize: 11,
        fontStyle: 'italic',
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionSelectorBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.accent,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    actionSelectorActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    actionSelectorText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    deleteBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
    },
    helpText: {
        fontSize: 12,
        color: COLORS.mutedForeground,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 10,
        marginTop: 10,
    },
    // Estilos del modal
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 9999,
    },
    modalContent: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalIcon: {
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },
    modalActionName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.accent,
        marginTop: 4,
        marginBottom: 20,
        textAlign: 'center',
    },
    waitingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        width: '100%',
        justifyContent: 'center',
        marginBottom: 20,
    },
    modalHelp: {
        fontSize: 14,
        color: COLORS.foreground,
        fontWeight: '500',
    },
    modalFooterText: {
        fontSize: 11,
        color: COLORS.mutedForeground,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 24,
    },
    cancelBtn: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelBtnText: {
        color: COLORS.foreground,
        fontSize: 14,
        fontWeight: 'bold',
    },
    focusCard: {
        borderWidth: 1.5,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    focusActive: {
        borderColor: 'rgba(34, 197, 94, 0.4)',
        backgroundColor: 'rgba(34, 197, 94, 0.03)',
    },
    focusInactive: {
        borderColor: 'rgba(239, 68, 68, 0.4)',
        backgroundColor: 'rgba(239, 68, 68, 0.03)',
    },
    focusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    dotIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    focusTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },
    focusText: {
        fontSize: 11,
        color: COLORS.mutedForeground,
        lineHeight: 16,
    },
});
