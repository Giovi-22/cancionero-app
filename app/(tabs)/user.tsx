import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { AppHeader } from '../../src/components/layout/AppHeader';
import { useAppContext } from '../../src/context/AppContext';
import { COLORS } from '../../src/constants/theme';
import { Settings, LogOut, BookOpen, Search, AlertTriangle, Bluetooth, ShieldAlert, KeyRound } from 'lucide-react-native';
import { authService } from '../../src/services/AuthService';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UserTab() {
    const insets = useSafeAreaInsets();
    const { 
        user, 
        isSyncing, 
        handleSync, 
        setIsLibrariesOpen,
        activeLibrary,
        driveFolderId,
        handleSaveConfig,
        openFolderPicker,
        handleClearRepertoire
    } = useAppContext();

    return (
        <View style={styles.container}>
            <AppHeader
                title="Configuración"
                isSyncing={isSyncing}
                onSync={handleSync}
                hasUser={!!user}
            />
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
                
                {/* Perfil del Usuario */}
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
                                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'}
                                    </Text>
                                    <Text style={styles.userEmail}>
                                        {user?.email}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                style={[styles.actionButton, styles.logoutBtn]}
                                onPress={() => authService.signOut()}
                            >
                                <LogOut size={18} color="#ef4444" />
                                <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={styles.noUserContainer}>
                            <KeyRound size={40} color={COLORS.accent} style={{ marginBottom: 15 }} />
                            <Text style={styles.noUserTitle}>Iniciá Sesión</Text>
                            <Text style={styles.noUserText}>Para sincronizar tus canciones y acceder a funciones online.</Text>
                            <TouchableOpacity 
                                style={styles.loginBtn}
                                onPress={() => authService.signInWithGoogle()}
                            >
                                <Text style={styles.loginBtnText}>Iniciar Sesión con Google</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Bibliotecas */}
                <Text style={styles.sectionTitle}>Repertorio</Text>
                <View style={styles.glassCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingRowIcon}>
                            <BookOpen size={20} color={activeLibrary?.color || COLORS.accent} />
                        </View>
                        <View style={styles.settingRowInfo}>
                            <Text style={styles.settingRowTitle}>Biblioteca Activa</Text>
                            <Text style={styles.settingRowSubtitle}>{activeLibrary?.name || 'Cargando...'}</Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.manageBtn}
                            onPress={() => setIsLibrariesOpen(true)}
                        >
                            <Text style={styles.manageBtnText}>Administrar</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.settingRow}>
                        <View style={styles.settingRowIcon}>
                            <Search size={20} color={COLORS.foreground} />
                        </View>
                        <View style={[styles.settingRowInfo, { flex: 1, paddingRight: 10 }]}>
                            <Text style={styles.settingRowTitle}>Carpeta de Canciones</Text>
                            <TextInput
                                style={styles.input}
                                value={driveFolderId}
                                onChangeText={handleSaveConfig}
                                placeholder="ID de la carpeta Drive..."
                                placeholderTextColor={COLORS.mutedForeground}
                            />
                        </View>
                        <TouchableOpacity 
                            style={styles.browseBtn}
                            onPress={() => openFolderPicker()}
                            disabled={!user}
                        >
                            <Search size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Preferencias */}
                <Text style={styles.sectionTitle}>Preferencias</Text>
                <View style={styles.glassCard}>
                    <TouchableOpacity 
                        style={[styles.settingRow, { paddingVertical: 5 }]}
                        onPress={() => router.push('/pedal-config')}
                    >
                        <View style={styles.settingRowIcon}>
                            <Bluetooth size={20} color="#3b82f6" />
                        </View>
                        <View style={styles.settingRowInfo}>
                            <Text style={styles.settingRowTitle}>Pedal Bluetooth</Text>
                            <Text style={styles.settingRowSubtitle}>Configurar acciones de scroll y cambio</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Zona de Peligro */}
                <Text style={styles.sectionTitle}>Avanzado</Text>
                <View style={[styles.glassCard, styles.dangerZone]}>
                    <TouchableOpacity 
                        style={styles.dangerRow}
                        onPress={() => {
                            Alert.alert(
                                'Limpiar Repertorio Local',
                                '¿Estás seguro de que querés borrar todas las canciones locales de esta biblioteca? Esto limpiará la base de datos pero no afectará a Google Drive.',
                                [
                                    { text: 'Cancelar', style: 'cancel' },
                                    { text: 'Borrar todo', style: 'destructive', onPress: () => handleClearRepertoire() }
                                ]
                            );
                        }}
                    >
                        <View style={[styles.settingRowIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                            <ShieldAlert size={20} color="#ef4444" />
                        </View>
                        <View style={styles.settingRowInfo}>
                            <Text style={styles.dangerTitle}>Limpiar Repertorio Local</Text>
                            <Text style={styles.dangerSubtitle}>Liberar espacio de almacenamiento local.</Text>
                        </View>
                    </TouchableOpacity>
                </View>

            </ScrollView>
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
        shadowOffset: { width: 0, height: 2 },
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
    manageBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    manageBtnText: {
        color: COLORS.foreground,
        fontSize: 12,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 15,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        color: COLORS.foreground,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        fontSize: 13,
        marginTop: 5,
    },
    browseBtn: {
        backgroundColor: COLORS.accent,
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dangerZone: {
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    dangerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dangerTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ef4444',
        marginBottom: 2,
    },
    dangerSubtitle: {
        fontSize: 12,
        color: COLORS.mutedForeground,
    },
});
