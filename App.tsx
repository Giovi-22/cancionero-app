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
  Keyboard,
  Modal,
  Dimensions
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
  Users,
  ArrowLeft,
  Home as HomeIcon,
  Star,
  TrendingUp,
  Clock,
  Radio,
  Wifi,
  Edit2,
  CheckSquare,
  Square,
  Plus
} from 'lucide-react-native';
import { supabase } from './src/lib/supabase';
import { authService } from './src/services/AuthService';
import { SyncService } from './src/services/SyncService';
import { StorageService } from './src/services/StorageService';
import { DriveService } from './src/services/DriveService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FileSystemService } from './src/services/FileSystemService';
import { SongList } from './src/components/SongList';
import { SetlistList } from './src/components/SetlistList';
import { SongViewer } from './src/components/SongViewer';
import { LiveSessionService, LiveSession } from './src/services/LiveSessionService';
import { SongMetadata } from './src/types';

const { width } = Dimensions.get('window');

const COLORS = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  foreground: '#ffffff',
  mutedForeground: '#a0a0a0',
  accent: '#3b82f6',
  border: '#333333',
  card: '#121212'
};

function MainApp() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'songs' | 'setlists'>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  
  // Datos
  const [songs, setSongs] = useState<SongMetadata[]>([]);
  const [topSongs, setTopSongs] = useState<SongMetadata[]>([]);
  const [setlists, setSetlists] = useState<any[]>([]);

  // Estado del Visor
  const [selectedSong, setSelectedSong] = useState<SongMetadata | null>(null);
  const [songContent, setSongContent] = useState<string | null>(null);
  const [songSettings, setSongSettings] = useState<any>(null);

  // Live Session (Modo Director)
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [myDirectorSession, setMyDirectorSession] = useState<LiveSession | null>(null);
  const [followingSession, setFollowingSession] = useState<LiveSession | null>(null);
  // Canciones de la lista activa del show (para navegación del Director)
  const [setlistSongs, setSetlistSongs] = useState<SongMetadata[]>([]);
  
  // Estado de Setlist Activa
  const [activeSetlist, setActiveSetlist] = useState<any | null>(null);

  // Modal Crear Lista
  const [isCreateSetlistOpen, setIsCreateSetlistOpen] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState('');
  const [newSetlistDate, setNewSetlistDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Modal Editar Lista (Agregar/Quitar canciones)
  const [isEditSetlistOpen, setIsEditSetlistOpen] = useState(false);
  const [editSetlistSongs, setEditSetlistSongs] = useState<string[]>([]);
  const [editSetlistName, setEditSetlistName] = useState('');
  const [editSetlistDate, setEditSetlistDate] = useState<Date | undefined>(undefined);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // Estado para el explorador de carpetas
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [navigationStack, setNavigationStack] = useState<any[]>([{ id: 'root', name: 'Mi unidad' }]);
  const [showShared, setShowShared] = useState(false);

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    loadInitialData();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
    });

    // Suscribirse a sesiones live en tiempo real
    const unsubSessions = LiveSessionService.subscribeToAllSessions((sessions) => {
      setLiveSessions(sessions);
    });

    return () => {
      authListener.subscription.unsubscribe();
      unsubSessions();
    };
  }, []);

  // Actualizar "mi sesión de director" cuando cambian las sesiones
  useEffect(() => {
    if (!user) return;
    const mine = liveSessions.find(s => s.director_email === user.email) ?? null;
    setMyDirectorSession(mine);
  }, [liveSessions, user]);

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
    const top = await StorageService.getTopSongs(5);
    setTopSongs(top);
    const localSetlists = await StorageService.getAllSetlists();
    setSetlists(localSetlists);
  };

  // ── Director: Iniciar show con una lista ──────────
  const handleStartShow = async (setlist: any) => {
    if (!user) { Alert.alert('Error', 'Debes iniciar sesión para ser director.'); return; }
    const session = await LiveSessionService.startShow(
      setlist.id, setlist.name,
      user.email,
      user.user_metadata?.full_name || user.email,
      myDirectorSession?.id
    );
    if (session) setMyDirectorSession(session);
  };

  // ── Director: Iniciar show desde setlist seleccionada (abre primera canción) ──
  const handleStartShowFromSetlist = async (setlist: any) => {
    await handleStartShow(setlist);
    const songsOfList = songs.filter(s => setlist.songIds.includes(s.id));
    setSetlistSongs(songsOfList);
    if (songsOfList.length > 0) handleSongPress(songsOfList[0]);
  };

  // ── Director: Navegar canción siguiente ───────────
  const handleDirectorNext = async () => {
    if (!selectedSong || setlistSongs.length === 0) return;
    const idx = setlistSongs.findIndex(s => s.id === selectedSong.id);
    const next = setlistSongs[idx + 1];
    if (next) handleSongPress(next);
  };

  // ── Director: Navegar canción anterior ────────────
  const handleDirectorPrev = async () => {
    if (!selectedSong || setlistSongs.length === 0) return;
    const idx = setlistSongs.findIndex(s => s.id === selectedSong.id);
    const prev = setlistSongs[idx - 1];
    if (prev) handleSongPress(prev);
  };

  // ── Director: Terminar show ───────────────────────
  const handleEndShow = async () => {
    if (!myDirectorSession) return;
    await LiveSessionService.endShow(myDirectorSession.id);
    setMyDirectorSession(null);
  };

  // ── Músico: Unirse a un show ──────────────────────
  const handleJoinSession = (session: LiveSession) => {
    setFollowingSession(session);
    // Si ya hay una canción activa, abrirla
    if (session.current_song_id) {
      const song = songs.find(s => s.id === session.current_song_id);
      if (song) handleSongPress(song);
    }
    Alert.alert('✅ Conectado', `Siguiendo a ${session.director_name}`);
  };

  const handleLeaveSession = () => {
    setFollowingSession(null);
  };

  // ── Seguidor: cuando el director cambia de canción ─
  const handleFollowSongChange = async (newSongId: string) => {
    const song = songs.find(s => s.id === newSongId);
    if (!song) return;
    const content = await FileSystemService.getSongContent(newSongId);
    if (!content) return;
    const settings = await StorageService.getSetting(`song_settings_${newSongId}`);
    setSongContent(content);
    setSongSettings(settings);
    setSelectedSong(song);
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

  const handleSongPress = async (song: SongMetadata) => {
    try {
      const content = await FileSystemService.getSongContent(song.id);
      if (!content) {
        Alert.alert('Error', 'No se encontró el contenido de la canción. Intenta sincronizar de nuevo.');
        return;
      }
      
      // Incrementar contador de reproducciones
      await StorageService.incrementSongViewCount(song.id);
      
      const settings = await StorageService.getSetting(`song_settings_${song.id}`);
      
      setSongContent(content);
      setSongSettings(settings);
      setSelectedSong(song);
      
      // Refrescar top para cuando vuelva
      refreshLocalData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la canción.');
    }
  };

  const handleSetlistPress = (setlist: any) => {
    setActiveSetlist(setlist);
    setActiveTab('songs');
  };

  const handleDeleteSetlist = async (setlist: any) => {
    await StorageService.deleteSetlistLocal(setlist.id);
    await refreshLocalData();
  };

  const handleCreateSetlist = async () => {
    let name = newSetlistName.trim();
    if (!name) return;
    
    // Si hay fecha, agregarla al nombre
    const dateStr = newSetlistDate ? formatDate(newSetlistDate.toISOString()) : null;
    const finalName = dateStr ? `${name} - ${dateStr}` : name;

    const newSetlist = {
      id: `local_${Date.now()}`,
      name: finalName,
      date: newSetlistDate ? newSetlistDate.toISOString() : undefined,
      songIds: [],
      isPublic: false,
    };
    await StorageService.saveSetlist(newSetlist);
    await refreshLocalData();
    setNewSetlistName('');
    setNewSetlistDate(undefined);
    setIsCreateSetlistOpen(false);
    Keyboard.dismiss();
  };

  const handleOpenEditSetlist = () => {
    if (!activeSetlist) return;
    setEditSetlistName(activeSetlist.name);
    setEditSetlistDate(activeSetlist.date ? new Date(activeSetlist.date) : undefined);
    setEditSetlistSongs([...activeSetlist.songIds]);
    setIsEditSetlistOpen(true);
  };

  const handleToggleSongInSetlist = (songId: string) => {
    setEditSetlistSongs(prev => 
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleRemoveSongFromSetlist = async (songId: string) => {
    if (!activeSetlist) return;
    const newSongIds = activeSetlist.songIds.filter((id: string) => id !== songId);
    const updated = { ...activeSetlist, songIds: newSongIds };
    await StorageService.saveSetlist(updated);
    setActiveSetlist(updated);
    await refreshLocalData();
  };

  const handleSaveSetlistSongs = async () => {
    if (!activeSetlist) return;
    
    let name = editSetlistName.trim();
    // Limpiar fecha previa si existe para no duplicar (asumiendo formato " - dd/mm/aa")
    name = name.split(' - ')[0];
    
    const dateStr = editSetlistDate ? formatDate(editSetlistDate.toISOString()) : null;
    const finalName = dateStr ? `${name} - ${dateStr}` : name;

    const updated = { 
      ...activeSetlist, 
      name: finalName,
      date: editSetlistDate ? editSetlistDate.toISOString() : undefined,
      songIds: editSetlistSongs 
    };
    await StorageService.saveSetlist(updated);
    setActiveSetlist(updated);
    setIsEditSetlistOpen(false);
    await refreshLocalData();
  };

  const handleSaveSongSettings = async (settings: any) => {
    if (selectedSong) {
      await StorageService.saveSetting(`song_settings_${selectedSong.id}`, settings);
    }
  };

  // Filtrar canciones si hay una lista activa
  const displaySongs = activeSetlist 
    ? songs.filter(s => activeSetlist.songIds.includes(s.id))
    : songs;

  // Lógica del Explorador de Carpetas Drive
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
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
                <View>
                  <UserIcon size={24} color={COLORS.mutedForeground} />
                  <View style={styles.alertDot} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenido Principal */}
        <View style={styles.content}>
          {activeTab === 'home' && (
            <ScrollView style={styles.homeContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.welcomeSection}>
                <Text style={styles.welcomeTitle}>
                  ¡Hola, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Invitado'}!
                </Text>
                {!user ? (
                  <View style={styles.connectionWarning}>
                    <Text style={styles.connectionWarningText}>Sin conexión a Google Drive</Text>
                  </View>
                ) : (
                  <Text style={styles.welcomeSub}>¿Qué vamos a tocar hoy?</Text>
                )}
              </View>

              {/* Banner Show en Vivo - DIRECTOR (clickeable → canción actual) */}
              {myDirectorSession && (
                <TouchableOpacity
                  style={styles.directorBanner}
                  onPress={async () => {
                    const curId = myDirectorSession.current_song_id;
                    if (!curId) return;
                    const song = songs.find(s => s.id === curId);
                    if (song) handleSongPress(song);
                  }}
                >
                  <View style={styles.bannerLeft}>
                    <Radio size={18} color="#fff" />
                    <View>
                      <Text style={styles.bannerTitle}>🎬 Show en Vivo · {myDirectorSession.setlist_name}</Text>
                      <Text style={styles.bannerSub}>
                        {myDirectorSession.current_song_id
                          ? `▶ ${songs.find(s => s.id === myDirectorSession.current_song_id)?.name || 'Cargando...'}`
                          : 'Toca para abrir la canción actual'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={handleEndShow} style={styles.endShowBtn}>
                    <Text style={styles.endShowText}>Terminar</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}

              {/* Otros shows activos para unirse (también clickeables) */}
              {liveSessions.filter(s => s.director_email !== user?.email).map(session => (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.directorBanner, styles.followerBanner]}
                  onPress={() => handleJoinSession(session)}
                >
                  <View style={styles.bannerLeft}>
                    <Wifi size={18} color="#fff" />
                    <View>
                      <Text style={styles.bannerTitle}>📡 {session.setlist_name}</Text>
                      <Text style={styles.bannerSub}>
                        {followingSession?.id === session.id
                          ? `Siguiendo · ${songs.find(s => s.id === session.current_song_id)?.name || '...'}`
                          : `Director: ${session.director_name} · Toca para unirte`}
                      </Text>
                    </View>
                  </View>
                  {followingSession?.id === session.id && (
                    <TouchableOpacity onPress={handleLeaveSession} style={styles.endShowBtn}>
                      <Text style={styles.endShowText}>Salir</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}

              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statCard} onPress={() => setActiveTab('songs')}>
                  <Music size={24} color={COLORS.accent} />
                  <Text style={styles.statValue}>{songs.length}</Text>
                  <Text style={styles.statLabel}>Canciones</Text>
                </TouchableOpacity>
                <View style={styles.statCard}>
                  <List size={24} color="#10b981" />
                  <Text style={styles.statValue}>{setlists.length}</Text>
                  <Text style={styles.statLabel}>Listas</Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <TrendingUp size={20} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>Más Elegidas</Text>
              </View>
              
              <View style={styles.topSongsList}>
                {topSongs.map((song, index) => (
                  <TouchableOpacity 
                    key={song.id} 
                    style={styles.topSongItem}
                    onPress={() => handleSongPress(song)}
                  >
                    <View style={styles.topSongRank}>
                      <Text style={styles.topSongRankText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.topSongName} numberOfLines={1}>{song.name}</Text>
                    <ChevronRight size={18} color={COLORS.mutedForeground} />
                  </TouchableOpacity>
                ))}
                {topSongs.length === 0 && (
                  <Text style={styles.emptyText}>Sincroniza tus canciones para empezar.</Text>
                )}
              </View>

              <View style={styles.sectionHeader}>
                <Star size={20} color="#fbbf24" />
                <Text style={styles.sectionTitle}>Listas Recientes</Text>
              </View>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentSetlists}>
                {setlists.slice(0, 5).map((setlist) => (
                  <View key={setlist.id} style={styles.setlistCard}>
                    <TouchableOpacity onPress={() => handleSetlistPress(setlist)}>
                      <View style={styles.setlistCardIcon}>
                        <List size={24} color="#fff" />
                      </View>
                      <Text style={styles.setlistCardName} numberOfLines={2}>
                        {setlist.name}
                      </Text>
                      <Text style={styles.setlistCardCount}>{setlist.songIds.length} temas</Text>
                    </TouchableOpacity>
                    {user && (
                      <TouchableOpacity
                        style={[styles.startShowBtn, myDirectorSession?.setlist_id === setlist.id && styles.startShowBtnActive]}
                        onPress={() => handleStartShow(setlist)}
                      >
                        <Radio size={12} color="#fff" />
                        <Text style={styles.startShowText}>
                          {myDirectorSession?.setlist_id === setlist.id ? 'En Vivo' : 'Iniciar'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </ScrollView>
          )}

          {activeTab === 'songs' && (
            <View style={{ flex: 1 }}>
              {activeSetlist && (
                <View style={styles.activeSetlistHeader}>
                  <TouchableOpacity onPress={() => { setActiveSetlist(null); setActiveTab('setlists'); }} style={styles.closeSetlistBtn}>
                    <ArrowLeft size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.activeSetlistTitle} numberOfLines={1}>
                    {activeSetlist.name}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    <TouchableOpacity onPress={handleOpenEditSetlist} style={styles.editSetlistBtn}>
                      <Plus size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleOpenEditSetlist} style={styles.editSetlistBtn}>
                      <Edit2 size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {user && (
                    <TouchableOpacity
                      style={[styles.startShowHeaderBtn, myDirectorSession?.setlist_id === activeSetlist.id && styles.startShowHeaderBtnActive]}
                      onPress={() => handleStartShowFromSetlist(activeSetlist)}
                    >
                      <Radio size={14} color="#fff" />
                      <Text style={styles.startShowHeaderText}>
                        {myDirectorSession?.setlist_id === activeSetlist.id ? 'En Vivo' : 'Iniciar Show'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <SongList 
                songs={displaySongs} 
                onSongPress={handleSongPress} 
                onSyncPress={handleSync}
                isSetlistMode={!!activeSetlist}
                onRemoveFromSetlist={activeSetlist ? handleRemoveSongFromSetlist : undefined}
                onAddSongsPress={handleOpenEditSetlist}
              />
            </View>
          )}

          {activeTab === 'setlists' && (
            <SetlistList 
              setlists={setlists}
              onSetlistPress={handleSetlistPress}
              onCreatePress={() => setIsCreateSetlistOpen(true)}
              onDeleteSetlist={handleDeleteSetlist}
            />
          )}
        </View>

        {/* Tabs - Con mejor diseño y padding inferior para Android */}
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
          onRequestClose={() => setSelectedSong(null)}
        >
          {selectedSong && songContent && (
            <SongViewer 
              title={selectedSong.name}
              songId={selectedSong.id}
              content={songContent}
              onClose={() => {
                setSelectedSong(null);
                setSongContent(null);
              }}
              initialSettings={songSettings}
              onSaveSettings={handleSaveSongSettings}
              isDirector={!!myDirectorSession}
              directorSessionId={myDirectorSession?.id}
              followSessionId={followingSession?.id}
              onFollowSongChange={handleFollowSongChange}
              // Navegación de lista para el Director
              setlistSongs={setlistSongs}
              onDirectorNext={handleDirectorNext}
              onDirectorPrev={handleDirectorPrev}
            />
          )}
        </Modal>

        {/* Panel de Ajustes */}
        {isSettingsOpen && (
          <View style={[styles.settingsPanel, { bottom: insets.bottom + 80 }]}>
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
            </View>
          </View>
        )}

        {/* Modal Crear Lista */}
        <Modal
          visible={isCreateSetlistOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCreateSetlistOpen(false)}
        >
          <View style={styles.createModalOverlay}>
            <View style={styles.createModalCard}>
              <Text style={styles.createModalTitle}>Nueva Lista</Text>
              <TextInput
                style={styles.createModalInput}
                placeholder="Nombre de la lista..."
                placeholderTextColor={COLORS.mutedForeground}
                value={newSetlistName}
                onChangeText={setNewSetlistName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateSetlist}
              />
              <TouchableOpacity 
                style={styles.datePickerBtn} 
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.datePickerText}>
                  {newSetlistDate 
                    ? `Fecha: ${formatDate(newSetlistDate.toISOString())}` 
                    : 'Añadir Fecha (Opcional)'}
                </Text>
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={newSetlistDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setNewSetlistDate(selectedDate);
                  }}
                />
              )}
              <View style={styles.createModalActions}>
                <TouchableOpacity
                  style={styles.createModalCancel}
                  onPress={() => setIsCreateSetlistOpen(false)}
                >
                  <Text style={styles.createModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createModalConfirm, !newSetlistName.trim() && { opacity: 0.5 }]}
                  onPress={handleCreateSetlist}
                  disabled={!newSetlistName.trim()}
                >
                  <Text style={styles.createModalConfirmText}>Crear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Editar Lista (Agregar/Quitar Canciones) */}
        <Modal
          visible={isEditSetlistOpen}
          animationType="slide"
          onRequestClose={() => setIsEditSetlistOpen(false)}
        >
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Editar Lista</Text>
              <TouchableOpacity onPress={() => setIsEditSetlistOpen(false)} style={{ padding: 5 }}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, backgroundColor: COLORS.surface }}>
              <TextInput
                style={styles.createModalInput}
                placeholder="Nombre de la lista..."
                placeholderTextColor={COLORS.mutedForeground}
                value={editSetlistName}
                onChangeText={setEditSetlistName}
              />
              <TouchableOpacity 
                style={styles.datePickerBtn} 
                onPress={() => setShowEditDatePicker(true)}
              >
                <Text style={styles.datePickerText}>
                  {editSetlistDate 
                    ? `Fecha: ${formatDate(editSetlistDate.toISOString())}` 
                    : 'Añadir Fecha (Opcional)'}
                </Text>
              </TouchableOpacity>
              
              {showEditDatePicker && (
                <DateTimePicker
                  value={editSetlistDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowEditDatePicker(false);
                    if (selectedDate) setEditSetlistDate(selectedDate);
                  }}
                />
              )}
            </View>

            <ScrollView style={styles.editModalList} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
              {songs.map(song => {
                const isSelected = editSetlistSongs.includes(song.id);
                return (
                  <TouchableOpacity
                    key={song.id}
                    style={[styles.editModalItem, isSelected && styles.editModalItemActive]}
                    onPress={() => handleToggleSongInSetlist(song.id)}
                  >
                    <View style={styles.editModalItemInfo}>
                      <Text style={[styles.editModalItemName, isSelected && styles.editModalItemNameActive]}>
                        {song.name}
                      </Text>
                    </View>
                    {isSelected ? (
                      <CheckSquare size={24} color={COLORS.accent} />
                    ) : (
                      <Square size={24} color={COLORS.mutedForeground} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.editModalFooter}>
              <TouchableOpacity style={styles.editModalSaveBtn} onPress={handleSaveSetlistSongs}>
                <Text style={styles.editModalSaveBtnText}>Guardar Lista</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
    // borderTopWidth: 2,
    // borderTopColor: COLORS.accent,
  },
  tabText: {
    fontSize: 10,
    color: COLORS.mutedForeground,
    marginTop: 4,
    fontWeight: '600',
  },
  activeTabText: {
    color: COLORS.accent,
  },
  // Home Styles
  homeContainer: {
    flex: 1,
    padding: 20,
  },
  welcomeSection: {
    marginBottom: 25,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  welcomeSub: {
    fontSize: 16,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  connectionWarning: {
    backgroundColor: '#ef444420',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  connectionWarningText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  directorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#dc2626',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
  },
  followerBanner: {
    backgroundColor: '#7c3aed',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  endShowBtn: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  endShowText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  joinBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  joinBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  startShowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 8,
  },
  startShowBtnActive: {
    backgroundColor: '#dc2626',
  },
  startShowText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  startShowHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  startShowHeaderBtnActive: {
    backgroundColor: '#dc2626',
  },
  startShowHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  connectionWarningText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.foreground,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  topSongsList: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 10,
    marginBottom: 25,
  },
  topSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topSongRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  topSongRankText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  topSongName: {
    flex: 1,
    color: COLORS.foreground,
    fontSize: 15,
  },
  recentSetlists: {
    marginBottom: 40,
  },
  setlistCard: {
    width: 140,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 15,
    marginRight: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  setlistCardIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  setlistCardName: {
    color: COLORS.foreground,
    fontWeight: 'bold',
    fontSize: 14,
    height: 40,
  },
  setlistCardCount: {
    color: COLORS.mutedForeground,
    fontSize: 12,
    marginTop: 4,
  },
  activeSetlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    padding: 10,
    gap: 15,
  },
  closeSetlistBtn: {
    padding: 5,
  },
  activeSetlistTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  settingsPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 25,
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
  // Modal Crear Lista
  createModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  createModalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  createModalTitle: {
    color: COLORS.foreground,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  createModalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.foreground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  datePickerBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  datePickerText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '500',
  },
  createModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  createModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  createModalCancelText: {
    color: COLORS.mutedForeground,
    fontWeight: '600',
    fontSize: 15,
  },
  createModalConfirm: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  createModalConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  // Modal Editar Lista
  editSetlistBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editModalTitle: {
    color: COLORS.foreground,
    fontSize: 20,
    fontWeight: 'bold',
  },
  editModalList: {
    flex: 1,
  },
  editModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editModalItemActive: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}15`,
  },
  editModalItemInfo: {
    flex: 1,
  },
  editModalItemName: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '500',
  },
  editModalItemNameActive: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  editModalFooter: {
    padding: 20,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  editModalSaveBtn: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  editModalSaveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
