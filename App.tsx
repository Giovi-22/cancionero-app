import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import * as Updates from 'expo-updates';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets
} from 'react-native-safe-area-context';
import {
  Music,
  List,
  RefreshCcw,
  User as UserIcon,
  Home as HomeIcon
} from 'lucide-react-native';

import { AppContextProvider, useAppContext } from './src/context/AppContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { SongsScreen } from './src/screens/SongsScreen';
import { SetlistsScreen } from './src/screens/SetlistsScreen';
import { SettingsModal } from './src/components/SettingsModal';
import { FolderPickerModal } from './src/components/FolderPickerModal';
import { LibrarySelectorModal } from './src/components/LibrarySelectorModal';
import { CreateSetlistModal, EditSetlistModal } from './src/components/SetlistModals';
import { SongViewer } from './src/components/SongViewer';
import { COLORS } from './src/constants/theme';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function MainAppContent() {
  const insets = useSafeAreaInsets();
  const [isLibrariesOpen, setIsLibrariesOpen] = useState(false);

  const {
    user,
    activeTab,
    setActiveTab,
    isSettingsOpen,
    setIsSettingsOpen,
    isSyncing,
    handleSync,
    selectedSong,
    setSelectedSong,
    songContent,
    setSongContent,
    songSettings,
    handleSaveSongSettings,
    myDirectorSession,
    followingSession,
    handleFollowSongChange,
    setlistSongs,
    handleDirectorNext,
    handleDirectorPrev,
    setSetlistSongs
  } = useAppContext();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#0a0a0a').catch(() => { });
      NavigationBar.setVisibilityAsync('hidden').catch(() => { });
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => { });
    }
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
        <StatusBar style="light" />

        {/* Header Superior */}
        <View style={styles.header}>
          <Text style={styles.logo}>Cancionero</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <RefreshCcw size={24} color={COLORS.foreground} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                Keyboard.dismiss();
                setIsSettingsOpen(!isSettingsOpen);
              }}
            >
              {user ? (
                <UserIcon size={24} color={COLORS.accent} />
              ) : (
                <View>
                  <UserIcon size={24} color={COLORS.mutedForeground} />
                  <View style={styles.alertDot} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenido Principal según el Tab activo */}
        <View style={styles.content}>
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'songs' && <SongsScreen />}
          {activeTab === 'setlists' && <SetlistsScreen />}
        </View>

        {/* Barra de Navegación Inferior (Tabs) */}
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'home' && styles.activeTab]}
            onPress={() => setActiveTab('home')}
          >
            <HomeIcon size={22} color={activeTab === 'home' ? COLORS.accent : COLORS.mutedForeground} />
            <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>Inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'songs' && styles.activeTab]}
            onPress={() => setActiveTab('songs')}
          >
            <Music size={22} color={activeTab === 'songs' ? COLORS.accent : COLORS.mutedForeground} />
            <Text style={[styles.tabText, activeTab === 'songs' && styles.activeTabText]}>Canciones</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'setlists' && styles.activeTab]}
            onPress={() => setActiveTab('setlists')}
          >
            <List size={22} color={activeTab === 'setlists' ? COLORS.accent : COLORS.mutedForeground} />
            <Text style={[styles.tabText, activeTab === 'setlists' && styles.activeTabText]}>Listas</Text>
          </TouchableOpacity>
        </View>

        {/* Modal del Visor de Canciones */}
        <Modal
          visible={!!selectedSong}
          animationType="slide"
          onRequestClose={() => {
            setSelectedSong(null);
            setSongContent(null);
          }}
        >
          {selectedSong && songContent && (
            <SongViewer
              title={selectedSong.name}
              songId={selectedSong.id}
              content={songContent}
              onClose={() => {
                setSelectedSong(null);
                setSongContent(null);
                if (!myDirectorSession) {
                  setSetlistSongs([]);
                }
              }}
              initialSettings={songSettings}
              onSaveSettings={handleSaveSongSettings}
              isDirector={!!myDirectorSession}
              directorSessionId={myDirectorSession?.id}
              followSessionId={followingSession?.id}
              onFollowSongChange={handleFollowSongChange}
              setlistSongs={setlistSongs}
              onDirectorNext={handleDirectorNext}
              onDirectorPrev={handleDirectorPrev}
            />
          )}
        </Modal>

        {/* Modales Auxiliares Extraídos */}
        <SettingsModal onOpenLibraries={() => setIsLibrariesOpen(true)} />
        <FolderPickerModal />
        <CreateSetlistModal />
        <EditSetlistModal />
        <LibrarySelectorModal isOpen={isLibrariesOpen} onClose={() => setIsLibrariesOpen(false)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const UpdateNotification = () => {
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isUpdatePending) {
      setDismissed(false);
    }
  }, [isUpdatePending]);

  if (!isUpdatePending || dismissed) {
    return null;
  }

  const handleReload = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      Alert.alert('Error', 'No se pudo reiniciar la aplicación.');
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isUpdatePending && !dismissed}
      onRequestClose={() => setDismissed(true)}
    >
      <View style={styles.updateModalOverlay}>
        <View style={styles.updateModalCard}>
          <View style={styles.updateModalHeader}>
            <RefreshCcw size={24} color={COLORS.accent} style={{ marginRight: 10 }} />
            <Text style={styles.updateModalTitle}>Actualización Lista</Text>
          </View>
          <Text style={styles.updateModalText}>
            Una nueva versión de la aplicación ha sido descargada. ¿Querés reiniciar ahora para aplicar los cambios?
          </Text>
          <View style={styles.updateModalActions}>
            <TouchableOpacity
              style={styles.updateModalCancel}
              onPress={() => setDismissed(true)}
            >
              <Text style={styles.updateModalCancelText}>Más tarde</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.updateModalConfirm}
              onPress={handleReload}
            >
              <Text style={styles.updateModalConfirmText}>Reiniciar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: COLORS.background }}>
        <AppContextProvider>
          <MainAppContent />
          <UpdateNotification />
        </AppContextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.background,
  },
  logo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
    padding: 5,
    position: 'relative',
  },
  alertDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTab: {
    // Estilo activo para el tab
  },
  tabText: {
    fontSize: 11,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  updateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  updateModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    gap: 15,
  },
  updateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  updateModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  updateModalText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
  },
  updateModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  updateModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  updateModalCancelText: {
    color: COLORS.mutedForeground,
    fontWeight: 'bold',
  },
  updateModalConfirm: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  updateModalConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
