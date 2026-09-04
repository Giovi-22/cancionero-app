import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
    Settings,
    LogOut,
    ChevronRight,
    KeyRound,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { AppHeader } from '../../../src/components/layout/AppHeader';
import { useAppContext } from '../../../src/context/AppContext';
import { COLORS } from '../../../src/constants/theme';
import { authService } from '../../../src/services/AuthService';


import packageJson from '../../../package.json';
import AppModal from '../../../src/components/common/AppModal';

const APP_VERSION =
    Constants.expoConfig?.version ||
    packageJson.version ||
    '1.1.0';

export default function UserTab() {
    const insets = useSafeAreaInsets();

    const {
        user,
        isSyncing,
        handleSync,
    } = useAppContext();

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
            await authService.signOut();
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
                                Biblioteca, pedal y opciones avanzadas
                            </Text>
                        </View>

                        <ChevronRight
                            size={20}
                            color={COLORS.mutedForeground}
                        />
                    </TouchableOpacity>
                </View>

                {/* Información de la aplicación */}
                <View style={styles.footerContainer}>
                    <Text style={styles.footerAppName}>
                        Cancionero Mobile
                    </Text>

                    <Text style={styles.footerVersion}>
                        Versión {APP_VERSION}
                    </Text>
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

    footerVersion: {
        fontSize: 12,
        color: COLORS.mutedForeground,
    },
});
