import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from 'react-native';
import { 
  SafeAreaProvider, 
  useSafeAreaInsets 
} from 'react-native-safe-area-context';
import { 
  Music, 
  List, 
  Settings as SettingsIcon, 
  RefreshCcw, 
  User as UserIcon,
  X,
  Folder,
  ChevronRight,
  Search,
  Users
} from 'lucide-react-native';
import { supabase } from './src/lib/supabase';
import { authService } from './src/services/AuthService';
import { SyncService } from './src/services/SyncService';
import { StorageService } from './src/services/StorageService';
import { DriveService } from './src/services/DriveService';
import { SongList } from './src/components/SongList';
import { SetlistList } from './src/components/SetlistList';
import { SongMetadata } from './src/types';

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333'
};

function MainApp() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'songs' | 'setlists'>('songs');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  
  // Datos
  const [songs, setSongs] = useState<SongMetadata[]>([]);
  const [setlists, setSetlists] = useState<any[]>([]);

  // Estado para el explorador de carpetas
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [navigationStack, setNavigationStack] = useState<any[]>([{ id: 'root', name: 'Mi unidad' }]);
  const [showShared, setShowShared] = useState(false);

  useEffect(() => {
    loadInitialData();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadInitialData = async () => {
    const savedFolderId = await StorageService.getSetting<string>('drive_folder_id');
    setDriveFolderId(savedFolderId || process.env.EXPO_PUBLIC_DRIVE_FOLDER_ID || '');
    
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    
    refreshLocalData();
  };

  const refreshLocalData = async () => {
    const localSongs = await StorageService.getAllSongs();
    setSongs(localSongs);
    const localSetlists = await StorageService.getAllSetlists();
    setSetlists(localSetlists);
  };

  const handleSaveConfig = async (newFolderId: string) => {
    setDriveFolderId(newFolderId);
    await StorageService.saveSetting('drive_folder_id', newFolderId);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await SyncService.syncFullRepertoire(driveFolderId);
      await refreshLocalData();
      Alert.alert('Éxito', 'Sincronización completada');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'No se pudo sincronizar: ' + (error as any).message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Lógica del Explorador de Carpetas
  const openFolderPicker = async (parentId: string = 'root', folderName: string = 'Mi unidad', shared: boolean = false) => {
    setIsLoadingFolders(true);
    setIsFolderPickerOpen(true);
    setShowShared(shared);
    try {
      const folderList = await DriveService.listFolders(parentId, shared);
      setFolders(folderList);
      if (parentId === 'root') {
        setNavigationStack([{ id: 'root', name: shared ? 'Compartidos' : 'Mi unidad' }]);
      } else {
        setNavigationStack([...navigationStack, { id: parentId, name: folderName }]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las carpetas de Drive');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const navigateBack = () => {
    if (navigationStack.length <= 1) return;
    const newStack = [...navigationStack];
    newStack.pop();
    const prevFolder = newStack[newStack.length - 1];
    setNavigationStack(newStack);
    openFolderPicker(prevFolder.id, prevFolder.name, showShared && newStack.length === 1);
  };

  const selectFolder = (id: string) => {
    handleSaveConfig(id);
    setIsFolderPickerOpen(false);
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="light" />
        
        {/* Header */}
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
                <SettingsIcon size={24} color={COLORS.foreground} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenido Principal */}
        <View style={styles.content}>
          {activeTab === 'songs' ? (
            <SongList 
              songs={songs} 
              onSongPress={(song) => console.log('Open song', song)} 
              onSyncPress={handleSync}
            />
          ) : (
            <SetlistList 
              setlists={setlists}
              onSetlistPress={(setlist) => console.log('Open setlist', setlist)}
              onCreatePress={() => console.log('Create setlist')}
            />
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'songs' && styles.activeTab]}
            onPress={() => setActiveTab('songs')}
          >
            <Music size={20} color={activeTab === 'songs' ? COLORS.accent : COLORS.mutedForeground} />
            <Text style={[styles.tabText, activeTab === 'songs' && styles.activeTabText]}>Canciones</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'setlists' && styles.activeTab]}
            onPress={() => setActiveTab('setlists')}
          >
            <List size={20} color={activeTab === 'setlists' ? COLORS.accent : COLORS.mutedForeground} />
            <Text style={[styles.tabText, activeTab === 'setlists' && styles.activeTabText]}>Listas</Text>
          </TouchableOpacity>
        </View>

        {/* Panel de Ajustes */}
        {isSettingsOpen && (
          <View style={[styles.settingsPanel, { bottom: insets.bottom + 60 }]}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Configuración</Text>
              <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                <X size={24} color={COLORS.foreground} />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.settingsScroll} keyboardShouldPersistTaps="handled">
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
        )}

        {/* Explorador de Carpetas Drive */}
        {isFolderPickerOpen && (
          <View style={[styles.pickerOverlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Seleccionar Carpeta</Text>
                <TouchableOpacity onPress={() => setIsFolderPickerOpen(false)}>
                  <X size={24} color={COLORS.foreground} />
                </TouchableOpacity>
              </View>

              {/* Selector Mi unidad / Compartidos */}
              <View style={styles.pickerTabs}>
                <TouchableOpacity 
                  style={[styles.pickerTab, !showShared && styles.activePickerTab]}
                  onPress={() => openFolderPicker('root', 'Mi unidad', false)}
                >
                  <Folder size={18} color={!showShared ? COLORS.accent : COLORS.mutedForeground} />
                  <Text style={[styles.pickerTabText, !showShared && styles.activePickerTabText]}>Mi unidad</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.pickerTab, showShared && styles.activePickerTab]}
                  onPress={() => openFolderPicker('root', 'Compartidos', true)}
                >
                  <Users size={18} color={showShared ? COLORS.accent : COLORS.mutedForeground} />
                  <Text style={[styles.pickerTabText, showShared && styles.activePickerTabText]}>Compartidos</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.breadcrumb}>
                <Text style={styles.breadcrumbText} numberOfLines={1}>
                  {navigationStack.map(f => f.name).join(' > ')}
                </Text>
              </View>

              {isLoadingFolders ? (
                <ActivityIndicator style={{ flex: 1 }} color={COLORS.accent} />
              ) : (
                <ScrollView style={styles.folderList} keyboardShouldPersistTaps="handled">
                  {navigationStack.length > 1 && (
                    <TouchableOpacity 
                      style={styles.folderItem} 
                      onPress={navigateBack}
                      delayPressIn={100}
                    >
                      <Folder size={24} color={COLORS.mutedForeground} />
                      <Text style={styles.folderName}>.. (Volver)</Text>
                    </TouchableOpacity>
                  )}
                  {folders.map(folder => (
                    <View key={folder.id} style={styles.folderItemRow}>
                      <TouchableOpacity 
                        style={styles.folderInfo}
                        onPress={() => openFolderPicker(folder.id, folder.name, showShared)}
                        delayPressIn={100}
                      >
                        <Folder size={24} color={COLORS.accent} />
                        <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.selectButton}
                        onPress={() => selectFolder(folder.id)}
                      >
                        <ChevronRight size={24} color={COLORS.accent} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {folders.length === 0 && (
                    <Text style={styles.emptyText}>No hay subcarpetas aquí.</Text>
                  )}
                </ScrollView>
              )}
              
              <View style={styles.pickerFooter}>
                <Text style={styles.pickerHelp}>Toca el nombre para entrar, la flecha para elegir.</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTab: {
    borderTopWidth: 2,
    borderTopColor: COLORS.accent,
  },
  tabText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  settingsPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  settingsScroll: {
    paddingBottom: 20,
  },
  settingGroup: {
    marginBottom: 25,
  },
  settingLabel: {
    color: COLORS.foreground,
    fontSize: 16,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    color: COLORS.foreground,
    fontSize: 14,
  },
  browseButton: {
    backgroundColor: COLORS.accent,
    padding: 12,
    borderRadius: 8,
    marginLeft: 10,
  },
  settingHelp: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 6,
  },
  userInfo: {
    marginTop: 10,
    padding: 15,
    backgroundColor: COLORS.background,
    borderRadius: 10,
  },
  userEmailLabel: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginBottom: 4,
  },
  userName: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 15,
  },
  signOutButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: '#ff4444',
    fontWeight: 'bold',
  },
  googleButton: {
    backgroundColor: COLORS.accent,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Picker Styles
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    zIndex: 1000,
  },
  pickerContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  pickerTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 4,
    marginBottom: 15,
  },
  pickerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  activePickerTab: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerTabText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
    fontWeight: '500',
  },
  activePickerTabText: {
    color: COLORS.accent,
  },
  breadcrumb: {
    padding: 10,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 15,
  },
  breadcrumbText: {
    color: COLORS.accent,
    fontSize: 12,
  },
  folderList: {
    flex: 1,
  },
  folderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  folderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  folderName: {
    color: COLORS.foreground,
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
  },
  selectButton: {
    padding: 15,
  },
  emptyText: {
    color: COLORS.mutedForeground,
    textAlign: 'center',
    marginTop: 50,
  },
  pickerFooter: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pickerHelp: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    textAlign: 'center',
  }
});
