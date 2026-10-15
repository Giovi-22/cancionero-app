import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Bluetooth,
    Bug,
    ChevronRight,
    HelpCircle,
    RefreshCw,
    ShieldAlert,
    Wifi,
} from 'lucide-react-native';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';

import { checkAndFetchUpdate } from '../../../../src/hooks/useOtaUpdate';

import { COLORS } from '../../../../src/constants/theme';
import { useAppContext } from '../../../../src/context/AppContext';
import AppModal from '../../../../src/components/common/AppModal';
import { usePedal } from '../../../../src/hooks/usePedal';
import { ScrollView } from 'react-native-gesture-handler';
import CardContainer from '@/src/components/common/CardContainer';

export default function SettingsScreen() {
    const isDevelopment = __DEV__;

    const {
        isSyncing,
        handleClearRepertoire,
    } = useAppContext();

    const { connected: pedalConnected, device: pedalDevice } = usePedal();

    const wifiSubtitle = pedalConnected
        ? 'Conectado'
        : pedalDevice
            ? 'Pedal encontrado en la red'
            : 'Buscar y conectar pedal por WiFi';

    const [isClearRepertoireModalVisible, setIsClearRepertoireModalVisible] =
        useState(false);

    const handleClearRepertoirePress = () => {
        if (isSyncing) return;

        setIsClearRepertoireModalVisible(true);
    };

    const handleCancelClearRepertoire = () => {
        if (isSyncing) return;

        setIsClearRepertoireModalVisible(false);
    };

    const handleConfirmClearRepertoire = async () => {
        try {
            await handleClearRepertoire();
            setIsClearRepertoireModalVisible(false);
        } catch (error) {
            console.error(
                '[Settings] Error al limpiar repertorio local:',
                error,
            );

            // El AppContext debería encargarse de informar errores
            // de la operación. El modal de confirmación simplemente
            // permanece abierto si la operación falla.
        }
    };

    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

    const handleCheckUpdate = async () => {
        if (isCheckingUpdate) return;

        setIsCheckingUpdate(true);

        try {
            const result = await checkAndFetchUpdate();

            switch (result) {
                case 'none':
                    Alert.alert(
                        'Sin novedades',
                        'Ya estás en la última versión.',
                    );
                    break;
                case 'available':
                    // El hook global muestra el alert de reinicio;
                    // no mostramos un segundo alert acá.
                    break;
                case 'disabled':
                    Alert.alert(
                        'No disponible',
                        'Las actualizaciones no están disponibles en modo desarrollo.',
                    );
                    break;
                case 'error':
                    Alert.alert(
                        'Error',
                        'No se pudo buscar actualizaciones. Revisá tu conexión e intentá de nuevo.',
                    );
                    break;
            }
        } finally {
            setIsCheckingUpdate(false);
        }
    };

    return (
        <ScrollView style={{ backgroundColor: COLORS.background }}>
            <View style={styles.container}>


                {/* Pedal */}
                <CardContainer title='Pedal'>

                    <SettingRow
                        icon={
                            <Wifi
                                size={21}
                                color={
                                    pedalConnected
                                        ? '#22c55e'
                                        : COLORS.accent
                                }
                            />
                        }
                        title="Pedal WiFi"
                        subtitle={wifiSubtitle}
                        onPress={() =>
                            router.push('/user/settings/pedal-wifi')
                        }
                    />

                    <View style={styles.divider} />

                    <SettingRow
                        icon={
                            <Bluetooth
                                size={21}
                                color={COLORS.accent}
                            />
                        }
                        title="Pedal Bluetooth"
                        subtitle="Configurar acciones de scroll y cambio"
                        onPress={() =>
                            router.push('/pedal-config')
                        }
                    />

                </CardContainer>

                {/* Ayuda */}
                <CardContainer title='Ayuda'>
                    <SettingRow
                        icon={
                            <HelpCircle
                                size={21}
                                color={COLORS.accent}
                            />
                        }
                        title="Guía de uso"
                        subtitle="Cómo usar la app, crear canciones y Director Mode"
                        onPress={() =>
                            router.push('/user/settings/help')
                        }
                    />
                </CardContainer>

                {/* Aplicación */}
                <CardContainer title='Aplicación'>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={handleCheckUpdate}
                        disabled={isCheckingUpdate}
                        activeOpacity={0.7}
                    >
                        <View style={styles.iconContainer}>
                            {isCheckingUpdate ? (
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.accent}
                                />
                            ) : (
                                <RefreshCw
                                    size={21}
                                    color={COLORS.accent}
                                />
                            )}
                        </View>

                        <View style={styles.rowContent}>
                            <Text style={styles.rowTitle}>
                                {isCheckingUpdate
                                    ? 'Buscando...'
                                    : 'Buscar actualizaciones'}
                            </Text>

                            <Text style={styles.rowSubtitle}>
                                {'Update: ' + (Updates.updateId?.slice(0, 8) ?? 'embebido') +
                                    '  ·  v' + (Application.nativeApplicationVersion ?? '-')}
                            </Text>

                            <Text style={[styles.rowSubtitle, { marginTop: 1 }]}>
                                {'Canal: ' + (Updates.channel ?? '-') +
                                    '  ·  ' + (Updates.createdAt?.toLocaleString() ?? '-')}
                            </Text>
                        </View>

                        {!isCheckingUpdate && (
                            <ChevronRight
                                size={20}
                                color={COLORS.mutedForeground}
                                opacity={0.6}
                            />
                        )}
                    </TouchableOpacity>

                </CardContainer>

                {/* Desarrollo */}
                {isDevelopment && (
                    <CardContainer title='Desarrollo'>
                        <SettingRow
                            icon={
                                <Bug
                                    size={21}
                                    color={COLORS.accent}
                                />
                            }
                            title="Debug"
                            subtitle="Configuración y filtros de logs"
                            onPress={() =>
                                router.push(
                                    '/user/settings/debug',
                                )
                            }
                        />
                    </CardContainer>
                )}

                {/* Avanzado */}
                <CardContainer title='Avanzado' cardStyle={styles.dangerCard}>

                    <TouchableOpacity
                        style={styles.settingRow}
                        disabled={isSyncing}
                        onPress={handleClearRepertoirePress}
                        activeOpacity={0.7}
                    >
                        <View
                            style={[
                                styles.iconContainer,
                                styles.dangerIconContainer,
                            ]}
                        >
                            {isSyncing ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#ef4444"
                                />
                            ) : (
                                <ShieldAlert
                                    size={21}
                                    color="#ef4444"
                                />
                            )}
                        </View>

                        <View style={styles.rowContent}>
                            <Text style={styles.dangerTitle}>
                                Limpiar Repertorio Local
                            </Text>

                            <Text style={styles.rowSubtitle}>
                                {isSyncing
                                    ? 'Borrando canciones...'
                                    : 'Liberar espacio de almacenamiento local.'}
                            </Text>
                        </View>

                        {!isSyncing && (
                            <ChevronRight
                                size={20}
                                color="#ef4444"
                                opacity={0.5}
                            />
                        )}
                    </TouchableOpacity>

                </CardContainer>


                {/* Confirmación: limpiar repertorio */}
                <AppModal
                    visible={isClearRepertoireModalVisible}
                    type="danger"
                    title="Limpiar Repertorio Local"
                    message="¿Estás seguro de que querés borrar todas las canciones locales de esta biblioteca? Esto limpiará la base de datos pero no afectará a Google Drive."
                    confirmText="Borrar todo"
                    cancelText="Cancelar"
                    onConfirm={handleConfirmClearRepertoire}
                    onCancel={handleCancelClearRepertoire}
                    loading={isSyncing}
                    dismissOnBackdrop={false}
                />
            </View>
        </ScrollView>
    );
}

