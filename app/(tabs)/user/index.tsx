import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    Image
} from 'react-native';
import { router } from 'expo-router';
import {
    Settings,
    LogOut,
    ChevronRight,
    KeyRound,
    BookOpen,
    Search,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { AppHeader } from '../../../src/components/layout/AppHeader';
import { useAppContext } from '../../../src/context/AppContext';
import { useUserContext } from '../../../src/context/UserContext';
import { COLORS } from '../../../src/constants/theme';
import { authService } from '../../../src/services/AuthService';

import packageJson from '../../../package.json';
import AppModal from '../../../src/components/common/AppModal';
import CardContainer from '@/src/components/common/CardContainer';

const APP_VERSION =
    Constants.expoConfig?.version ||
    packageJson.version ||
    '1.1.0';

export default function UserTab() {
    const insets = useSafeAreaInsets();

    const {
        isSyncing,
        handleSync,
        setIsLibrariesOpen,
        activeLibrary,
        driveFolderId,
        handleSaveConfig,
        openFolderPicker,
        isLoadingFolders,
    } = useAppContext();

    const {
        user,
        signOut,
    } = useUserContext();

    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const [errorModal, setErrorModal] = useState<{
        visible: boolean;
        message: string;
    }>({
        visible: false,
        message: '',
    });

    const showError = (message: string) => {
        setErrorModal({
            visible: true,
            message,
        });
    };

    const handleCloseError = () => {
        setErrorModal({
            visible: false,
            message: '',
        });
    };

    const handleGoogleSignIn = async () => {
        if (isAuthLoading) return;

        setIsAuthLoading(true);

        try {
            await authService.signInWithGoogle();
        } catch (e) {
            console.error('[User] Error al iniciar sesión:', e);

            showError(
                'No se pudo iniciar sesión con Google.'
            );
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleSignOut = async () => {
        if (isAuthLoading) return;

        setIsAuthLoading(true);

        try {
            await signOut();
        } catch (e) {
            console.error('[User] Error al cerrar sesión:', e);

            showError(
                'No se pudo cerrar sesión.'
            );
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleOpenSettings = () => {
        router.push('/user/settings');
    };

    return (
        <View style={styles.container}>
            <AppHeader
                title="Perfil"
                isSyncing={isSyncing}
                onSync={handleSync}
                hasUser={!!user}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingBottom: insets.bottom + 20,
                    },
                ]}
            >
                {/* Perfil del usuario */}
                <View style={styles.glassCard}>
                    {user ? (
                        <>
                            <View style={styles.profileHeader}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {user?.email?.[0]?.toUpperCase() || 'U'}
                                    </Text>
                                </View>

                                <View style={styles.profileInfo}>
                                    <Text style={styles.userName}>
                                        {user?.user_metadata?.full_name ||
                                            user?.email?.split('@')[0] ||
                                            'Usuario'}
                                    </Text>

                                    <Text style={styles.userEmail}>
                                        {user?.email}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.logoutBtn}
                                onPress={handleSignOut}
                                disabled={isAuthLoading}
                                activeOpacity={0.8}
                            >
                                {isAuthLoading ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#ef4444"
                                    />
                                ) : (
                                    <LogOut
                                        size={18}
                                        color="#ef4444"
                                    />
                                )}

                                <Text style={styles.logoutBtnText}>
                                    {isAuthLoading
                                        ? 'Cerrando sesión...'
                                        : 'Cerrar Sesión'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={styles.noUserContainer}>
                            <KeyRound
                                size={40}
                                color={COLORS.accent}
                                style={styles.loginIcon}
                            />

                            <Text style={styles.noUserTitle}>
                                Iniciá Sesión
                            </Text>

                            <Text style={styles.noUserText}>
                                Para sincronizar tus canciones y acceder a
                                funciones online.
                            </Text>

                            <TouchableOpacity
                                style={[
                                    styles.loginBtn,
                                    isAuthLoading && styles.disabledBtn,
                                ]}
                                onPress={handleGoogleSignIn}
                                disabled={isAuthLoading}
                                activeOpacity={0.8}
                            >
                                {isAuthLoading ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#fff"
                                    />
                                ) : (
                                    <Text style={styles.loginBtnText}>
                                        Iniciar Sesión con Google
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Repertorio */}
                <Text style={styles.sectionTitle}>
                    Repertorio
                </Text>

                <View style={styles.glassCard}>
                    <View style={styles.repertoireRow}>
                        <View style={styles.settingRowIcon}>
                            <BookOpen
                                size={20}
                                color={activeLibrary?.color || COLORS.accent}
                            />
                        </View>

                        <View style={styles.settingRowInfo}>
                            <Text style={styles.settingRowTitle}>
                                Biblioteca Activa
                            </Text>
                            <Text style={styles.settingRowSubtitle}>
                                {activeLibrary?.name || 'Cargando...'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setIsLibrariesOpen(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.actionButtonText}>
                                Administrar
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.settingRowTitle}>
                        Carpeta de Canciones
                    </Text>

                    <View style={styles.folderRow}>
                        <TextInput
                            style={styles.input}
                            value={driveFolderId}
                            onChangeText={handleSaveConfig}
                            placeholder="ID de la carpeta Drive..."
                            placeholderTextColor={COLORS.mutedForeground}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <TouchableOpacity
                            style={[
                                styles.browseButton,
                                (!user || isLoadingFolders) && styles.disabledBtn,
                            ]}
                            onPress={() => openFolderPicker()}
                            disabled={!user || isLoadingFolders}
                            activeOpacity={0.7}
                        >
                            {isLoadingFolders ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Search size={18} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Configuración */}
                <Text style={styles.sectionTitle}>
                    Aplicación
                </Text>

                <View style={styles.glassCard}>
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={handleOpenSettings}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingRowIcon}>
                            <Settings
                                size={20}
                                color={COLORS.accent}
                            />
                        </View>

                        <View style={styles.settingRowInfo}>
                            <Text style={styles.settingRowTitle}>
                                Configuración
                            </Text>

                            <Text style={styles.settingRowSubtitle}>
                                Pedal, actualizaciones y opciones avanzadas
                            </Text>
                        </View>

                        <ChevronRight
                            size={20}
                            color={COLORS.mutedForeground}
                        />
                    </TouchableOpacity>
                </View>

                {/* Información de la aplicación */}
                <View >
                    <View style={styles.footerContainer}>
                        <Image
                            source={require('@/assets/app-icon-selah.png')}
                            style={styles.footerAppIcon}
                        />

                        <Text style={styles.footerVersion}>
                            Versión {APP_VERSION}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            <AppModal
                visible={errorModal.visible}
                type="danger"
                title="Error"
                message={errorModal.message}
                confirmText="Aceptar"
                onConfirm={handleCloseError}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    content: {
        padding: 20,
        gap: 10,
    },

    glassCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },

    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 15,
    },

    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },

    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },

    profileInfo: {
        flex: 1,
    },

    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.foreground,
    },

    userEmail: {
        fontSize: 14,
        color: COLORS.mutedForeground,
        marginTop: 2,
    },

    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },

    logoutBtnText: {
        color: '#ef4444',
        fontWeight: 'bold',
        fontSize: 14,
    },

    noUserContainer: {
        alignItems: 'center',
        paddingVertical: 10,
    },

    loginIcon: {
        marginBottom: 15,
    },

    noUserTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.foreground,
        marginBottom: 5,
    },

    noUserText: {
        fontSize: 13,
        color: COLORS.mutedForeground,
        textAlign: 'center',
        marginBottom: 20,
    },

    loginBtn: {
        backgroundColor: COLORS.accent,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
    },

    disabledBtn: {
        opacity: 0.7,
    },

    loginBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },

    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.mutedForeground,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 5,
        marginBottom: 10,
        marginTop: 10,
    },

    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    settingRowIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },

    settingRowInfo: {
        flex: 1,
    },

    settingRowTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.foreground,
        marginBottom: 2,
    },

    settingRowSubtitle: {
        fontSize: 12,
        color: COLORS.mutedForeground,
    },

    repertoireRow: {
        flexDirection: 'row',
        alignItems: 'center',
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

    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.border,
        marginVertical: 14,
    },

    folderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
    },

    input: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        color: COLORS.foreground,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        fontSize: 12,
    },

    browseButton: {
        backgroundColor: COLORS.accent,
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },

    footerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 10,
        paddingVertical: 10,
    },

    footerAppName: {
        fontSize: 13,
        fontWeight: 'bold',
        color: COLORS.mutedForeground,
        marginBottom: 2,
    },
    footerAppIcon: {
        width: 86,
        height: 86,
        borderRadius: 12, // Bordes redondeados modernos estilo app
        marginBottom: 8,
        resizeMode: 'contain',
    },

    footerVersion: {
        fontSize: 12,
        color: COLORS.mutedForeground,
    },
});