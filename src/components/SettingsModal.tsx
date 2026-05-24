import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { X, Search, User as UserIcon, BookOpen } from 'lucide-react-native';
import { useAppContext } from '../context/AppContext';
import { authService } from '../services/AuthService';
import { COLORS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SettingsModalProps {
  onOpenLibraries: () => void;
}

export const SettingsModal = ({ onOpenLibraries }: SettingsModalProps) => {
  const insets = useSafeAreaInsets();
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    driveFolderId,
    handleSaveConfig,
    openFolderPicker,
    user,
    activeLibrary
  } = useAppContext();

  if (!isSettingsOpen) return null;

  return (
    <View style={[styles.settingsPanel, { bottom: insets.bottom + 80 }]}>
      <View style={styles.settingsHeader}>
        <Text style={styles.settingsTitle}>Configuración</Text>
        <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
          <X size={24} color={COLORS.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.settingsScroll} keyboardShouldPersistTaps="handled">
        {/* Sección de Biblioteca Activa */}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>Biblioteca Activa</Text>
          <View style={styles.libraryContainer}>
            <View style={styles.libraryInfoRow}>
              <View style={[styles.libraryColorDot, { backgroundColor: activeLibrary?.color || COLORS.accent }]} />
              <Text style={styles.libraryNameText}>{activeLibrary?.name || 'Cargando...'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.manageLibrariesBtn} 
              onPress={() => {
                setIsSettingsOpen(false);
                onOpenLibraries();
              }}
            >
              <BookOpen size={16} color="#fff" />
              <Text style={styles.manageLibrariesBtnText}>Administrar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sección de Carpeta de Drive */}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>Carpeta de Canciones</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={driveFolderId}
              onChangeText={handleSaveConfig}
              placeholder="ID de la carpeta..."
              placeholderTextColor={COLORS.mutedForeground}
            />
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => openFolderPicker()}
              disabled={!user}
            >
              <Search size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.settingHelp}>
            {user ? 'Toca la lupa para elegir visualmente.' : 'Inicia sesión para explorar carpetas.'}
          </Text>
        </View>

        {/* Cuenta y Google Login */}
        {user ? (
          <View style={styles.userInfo}>
            <Text style={styles.userEmailLabel}>Cuenta activa:</Text>
            <Text style={styles.userName}>{user.email}</Text>
            <TouchableOpacity style={styles.signOutButton} onPress={() => authService.signOut()}>
              <Text style={styles.signOutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.googleButton} onPress={() => authService.signInWithGoogle()}>
            <Text style={styles.googleButtonText}>Iniciar Sesión con Google</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  settingsPanel: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    zIndex: 990,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  settingsScroll: {
    paddingBottom: 10,
  },
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginBottom: 8,
    fontWeight: '500',
  },
  libraryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  libraryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  libraryColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  libraryNameText: {
    fontSize: 16,
    color: COLORS.foreground,
    fontWeight: '600',
  },
  manageLibrariesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  manageLibrariesBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.foreground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
  },
  browseButton: {
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    width: 45,
    borderRadius: 8,
  },
  settingHelp: {
    fontSize: 11,
    color: COLORS.mutedForeground,
    marginTop: 5,
  },
  userInfo: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  userEmailLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 2,
  },
  userName: {
    fontSize: 14,
    color: COLORS.foreground,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  googleButtonText: {
    color: '#white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