interface SettingRowProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onPress?: () => void;
}

function SettingRow({
    icon,
    title,
    subtitle,
    onPress,
}: SettingRowProps) {
    return (
        <TouchableOpacity
            style={styles.settingRow}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.7}
        >
            <View style={styles.iconContainer}>
                {icon}
            </View>

            <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>
                    {title}
                </Text>

                <Text style={styles.rowSubtitle}>
                    {subtitle}
                </Text>
            </View>

            {onPress && (
                <ChevronRight
                    size={20}
                    color={COLORS.mutedForeground}
                    opacity={0.6}
                />
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingHorizontal: 20,
        paddingTop: 24,
    },

    header: {
        marginBottom: 30,
    },

    title: {
        color: COLORS.foreground,
        fontSize: 28,
        fontWeight: '700',
    },

    subtitle: {
        color: COLORS.mutedForeground,
        fontSize: 14,
        marginTop: 5,
    },

    section: {
        marginBottom: 24,
    },

    sectionTitle: {
        color: COLORS.mutedForeground,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    dangerCard: {
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },

    settingRow: {
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
    },

    iconContainer: {
        width: 42,
        height: 42,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },

    dangerIconContainer: {
        backgroundColor: 'rgba(239,68,68,0.1)',
    },

    rowContent: {
        flex: 1,
        paddingRight: 10,
    },

    rowTitle: {
        color: COLORS.foreground,
        fontSize: 15,
        fontWeight: '600',
    },

    rowSubtitle: {
        color: COLORS.mutedForeground,
        fontSize: 12,
        marginTop: 3,
    },

    dangerTitle: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '600',
    },

    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.border,
        marginVertical: 4,
    },




});