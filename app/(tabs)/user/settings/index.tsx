import React, { useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    BookOpen,
    Bluetooth,
    Bug,
    ChevronRight,
    Search,
    ShieldAlert,
} from 'lucide-react-native';
import { router } from 'expo-router';

import { COLORS } from '../../../../src/constants/theme';
import { useAppContext } from '../../../../src/context/AppContext';
import AppModal from '../../../../src/components/common/AppModal';


export default function SettingsScreen() {
    const isDevelopment = __DEV__;

    const {
        user,
        isSyncing,
        setIsLibrariesOpen,
        activeLibrary,
        driveFolderId,
        handleSaveConfig,
        openFolderPicker,
        handleClearRepertoire,
        isLoadingFolders,
    } = useAppContext();

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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>
                    Configuración
                </Text>

                <Text style={styles.subtitle}>
                    Ajustes de la aplicación
                </Text>
            </View>

            {/* Repertorio */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    Repertorio
                </Text>

                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.iconContainer}>
                            <BookOpen
                                size={21}
                                color={
                                    activeLibrary?.color ||
                                    COLORS.accent
                                }
                            />
                        </View>

                        <View style={styles.rowContent}>
                            <Text style={styles.rowTitle}>
                                Biblioteca Activa
                            </Text>

                            <Text style={styles.rowSubtitle}>
                                {activeLibrary?.name ||
                                    'Cargando...'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() =>
                                setIsLibrariesOpen(true)
                            }
                            activeOpacity={0.7}
                        >
                            <Text style={styles.actionButtonText}>
                                Administrar
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.settingRow}>
                        <View style={styles.iconContainer}>
                            <Search
                                size={21}
                                color={COLORS.foreground}
                            />
                        </View>

                        <View style={styles.rowContent}>
                            <Text style={styles.rowTitle}>
                                Carpeta de Canciones
                            </Text>

                            <TextInput
                                style={styles.input}
                                value={driveFolderId}
                                onChangeText={handleSaveConfig}
                                placeholder="ID de la carpeta Drive..."
                                placeholderTextColor={
                                    COLORS.mutedForeground
                                }
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.browseButton}
                            onPress={() => openFolderPicker()}
                            disabled={!user || isLoadingFolders}
                            activeOpacity={0.7}
                        >
                            {isLoadingFolders ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                />
                            ) : (
                                <Search
                                    size={18}
                                    color="#fff"
                                />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Preferencias */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    Preferencias
                </Text>

                <View style={styles.card}>
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
                </View>
            </View>

            {/* Avanzado */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    Avanzado
                </Text>

                <View
                    style={[
                        styles.card,
                        styles.dangerCard,
                    ]}
                >
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
                </View>
            </View>

            {/* Desarrollo */}
            {isDevelopment && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Desarrollo
                    </Text>

                    <View style={styles.card}>
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
                    </View>
                </View>
            )}

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

    actionButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 20,
    },

    actionButtonText: {
        color: COLORS.foreground,
        fontSize: 12,
        fontWeight: '600',
    },

    input: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        color: COLORS.foreground,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: COLORS.border,
        fontSize: 12,
        marginTop: 6,
    },

    browseButton: {
        backgroundColor: COLORS.accent,
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
